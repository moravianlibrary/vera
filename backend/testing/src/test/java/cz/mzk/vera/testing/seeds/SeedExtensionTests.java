package cz.mzk.vera.testing.seeds;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.JsonNode;

class SeedExtensionTests {
    @TempDir
    Path directory;

    @Test
    void laysChildRecordsOverParentCollections() throws Exception {
        SeedReader reader = reader();
        Files.writeString(directory.resolve("installation.json"), """
                {
                  "name": "installation",
                  "now": "2026-06-25T08:40:00Z",
                  "collections": {
                    "users": [],
                    "roles": [
                      {"id":"reader","name":"Reader","description":"reader","isShipped":true,
                       "grants":[],"proposalBatchLimit":1,"proposalDailyLimit":1},
                      {"id":"admin","name":"Admin","description":"admin","isShipped":true,
                       "grants":[],"proposalBatchLimit":1,"proposalDailyLimit":1}
                    ],
                    "groups": [
                      {"id":"g1","name":"Group","description":"group","memberIds":[],"categoryIds":[]}
                    ],
                    "userAccess": {
                      "u1": {"handRoleIds":[],"mappedRoles":[],"identities":[],"entry":null}
                    },
                    "categories": [],
                    "categoryMembers": {}
                  },
                  "fakes": {}
                }
                """);
        Files.writeString(directory.resolve("base.json"), """
                {
                  "name": "base",
                  "extends": "installation",
                  "now": "2026-06-25T08:40:00Z",
                  "collections": {
                    "groups": [
                      {"id":"g1","name":"Changed","description":"group","memberIds":[],"categoryIds":[]},
                      {"id":"g2","name":"Other","description":"other","memberIds":[],"categoryIds":[]}
                    ],
                    "roles": [
                      {"id":"admin","name":"Changed Admin","description":"admin","isShipped":true,
                       "grants":[],"proposalBatchLimit":1,"proposalDailyLimit":1}
                    ]
                  }
                }
                """);

        JsonNode result = reader.read("base");
        assertEquals("base", result.path("name").asString());
        assertEquals("Changed Admin", result.path("collections").path("roles").get(1).path("name").asString());
        assertEquals("Changed", result.path("collections").path("groups").get(0).path("name").asString());
        assertEquals(2, result.path("collections").path("groups").size());
        assertFalse(result.has("extends"));
    }

    @Test
    void keepsParentOnlyCollectionsAndAddsChildOnlyCollections() throws Exception {
        Files.writeString(directory.resolve("install.json"), """
                {
                  "name":"install",
                  "now":"2026-06-25T08:40:00Z",
                  "collections":{"users":[],"roles":[],"userAccess":{},
                                "categories":[],"groups":[],"categoryMembers":{}},
                  "fakes":{}
                }
                """);
        Files.writeString(directory.resolve("child.json"), """
                {"name":"child","extends":"install","now":"2026-06-25T08:40:00Z","collections":{"categories":[]}}
                """);

        JsonNode collections = reader().read("child").path("collections");
        assertTrue(collections.has("users"));
        assertTrue(collections.has("categories"));
    }

    @Test
    void mergesKeyedCollectionsAndFakesKeyByKey() throws Exception {
        Files.writeString(directory.resolve("install.json"), """
                {
                  "name":"install",
                  "now":"2026-06-25T08:40:00Z",
                  "collections":{
                    "users":[],"roles":[],
                    "userAccess":{"u2":{"handRoleIds":[],"mappedRoles":[],"identities":[],
                                    "entry":null}},
                    "categories":[],"groups":[],"categoryMembers":{}
                  },
                  "fakes":{},
                  "fakes":{"catalogAdapter":{"name":"local"}}
                }
                """);
        Files.writeString(directory.resolve("child.json"), """
                {
                  "name":"child",
                  "extends":"install",
                  "now":"2026-06-25T08:40:00Z",
                  "collections":{"userAccess":{"u1":{"handRoleIds":[],"mappedRoles":[],"identities":[],"entry":null}}},
                  "fakes":{"slackWorkspace":"library"}
                }
                """);

        JsonNode result = reader().read("child");
        JsonNode access = result.path("collections").path("userAccess");
        assertTrue(access.has("u1"));
        assertTrue(access.has("u2"));
        assertEquals("local", result.path("fakes").path("catalogAdapter").path("name").asString());
        assertEquals("library", result.path("fakes").path("slackWorkspace").asString());
    }

    @Test
    void refusesAnExtensionLoopAndNamesItsPath() throws Exception {
        Files.writeString(directory.resolve("alpha.json"), """
                {"name":"alpha","extends":"beta","now":"2026-06-25T08:40:00Z"}
                """);
        Files.writeString(directory.resolve("beta.json"), """
                {"name":"beta","extends":"alpha","now":"2026-06-25T08:40:00Z"}
                """);

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> reader().read("alpha"));
        assertEquals("seed alpha extends itself through alpha -> beta -> alpha", error.getMessage());
    }

    @ParameterizedTest(name = "reads and validates both schemas for seed {0}")
    @MethodSource("repositorySeeds")
    void readsAndChecksEveryRepositorySeed(String name) {
        SeedReader repositoryReader = new SeedReader(
                System.getenv("VERA_SEEDS_DIR"), System.getenv("VERA_CONTRACT_DIR"));
        assertEquals(name, repositoryReader.read(name).path("name").asString());
    }

    private static Stream<String> repositorySeeds() throws IOException {
        Path folder = Path.of(System.getenv("VERA_SEEDS_DIR"));
        try (Stream<Path> files = Files.list(folder)) {
            return files.filter(path -> path.getFileName().toString().endsWith(".json"))
                    .map(path -> path.getFileName().toString().replaceFirst("\\.json$", ""))
                    .sorted()
                    .toList()
                    .stream();
        }
    }

    private SeedReader reader() {
        Path contract = Path.of(System.getenv("VERA_CONTRACT_DIR"));
        return new SeedReader(directory, contract);
    }
}

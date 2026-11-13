package cz.mzk.vera.categories;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// ACT-category-create; ACT-category-save; ACT-category-delete; ACT-category-custody; ACT-category-refine.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class CategoryActTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void recordedCreateCategoryScenarioMatchesAndWrites() throws Exception {
        runScenario("create-category");
    }

    @Test
    void recordedSaveCategoryScenarioMatchesAndWrites() throws Exception {
        runScenario("save-category");
    }

    @Test
    void recordedDeleteCategoryScenarioMatchesAndWrites() throws Exception {
        runScenario("delete-category");
    }

    @Test
    void recordedScopedDeleteRefusalWritesNothing() throws Exception {
        runScenario("refuse-delete-scoped-category");
    }

    @Test
    void recordedCategoryCustodyScenarioMatchesAndWrites() throws Exception {
        runScenario("set-category-custody");
    }

    @Test
    void recordedCategoryRefinementScenarioMatchesAndWrites() throws Exception {
        runScenario("refine-category");
    }

    @Test
    void recordedCategoryRefusalsWriteNothing() throws Exception {
        runScenario("category-refusals");
    }

    @Test
    void refineMovesIterationsAndRevisesOnlyUnarchivedMixes() {
        String cookie = session("u3");
        List<String> iterationIds = jdbc.query("SELECT id FROM iterations WHERE category_id='c32' "
                + "ORDER BY id", (row, index) -> row.getString(1));
        assertThat(iterationIds).hasSizeGreaterThanOrEqualTo(2);
        jdbc.update("UPDATE iterations SET category_id='c31' WHERE id IN (?,?)",
                iterationIds.get(2), iterationIds.get(3));
        jdbc.update("UPDATE mixes SET archived_at='2026-06-25T10:00:00Z' WHERE id='d2'");
        int activeRevision = jdbc.queryForObject("SELECT revision FROM mixes WHERE id='d1'", Integer.class);
        int activeRevisionCount = jdbc.queryForObject(
                "SELECT count(*) FROM mix_revisions WHERE mix_id='d1'", Integer.class);
        int archivedRevision = jdbc.queryForObject("SELECT revision FROM mixes WHERE id='d2'", Integer.class);
        var response = client.post().uri("/api/categories/c32/refine").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{\"names\":{\"en\":\"Refined leaf\"}}")
                .exchange().expectStatus().isOk().expectBody().returnResult();
        JsonNode child = mapper.readTree(response.getResponseBody());
        String childId = child.path("id").asString();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM iterations WHERE category_id=?", Integer.class,
                childId)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT revision FROM mixes WHERE id='d1'", Integer.class))
                .isEqualTo(activeRevision + 1);
        assertThat(jdbc.queryForObject("SELECT revision FROM mixes WHERE id='d2'", Integer.class))
                .isEqualTo(archivedRevision);
        assertThat(jdbc.queryForObject("SELECT shares->>? FROM mixes WHERE id='d1'", String.class, childId))
                .isEqualTo("100");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM mix_revisions WHERE mix_id='d1'", Integer.class))
                .isEqualTo(activeRevisionCount + 1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM events WHERE code='iteration.reclassified'",
                Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(DISTINCT correlation_id) FROM events "
                + "WHERE code='iteration.reclassified'", Integer.class)).isEqualTo(1);
        assertThat(auditCodes()).last().isEqualTo("category.refined");
    }

    @Test
    void everyActRequiresASession() {
        client.post().uri("/api/categories").contentType(MediaType.APPLICATION_JSON)
                .body("{\"names\":{\"en\":\"No session\"},\"parentId\":\"c2\"}")
                .exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/categories/c23").contentType(MediaType.APPLICATION_JSON)
                .body("{\"names\":{\"en\":\"No session\"},\"parentId\":\"c2\"}")
                .exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/categories/c23").exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/categories/c22/custody").contentType(MediaType.APPLICATION_JSON)
                .body("{\"groupIds\":[],\"userIds\":[]}").exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/categories/c32/refine").contentType(MediaType.APPLICATION_JSON)
                .body("{\"names\":{\"en\":\"No session\"}}").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void custodianCannotCreateOutsideTheirSubtreeOrAtTheTopLevel() {
        String cookie = session("u1");
        int categoryCount = jdbc.queryForObject("SELECT count(*) FROM categories", Integer.class);
        int auditCount = jdbc.queryForObject("SELECT count(*) FROM audit_outbox", Integer.class);
        client.post().uri("/api/categories").header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                .body("{\"names\":{\"en\":\"Outside\"},\"parentId\":\"c4\"}")
                .exchange().expectStatus().isForbidden().expectBody()
                .jsonPath("$.detail").isEqualTo("You may change the tree only inside your own custody");
        client.post().uri("/api/categories").header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                .body("{\"names\":{\"en\":\"Top level\"},\"parentId\":null}")
                .exchange().expectStatus().isForbidden().expectBody()
                .jsonPath("$.detail").isEqualTo("Only an administrator changes the top level");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM categories", Integer.class)).isEqualTo(categoryCount);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_outbox", Integer.class)).isEqualTo(auditCount);
    }

    @Test
    void categoryNamesRoundTripAndConflictWithinOneLanguage() {
        String cookie = session("u3");
        Map<String, Object> request = Map.of("names", Map.of("cs", "Nová větev", "en", "New branch"),
                "parentId", "c2");
        client.post().uri("/api/categories").header("Cookie", cookie).header("Accept-Language", "cs")
                .contentType(MediaType.APPLICATION_JSON).body(request).exchange().expectStatus().isCreated()
                .expectBody().jsonPath("$.name").isEqualTo("Nová větev")
                .jsonPath("$.names.en").isEqualTo("New branch");
        client.post().uri("/api/categories").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("names", Map.of("cs", "Nová větev", "en", "Another branch"),
                        "parentId", "c2"))
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.code")
                .isEqualTo("category.name_taken");
    }

    private void runScenario(String name) throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-categories.json").toFile());
        JsonNode scenario = scenario(recording, name);
        assertThat(scenario).as(name).isNotNull();
        Map<String, String> cookies = new HashMap<>();
        for (JsonNode call : scenario.path("calls")) {
            String method = call.path("method").asString();
            String path = call.path("path").asString();
            String user = call.path("as").asString();
            if ("refuse-delete-scoped-category".equals(name) && "/api/intentions".equals(path)) {
                // Intention creation belongs to BK6g; stage the same scoped row for this category refusal.
                jdbc.update("UPDATE intentions SET scope_category_id='c33' WHERE id='i4'");
                continue;
            }
            Map<String, Object> before = storedState();
            RestTestClient.RequestBodySpec request = client.method(HttpMethod.valueOf(method))
                    .uri(URI.create(path)).header("Cookie", cookies.computeIfAbsent(user, this::session))
                    .header("Accept-Language", "en");
            if (call.has("requestBody")) {
                request.contentType(MediaType.APPLICATION_JSON).body(call.path("requestBody").toString());
            }
            var response = request.exchange().expectBody(String.class).returnResult();
            assertThat(response.getStatus().value()).as(name + " " + path).isEqualTo(call.path("status").asInt());
            JsonNode actual = response.getResponseBody() == null || response.getResponseBody().isBlank()
                    ? mapper.nullNode() : mapper.readTree(response.getResponseBody());
            if (call.has("body")) {
                assertMatches(call.path("body"), actual, name + " " + path);
            } else if (call.has("code")) {
                assertThat(actual.path("code").asString()).as(name + " " + path)
                        .isEqualTo(call.path("code").asString());
            }
            Map<String, Object> after = storedState();
            if (call.path("status").asInt() >= 400 && isCategoryAct(method, path)) {
                assertThat(after).as(name + " refused act wrote state at " + path).isEqualTo(before);
            }
            if (isCategoryAct(method, path) && call.path("status").asInt() < 400) {
                assertThat(after).as(name + " act changed stored state at " + path).isNotEqualTo(before);
                assertThat(auditCodes()).as(name + " audit record at " + path).isNotEmpty();
            }
        }
    }

    private boolean isCategoryAct(String method, String path) {
        return path.equals("/api/categories") && "POST".equals(method)
                || path.startsWith("/api/categories/") && !path.endsWith("/impact")
                    && !"GET".equals(method);
    }

    private JsonNode scenario(JsonNode recording, String name) {
        for (JsonNode item : recording.path("scenarios")) {
            if (name.equals(item.path("name").asString())) {
                return item;
            }
        }
        return null;
    }

    private Map<String, Object> storedState() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("categories", jdbc.query("SELECT id,name,parent_id,position FROM categories ORDER BY position",
                (row, index) -> List.of(row.getString("id"), row.getString("name"),
                        String.valueOf(row.getObject("parent_id")), row.getInt("position"))));
        result.put("custody", jdbc.query("SELECT category_id,user_id,position FROM category_members "
                + "ORDER BY category_id,position", (row, index) -> List.of(row.getString(1), row.getString(2),
                        row.getInt(3))));
        result.put("groupCustody", jdbc.query("SELECT group_id,category_id,position FROM group_categories "
                + "ORDER BY group_id,position", (row, index) -> List.of(row.getString(1), row.getString(2),
                        row.getInt(3))));
        result.put("mixes", jdbc.query("SELECT id,revision,shares::text,archived_at FROM mixes ORDER BY position",
                (row, index) -> List.of(row.getString(1), row.getInt(2), row.getString(3),
                        String.valueOf(row.getObject(4)))));
        result.put("iterations", jdbc.query("SELECT id,category_id FROM iterations ORDER BY id",
                (row, index) -> List.of(row.getString(1), row.getString(2))));
        result.put("history", jdbc.query("SELECT code,subject_id,data::text,correlation_id FROM events "
                + "ORDER BY id", (row, index) -> List.of(row.getString(1), row.getString(2),
                        row.getString(3), row.getString(4))));
        result.put("audit", jdbc.query("SELECT record::text FROM audit_outbox ORDER BY id",
                (row, index) -> row.getString(1)));
        return result;
    }

    private List<String> auditCodes() {
        return jdbc.query("SELECT record->>'code' FROM audit_outbox ORDER BY id",
                (row, index) -> row.getString(1));
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void assertMatches(JsonNode expected, JsonNode actual, String path) {
        if (expected.isString() && expected.asString().startsWith("<")
                && expected.asString().endsWith(">")) {
            assertThat(actual.isString()).as(path).isTrue();
            assertThat(actual.asString()).as(path).isNotBlank();
        } else if (expected.isObject()) {
            assertThat(actual.isObject()).as(path).isTrue();
            expected.properties().forEach(entry -> assertMatches(entry.getValue(), actual.path(entry.getKey()),
                    path + "." + entry.getKey()));
        } else if (expected.isArray()) {
            assertThat(actual.size()).as(path).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertMatches(expected.get(index), actual.get(index), path + "[" + index + "]");
            }
        } else if (expected.isNumber() && actual.isNumber()) {
            assertThat(actual.asDouble()).as(path).isEqualTo(expected.asDouble());
        } else {
            assertThat(actual).as(path).isEqualTo(expected);
        }
    }
}

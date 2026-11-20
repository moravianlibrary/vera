package cz.mzk.vera.plugins.kramerius_registry;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import cz.mzk.vera.plugin.LocalPasswords;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.registry.LookupInput;
import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class KrameriusRegistryTests {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Path RECORDED = Path.of(System.getProperty("vera.kramerius.recorded"));
    private static final String CLIENT_URL = "https://www.digitalniknihovna.cz/mzk";

    @Test
    void recordedRecordsUseOrderedQueriesAndExpectedAnswers() throws IOException {
        Map<String, Fixture> fixtures = fixtures();
        Map<String, Expected> expected = expectations();
        KrameriusRegistry registry = new KrameriusRegistry();

        for (String line : Files.readAllLines(RECORDED.resolve("records.psv"))) {
            if (line.isBlank() || line.startsWith("#")) {
                continue;
            }
            String[] fields = line.split("\\|", -1);
            String sysno = fields[0];
            List<String> identifiers = new ArrayList<>();
            if (!fields[1].isBlank()) {
                identifiers.add(fields[1]);
            }
            if (!fields[3].isBlank()) {
                identifiers.addAll(List.of(fields[3].split(",")));
            }
            FixtureHttp http = new FixtureHttp(fixtures);
            LookupAnswer answer = registry.lookup(context(http), new LookupInput(
                    new Document("document", sysno, null, null, null, null), identifiers));

            Expected want = expected.get(sysno);
            assertNotNull(want, sysno);
            List<LookupAnswer.RegistryRecord> expectedRecords = want.rawState().equals("(absent)")
                    ? List.of(new LookupAnswer.RegistryRecord("(absent)", null))
                    : java.util.Arrays.stream(want.pids().split(","))
                            .map(pid -> new LookupAnswer.RegistryRecord("published", CLIENT_URL + "/view/" + pid))
                            .toList();
            assertEquals(expectedRecords, answer.records(), sysno);
            List<String> queries = orderedQueries(sysno, fields[1], fields[3]);
            int firstHit = firstHit(queries, fixtures);
            assertEquals(firstHit < 0 ? queries : queries.subList(0, firstHit + 1), http.queries, sysno);
        }
    }

    @Test
    void sysnoHitsAvoidCnbAndSysnoWinsOverManyCnbResults() throws IOException {
        Map<String, Fixture> fixtures = fixtures();
        KrameriusRegistry registry = new KrameriusRegistry();
        for (String sysno : List.of("MZK01-001283171", "MZK01-000148004", "MZK01-001506589",
                "MZK01-000595514")) {
            String cnb = recordFields(sysno)[1];
            FixtureHttp http = new FixtureHttp(fixtures);
            LookupAnswer answer = registry.lookup(context(http), new LookupInput(
                    new Document("document", sysno, null, null, null, null), List.of(cnb)));
            assertEquals(1, http.queries.size());
            assertTrue(http.queries.get(0).startsWith("id_sysno:"));
            assertEquals("published", answer.records().get(0).rawState());
        }
        FixtureHttp priorityHttp = new FixtureHttp(fixtures);
        LookupAnswer priority = registry.lookup(context(priorityHttp), new LookupInput(
                new Document("document", "MZK01-001283171", null, null, null, null), List.of("cnb002777500")));
        assertEquals(1, priorityHttp.queries.size());
        assertEquals(List.of(
                new LookupAnswer.RegistryRecord("published", CLIENT_URL + "/view/uuid:4b7fe99b-9da0-4dc9-9840-40e5f987fba7"),
                new LookupAnswer.RegistryRecord("published", CLIENT_URL + "/view/uuid:325d5562-ddd4-45ae-8467-6fcc301a6e53"),
                new LookupAnswer.RegistryRecord("published", CLIENT_URL + "/view/uuid:0d4b7607-c750-4c2a-bbde-d110b037bf3a")),
                priority.records());
    }

    @Test
    void periodicalUnitReturnsItsMatchingVolume() throws IOException {
        FixtureHttp http = new FixtureHttp(fixtures());
        LookupAnswer answer = new KrameriusRegistry().lookup(context(http), new LookupInput(
                new Document("document", null, new Document.Unit("volume", "3"), null, null, null),
                List.of("cnb002745245")));
        assertEquals(List.of("id_ccnb:cnb002745245"), http.queries);
        assertEquals(List.of(new LookupAnswer.RegistryRecord("published",
                CLIENT_URL + "/view/uuid:5b579ed0-9ba9-11ec-8353-005056827e51")), answer.records());
    }

    @Test
    void unavailableStatusAndMalformedJsonFailAsPluginUnavailable() {
        PluginHttp unavailable = request -> new PluginHttp.Response(503, Map.of(), new byte[0]);
        assertThrows(PluginUnavailable.class, () -> new KrameriusRegistry().lookup(context(unavailable), input()));
        PluginHttp malformed = request -> new PluginHttp.Response(200, Map.of(), "{".getBytes(StandardCharsets.UTF_8));
        assertThrows(PluginUnavailable.class, () -> new KrameriusRegistry().lookup(context(malformed), input()));
    }

    private LookupInput input() {
        return new LookupInput(new Document("document", "MZK01-001283171", null, null, null, null),
                List.of("cnb002777500"));
    }

    private PluginContext context(PluginHttp http) {
        return new PluginContext() {
            @Override public String instanceId() { return "test"; }
            @Override public Map<String, String> configuration() {
                return Map.of("api_url", "https://api.kramerius.mzk.cz", "client_url", CLIENT_URL);
            }
            @Override public Map<String, String> secrets() { return Map.of(); }
            @Override public PluginHttp http() { return http; }
            @Override public System.Logger logger() { return System.getLogger("test"); }
            @Override public Clock clock() { return Clock.systemUTC(); }
            @Override public LocalPasswords localPasswords() { return null; }
        };
    }

    private Map<String, Fixture> fixtures() throws IOException {
        Map<String, Fixture> fixtures = new HashMap<>();
        try (Stream<Path> paths = Files.list(RECORDED.resolve("kramerius"))) {
            for (Path path : paths.filter(file -> file.toString().endsWith(".json")).toList()) {
                JsonNode body = JSON.readTree(path.toFile());
                String query = body.path("responseHeader").path("params").path("q").asText();
                fixtures.put(query, new Fixture(body, Files.readAllBytes(path)));
            }
        }
        return fixtures;
    }

    private Map<String, Expected> expectations() throws IOException {
        Map<String, Expected> expected = new HashMap<>();
        try (Stream<String> lines = Files.lines(Path.of("src/test/resources/expectations.psv"))) {
            lines.filter(line -> !line.isBlank() && !line.startsWith("#")).forEach(line -> {
                String[] fields = line.split("\\|", -1);
                expected.put(fields[0], new Expected(fields[1], fields[2]));
            });
        }
        return expected;
    }

    private String[] recordFields(String sysno) throws IOException {
        return Files.readAllLines(RECORDED.resolve("records.psv")).stream()
                .filter(line -> line.startsWith(sysno + "|"))
                .findFirst().orElseThrow().split("\\|", -1);
    }

    private List<String> orderedQueries(String sysno, String cnb, String barcodes) {
        String bare = sysno.substring(sysno.indexOf('-') + 1);
        List<String> queries = new ArrayList<>();
        queries.add("id_sysno:(\"" + sysno.toLowerCase() + "\" OR \"" + bare + "\")");
        if (!cnb.isBlank()) {
            queries.add("id_ccnb:" + cnb);
        }
        if (!barcodes.isBlank()) {
            queries.add("id_barcode:(" + String.join(" OR ", barcodes.split(",")) + ")");
        }
        return queries;
    }

    private int firstHit(List<String> queries, Map<String, Fixture> fixtures) {
        for (int index = 0; index < queries.size(); index++) {
            Fixture fixture = fixtures.get(queries.get(index));
            if (fixture != null && fixture.json().path("response").path("docs").size() > 0) {
                return index;
            }
        }
        return -1;
    }

    private record Expected(String rawState, String pids) {}
    private record Fixture(JsonNode json, byte[] bytes) {}

    private static final class FixtureHttp implements PluginHttp {
        private final Map<String, Fixture> fixtures;
        private final List<String> queries = new ArrayList<>();

        FixtureHttp(Map<String, Fixture> fixtures) {
            this.fixtures = fixtures;
        }

        @Override
        public Response send(Request request) {
            String query = queryParameter(request.uri(), "q");
            queries.add(query);
            Fixture fixture = fixtures.get(query);
            byte[] body = fixture == null ? "{\"response\":{\"docs\":[]}}".getBytes(StandardCharsets.UTF_8)
                    : fixture.bytes();
            return new Response(200, Map.of(), body);
        }

        private String queryParameter(URI uri, String name) {
            for (String part : uri.getRawQuery().split("&")) {
                String[] pair = part.split("=", 2);
                if (URLDecoder.decode(pair[0], StandardCharsets.UTF_8).equals(name)) {
                    return URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
                }
            }
            return "";
        }
    }
}

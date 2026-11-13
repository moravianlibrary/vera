package cz.mzk.vera.mixes;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.ArrayList;
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

// ACT-mix-create; ACT-mix-save; ACT-mix-snapshot; ACT-mix-primary; ACT-mix-archive; ACT-mix-delete.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class MixActTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private JdbcTemplate jdbc;

    private String cookie;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
        cookie = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", "u3")).exchange().expectStatus().isOk()
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    @Test
    void createsReadsRevisesAndLabelsARecord() {
        client.get().uri("/api/mixes").header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].id").isEqualTo("d1");
        client.post().uri("/api/mixes").header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                .body("{\"names\":{\"en\":\"Session mix\"},\"fromMixId\":\"d2\",\"fromRevision\":2}")
                .exchange().expectStatus().isCreated().expectBody().jsonPath("$.name").isEqualTo("Session mix")
                .jsonPath("$.revision").isEqualTo(1);
        client.put().uri("/api/mixes/d1/sets").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"parentId\":null,\"shares\":{\"c1\":25,\"c2\":65,\"c3\":10,\"c4\":0},\"revision\":4}")
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.revision").isEqualTo(5)
                .jsonPath("$.revisions.length()").isEqualTo(2);
        client.post().uri("/api/mixes/d1/snapshots").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{\"revision\":5,\"label\":\"Approved\"}")
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.revisions[1].label").isEqualTo("Approved");
        client.get().uri("/api/mixes/d1").header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.revisions[1].revision").isEqualTo(5);
    }

    @Test
    void refusesUnauthenticatedAndInvalidActsWithoutWriting() {
        client.post().uri("/api/mixes").contentType(MediaType.APPLICATION_JSON)
                .body("{\"names\":{\"en\":\"No session\"},\"fromMixId\":null,\"fromRevision\":null}")
                .exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/mixes/d1/sets").contentType(MediaType.APPLICATION_JSON)
                .body("{\"parentId\":null,\"shares\":{\"c1\":25,\"c2\":65,\"c3\":10,\"c4\":0},\"revision\":4}")
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/mixes/d1/snapshots").contentType(MediaType.APPLICATION_JSON)
                .body("{\"revision\":1,\"label\":\"No session\"}")
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/mixes/d1/primary").contentType(MediaType.APPLICATION_JSON)
                .body("{}").exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/mixes/d1/archive").contentType(MediaType.APPLICATION_JSON)
                .body("{}").exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/mixes/d1").exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/mixes/d1/sets").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"parentId\":null,\"shares\":{\"c1\":25},\"revision\":4}")
                .exchange().expectStatus().isEqualTo(422);
        client.get().uri("/api/mixes/d1").header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.revision").isEqualTo(4)
                .jsonPath("$.revisions.length()").isEqualTo(1);
    }

    @Test
    void mixNamesRoundTripAndConflictWithinOneLanguage() {
        Map<String, Object> names = Map.of("cs", "Nový mix", "en", "New mix");
        client.post().uri("/api/mixes").header("Cookie", cookie).header("Accept-Language", "cs")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("names", names, "fromMixId", "d2", "fromRevision", 2))
                .exchange().expectStatus().isCreated().expectBody().jsonPath("$.name").isEqualTo("Nový mix")
                .jsonPath("$.names.en").isEqualTo("New mix");
        client.post().uri("/api/mixes").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("names", Map.of("cs", "Nový mix", "en", "Another mix"),
                        "fromMixId", "d2", "fromRevision", 2))
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.code")
                .isEqualTo("mix.name_taken");
    }

    @Test
    void recordedReadsScenarioMatchesBodiesAndStoredState() throws Exception {
        runRecordedScenario("reads");
    }

    @Test
    void recordedCreateSaveSnapshotPrimaryArchiveScenarioMatchesBodiesAndWrites() throws Exception {
        runRecordedScenario("create-save-snapshot-primary-archive");
    }

    @Test
    void recordedDeleteUnusedScenarioMatchesBodiesAndWrites() throws Exception {
        runRecordedScenario("delete-unused");
    }

    @Test
    void recordedMixRefusalsWriteNothing() throws Exception {
        runRecordedScenario("mix-refusals");
    }

    @Test
    void archivePinsAnIntentionAndRepeatAtTheFinalRevision() {
        client.post().uri("/api/mixes/d2/primary").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk();
        assertThat(jdbc.queryForObject("SELECT mix_revision FROM intentions WHERE id='i4'", Integer.class))
                .isNull();
        assertThat(jdbc.queryForObject("SELECT mix_revision FROM intention_templates WHERE id='t1'", Integer.class))
                .isNull();
        client.post().uri("/api/mixes/d1/archive").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk();
        assertThat(jdbc.queryForObject("SELECT mix_revision FROM intentions WHERE id='i4'", Integer.class))
                .isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT mix_revision FROM intention_templates WHERE id='t1'", Integer.class))
                .isEqualTo(4);
        assertThat(auditCodes()).contains("mix.made_primary", "mix.archived");
    }

    private void runRecordedScenario(String name) throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-mixes.json").toFile());
        JsonNode scenario = findScenario(recording, name);
        assertThat(scenario).as(name).isNotNull();
        Map<String, String> cookies = new HashMap<>();
        for (JsonNode call : scenario.path("calls")) {
            String method = call.path("method").asString();
            String path = call.path("path").asString();
            String userId = call.path("as").asString();
            String sessionCookie = cookies.computeIfAbsent(userId, this::session);
            Map<String, Object> before = storedState();
            RestTestClient.RequestBodySpec request = client.method(HttpMethod.valueOf(method))
                    .uri(URI.create(path)).header("Cookie", sessionCookie).header("Accept-Language", "en");
            if (call.has("requestBody")) {
                request.contentType(MediaType.APPLICATION_JSON).body(call.path("requestBody").toString());
            }
            var response = request.exchange().expectBody(String.class).returnResult();
            int status = call.path("status").asInt();
            assertThat(response.getStatus().value()).as(name + " " + method + " " + path).isEqualTo(status);
            JsonNode actual = response.getResponseBody() == null || response.getResponseBody().isBlank()
                    ? mapper.nullNode() : mapper.readTree(response.getResponseBody());
            if (call.has("body")) {
                assertMatches(call.path("body"), actual, name + " " + path);
            } else if (call.has("code")) {
                assertThat(actual.path("code").asString()).as(name + " " + path)
                        .isEqualTo(call.path("code").asString());
            }
            Map<String, Object> after = storedState();
            if (status >= 400) {
                assertThat(after).as(name + " refusal wrote state at " + path).isEqualTo(before);
            } else if (isAct(method, path)) {
                @SuppressWarnings("unchecked")
                List<String> previousOutbox = (List<String>) before.get("outbox");
                @SuppressWarnings("unchecked")
                List<String> currentOutbox = (List<String>) after.get("outbox");
                assertThat(currentOutbox).as(name + " outbox after " + path)
                        .hasSize(previousOutbox.size() + 1);
                assertThat(auditCodes()).as(name + " audit codes after " + path)
                        .last().isEqualTo(expectedEvent(method, path));
                assertThat(after).as(name + " stored mixes and revisions after " + path)
                        .isNotEqualTo(before);
                assertLastAudit(method, path, actual);
                if (!"DELETE".equals(method)) {
                    assertStoredRecord(actual);
                }
            }
        }
    }

    private JsonNode findScenario(JsonNode recording, String name) {
        for (JsonNode scenario : recording.path("scenarios")) {
            if (name.equals(scenario.path("name").asString())) {
                return scenario;
            }
        }
        return null;
    }

    private Map<String, Object> storedState() {
        List<Map<String, Object>> mixes = jdbc.query("SELECT id,name,is_primary,archived_at,shares::text AS shares,"
                + "revision,position FROM mixes ORDER BY position", (row, index) -> {
                    Map<String, Object> mix = new LinkedHashMap<>();
                    mix.put("id", row.getString("id"));
                    mix.put("name", row.getString("name"));
                    mix.put("primary", row.getBoolean("is_primary"));
                    mix.put("archived", row.getObject("archived_at"));
                    mix.put("shares", row.getString("shares"));
                    mix.put("revision", row.getInt("revision"));
                    mix.put("position", row.getInt("position"));
                    return mix;
                });
        List<Map<String, Object>> revisions = jdbc.query("SELECT mix_id,revision,shares::text AS shares,"
                + "at,label,position FROM mix_revisions ORDER BY mix_id,position", (row, index) -> {
                    Map<String, Object> revision = new LinkedHashMap<>();
                    revision.put("mix", row.getString("mix_id"));
                    revision.put("revision", row.getInt("revision"));
                    revision.put("shares", row.getString("shares"));
                    revision.put("at", row.getObject("at"));
                    revision.put("label", row.getString("label"));
                    revision.put("position", row.getInt("position"));
                    return revision;
                });
        List<String> outbox = jdbc.query("SELECT record::text FROM audit_outbox ORDER BY id",
                (row, index) -> row.getString(1));
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("mixes", mixes);
        state.put("revisions", revisions);
        state.put("outbox", outbox);
        return state;
    }

    private List<String> auditCodes() {
        return jdbc.query("SELECT record->>'code' FROM audit_outbox ORDER BY id",
                (row, index) -> row.getString(1));
    }

    private void assertLastAudit(String method, String path, JsonNode response) {
        String record = jdbc.queryForObject("SELECT record::text FROM audit_outbox ORDER BY id DESC LIMIT 1",
                String.class);
        JsonNode audit = mapper.readTree(record);
        String id = response.path("id").isString() ? response.path("id").asString()
                : path.substring("/api/mixes/".length());
        if (id.contains("/")) {
            id = id.substring(0, id.indexOf('/'));
        }
        assertThat(audit.path("code").asString()).isEqualTo(expectedEvent(method, path));
        assertThat(audit.path("subject").path("kind").asString()).isEqualTo("mix");
        assertThat(audit.path("subject").path("id").asString()).isEqualTo(id);
        List<String> fields = new ArrayList<>();
        audit.path("changes").forEach(change -> fields.add(change.path("field").asString()));
        assertThat(fields).isEqualTo(expectedChangeFields(method, path));
    }

    private List<String> expectedChangeFields(String method, String path) {
        if ("DELETE".equals(method)) {
            return List.of("mix");
        }
        if (path.equals("/api/mixes")) {
            return List.of("mix");
        }
        if (path.endsWith("/sets")) {
            return List.of("revision", "shares");
        }
        if (path.endsWith("/snapshots")) {
            return List.of("label", "revision");
        }
        if (path.endsWith("/primary")) {
            return List.of("primary");
        }
        return List.of("archivedAt", "revision");
    }

    private void assertStoredRecord(JsonNode body) {
        String id = body.path("id").asString();
        assertThat(jdbc.queryForObject("SELECT name FROM mixes WHERE id=?", String.class, id))
                .isEqualTo(body.path("name").asString());
        assertThat(jdbc.queryForObject("SELECT revision FROM mixes WHERE id=?", Integer.class, id))
                .isEqualTo(body.path("revision").asInt());
        String shares = jdbc.queryForObject("SELECT shares::text FROM mixes WHERE id=?", String.class, id);
        assertThat(mapper.readTree(shares)).isEqualTo(body.path("shares"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM mix_revisions WHERE mix_id=?", Integer.class, id))
                .isEqualTo(body.path("revisions").size());
        for (JsonNode revision : body.path("revisions")) {
            String stored = jdbc.queryForObject("SELECT shares::text FROM mix_revisions "
                    + "WHERE mix_id=? AND revision=?", String.class, id, revision.path("revision").asInt());
            assertThat(mapper.readTree(stored)).isEqualTo(revision.path("shares"));
            assertThat(jdbc.queryForObject("SELECT label FROM mix_revisions WHERE mix_id=? AND revision=?",
                    String.class, id, revision.path("revision").asInt())).isEqualTo(revision.path("label").isNull()
                            ? null : revision.path("label").asString());
        }
    }

    private boolean isAct(String method, String path) {
        return !"GET".equals(method) && path.startsWith("/api/mixes");
    }

    private String expectedEvent(String method, String path) {
        if ("DELETE".equals(method)) {
            return "mix.deleted";
        }
        if (path.equals("/api/mixes")) {
            return "mix.created";
        }
        if (path.endsWith("/sets")) {
            return "mix.revised";
        }
        if (path.endsWith("/snapshots")) {
            return "mix.labelled";
        }
        if (path.endsWith("/primary")) {
            return "mix.made_primary";
        }
        return "mix.archived";
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void assertMatches(JsonNode expected, JsonNode actual, String path) {
        if (expected.isString() && expected.asString().startsWith("<") && expected.asString().endsWith(">")) {
            assertThat(actual.isString()).as(path).isTrue();
            assertThat(actual.asString()).as(path).isNotBlank();
            return;
        }
        if (expected.isObject()) {
            assertThat(actual.isObject()).as(path).isTrue();
            assertThat(actual.size()).as(path).isEqualTo(expected.size());
            expected.properties().forEach(entry -> assertMatches(entry.getValue(), actual.path(entry.getKey()),
                    path + "." + entry.getKey()));
            return;
        }
        if (expected.isArray()) {
            assertThat(actual.isArray()).as(path).isTrue();
            assertThat(actual.size()).as(path).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertMatches(expected.get(index), actual.get(index), path + "[" + index + "]");
            }
            return;
        }
        if (expected.isNumber() && actual.isNumber()) {
            assertThat(actual.asDouble()).as(path).isEqualTo(expected.asDouble());
            return;
        }
        assertThat(actual).as(path).isEqualTo(expected);
    }
}

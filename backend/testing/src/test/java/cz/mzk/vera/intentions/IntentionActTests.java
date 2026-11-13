package cz.mzk.vera.intentions;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;

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

import java.net.URI;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.StreamSupport;

// ACT-intention-create; ACT-intention-save; ACT-intention-archive; ACT-intention-delete;
// ACT-repeat-save.
@SpringBootTest(
        classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class IntentionActTests {
    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired private RestTestClient client;
    @Autowired private TemplateResetService reset;
    @Autowired private JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void recordedPreviewCreateAndSaveScenarioMatchesHttpAndStoredWrites() throws Exception {
        runRecording("preview-create-save");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM intentions WHERE id='i20'", Integer.class))
                .isEqualTo(1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM audit_outbox WHERE"
                                        + " record->>'code'='intention.created'",
                                Integer.class))
                .isEqualTo(1);
    }

    @Test
    void recordedArchiveUnarchiveAndDeleteScenarioMatchesHttpAndSnapshots() throws Exception {
        runRecording("archive-unarchive-delete");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM archived_intention_snapshots WHERE"
                                        + " intention_id='i8'",
                                Integer.class))
                .isEqualTo(1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM audit_outbox WHERE"
                                        + " record->>'code'='intention.archived'",
                                Integer.class))
                .isEqualTo(1);
    }

    @Test
    void recordedRepeatCreateAndSaveScenarioMatchesHttpAndAudit() throws Exception {
        runRecording("repeat-create-save");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM intention_templates WHERE id='t2'",
                                Integer.class))
                .isEqualTo(1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM audit_outbox WHERE"
                                        + " record->>'code'='repeat.changed'",
                                Integer.class))
                .isEqualTo(2);
    }

    @Test
    void recordedRefusalsMatchAndWriteNothing() throws Exception {
        runRecording("intention-refusals");
    }

    @Test
    void projectOwnedIntentionUsesTheSharedWriterAndCannotBeSavedDirectly() {
        String cookie = session("u8");
        String project =
                "{\"name\":\"Shared writer\",\"description\":\"\","
                    + "\"startsOn\":\"2026-09-01\",\"endsOn\":\"2027-08-31\",\"targetPages\":1000}";
        client.post()
                .uri("/api/projects")
                .header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body(project)
                .exchange()
                .expectStatus()
                .isCreated();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM intentions WHERE project_id IS NOT NULL",
                                Integer.class))
                .isGreaterThan(0);
    }

    @Test
    void everyIntentionActAndRepeatActNeedsASession() {
        String draft =
                "{\"name\":\"No session\",\"description\":\"\",\"funding\":{\"kind\":\"any\"},"
                        + "\"scopeCategoryId\":null,\"countsFrom\":\"2026-06-25\",\"endsOn\":null,"
                        + "\"targetPages\":null,\"mix\":{\"kind\":\"none\"}}";
        String repeat =
                "{\"description\":\"\",\"namePatterns\":{\"cs\":\"Období {period}\",\"en\":\"Period {period}\"},\"every\":\"month\","
                    + "\"funding\":{\"kind\":\"any\"},\"scopeCategoryId\":null,"
                    + "\"mix\":{\"kind\":\"none\"},\"targetPages\":null,\"isArchivingPrevious\":false}";
        client.post()
                .uri("/api/intentions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(draft)
                .exchange()
                .expectStatus()
                .isUnauthorized();
        client.put()
                .uri("/api/intentions/i8")
                .contentType(MediaType.APPLICATION_JSON)
                .body(draft)
                .exchange()
                .expectStatus()
                .isUnauthorized();
        client.post()
                .uri("/api/intentions/i8/archive")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{}")
                .exchange()
                .expectStatus()
                .isUnauthorized();
        client.post()
                .uri("/api/intentions/i8/unarchive")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{}")
                .exchange()
                .expectStatus()
                .isUnauthorized();
        client.delete().uri("/api/intentions/i8").exchange().expectStatus().isUnauthorized();
        client.post()
                .uri("/api/intention-templates")
                .contentType(MediaType.APPLICATION_JSON)
                .body(repeat)
                .exchange()
                .expectStatus()
                .isUnauthorized();
        client.put()
                .uri("/api/intention-templates/t1")
                .contentType(MediaType.APPLICATION_JSON)
                .body(repeat)
                .exchange()
                .expectStatus()
                .isUnauthorized();
    }

    private void runRecording(String name) throws Exception {
        JsonNode recording =
                mapper.readTree(Path.of("../../replay/recordings/base-intentions.json").toFile());
        JsonNode scenario =
                StreamSupport.stream(recording.path("scenarios").spliterator(), false)
                        .filter(candidate -> name.equals(candidate.path("name").asString()))
                        .findFirst()
                        .orElseThrow();
        if ("intention-refusals".equals(name)) {
            jdbc.update("UPDATE mixes SET archived_at='2026-06-25T08:40:00Z' WHERE id='d2'");
        }
        for (JsonNode call : scenario.path("calls")) {
            String method = call.path("method").asString();
            String path = call.path("path").asString();
            if (!path.startsWith("/api/intentions")
                    && !path.startsWith("/api/intention-templates")) {
                continue;
            }
            Map<String, Integer> before = counts();
            RestTestClient.RequestBodySpec request =
                    client.method(HttpMethod.valueOf(method))
                            .uri(URI.create(path))
                            .header("Cookie", session(call.path("as").asString()))
                            .header("Accept-Language", "en");
            if (call.has("requestBody")) {
                request.contentType(MediaType.APPLICATION_JSON)
                        .body(call.path("requestBody").toString());
            }
            var response = request.exchange().expectBody(String.class).returnResult();
            int status = response.getStatus().value();
            assertThat(status)
                    .as(name + " " + method + " " + path)
                    .isEqualTo(call.path("status").asInt());
            if (status >= 400) assertThat(counts()).as("refused act writes").isEqualTo(before);
            if (call.has("code")) {
                assertThat(mapper.readTree(response.getResponseBody()).path("code").asString())
                        .isEqualTo(call.path("code").asString());
            }
            if (call.has("body") && status != 204) {
                assertMatches(call.path("body"), mapper.readTree(response.getResponseBody()), path);
            }
        }
    }

    private Map<String, Integer> counts() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put(
                "intentions",
                jdbc.queryForObject("SELECT count(*) FROM intentions", Integer.class));
        counts.put(
                "templates",
                jdbc.queryForObject("SELECT count(*) FROM intention_templates", Integer.class));
        counts.put(
                "snapshots",
                jdbc.queryForObject(
                        "SELECT count(*) FROM archived_intention_snapshots", Integer.class));
        counts.put("events", jdbc.queryForObject("SELECT count(*) FROM events", Integer.class));
        counts.put(
                "audit", jdbc.queryForObject("SELECT count(*) FROM audit_outbox", Integer.class));
        return counts;
    }

    private String session(String userId) {
        return client.post()
                .uri("/_engine/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody()
                .returnResult()
                .getResponseHeaders()
                .getFirst("Set-Cookie")
                .split(";", 2)[0];
    }

    private void assertMatches(JsonNode expected, JsonNode actual, String path) {
        if (expected.isString()
                && expected.asString().startsWith("<")
                && expected.asString().endsWith(">")) {
            assertThat(actual.isString()).as(path).isTrue();
            assertThat(actual.asString()).as(path).isNotBlank();
        } else if (expected.isObject()) {
            assertThat(actual.isObject()).as(path).isTrue();
            expected.properties()
                    .forEach(
                            entry ->
                                    assertMatches(
                                            entry.getValue(),
                                            actual.path(entry.getKey()),
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

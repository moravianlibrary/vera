package cz.mzk.vera.plugins;

import static org.assertj.core.api.Assertions.assertThat;
import static cz.mzk.vera.db.tables.Tables.AUDIT_OUTBOX;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.SCHEDULES;

import cz.mzk.vera.testing.VeraTestingApplication;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// PLG-model; PLG-secrets; PLG-triggers; PLG-run-items; PLG-disable; PLG-delete; ACCESS-last-identity; L8.
@org.springframework.boot.test.context.SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class PluginTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;

    @Autowired
    private DSLContext dsl;

    private final ObjectMapper mapper = new ObjectMapper();
    private String adminCookie;
    private String readerCookie;

    @BeforeEach
    void resetBase() {
        client.post().uri("/_engine/reset").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("seed", "base", "frozen", true)).exchange().expectStatus().isOk();
        adminCookie = session("u3");
        readerCookie = session("u8");
    }

    @Test
    void readsPluginIndexAndInstanceSummariesForAdministratorAndReader() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-plugins.json").toFile());
        JsonNode reads = recording.path("scenarios").get(0).path("calls");
        JsonNode pluginIndex = body(client.get().uri("/api/plugins").header("Cookie", adminCookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        assertThat(pluginIndex).isEqualTo(reads.get(0).path("body"));
        JsonNode instances = body(client.get().uri("/api/plugin-instances").header("Cookie", adminCookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        assertThat(instances).isEqualTo(reads.get(1).path("body"));
        client.get().uri("/api/plugins").header("Cookie", readerCookie).exchange().expectStatus().isForbidden();
        client.get().uri("/api/plugin-instances").header("Cookie", readerCookie).exchange()
                .expectStatus().isOk();
    }

    @Test
    void resetMatchesItsRecordingAndRecordsOnlyTheSuccessfulAct() throws Exception {
        for (int index = 0; index < 4; index++) {
            JsonNode call = call("plugin-reset", index);
            String userId = call.path("as").asString();
            JsonNode actual = send(call, session(userId));
            if (call.has("code")) {
                assertThat(actual.path("code").asString()).isEqualTo(call.path("code").asString());
            } else {
                assertThat(actual).isEqualTo(call.path("body"));
            }
        }
        assertAuditCodes(List.of("plugin_instance.reset"));
    }

    @Test
    void resetRefusesAReaderOnlyPerson() throws Exception {
        client.post().uri("/api/plugin-instances/pi8/reset").header("Cookie", session("u5"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isForbidden();
        assertAuditCodes(List.of());
    }

    @Test
    void resetRefusesAnInstanceWithNoCursorOperation() throws Exception {
        client.post().uri("/api/plugin-instances/pi12/reset").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("plugin.no_cursor");
        assertAuditCodes(List.of());
    }

    @Test
    void runsAnEnabledSchedulableInstanceNow() {
        JsonNode run = body(client.post().uri("/api/plugin-instances/pi5/run").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody());
        assertThat(run.path("state").asString()).isEqualTo("Running");
        assertThat(run.path("doneCount").asInt()).isZero();
        assertThat(run.path("trigger").path("kind").asString()).isEqualTo("manual");
        assertThat(run.path("trigger").path("from").path("path").asString()).isEqualTo("/plugins?i=pi5");
        assertThat(run.path("itemCount").asInt()).isPositive();
        assertThat(client.post().uri("/api/plugin-instances/pi12/run").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isEqualTo(422)
                .expectBody(String.class).returnResult().getResponseBody()).contains("plugin.not_runnable");
    }

    @Test
    void createsAnInstanceAndRefusesAnUnauthorizedOrInvalidCreate() throws Exception {
        JsonNode create = call("create-plugin-instance", 0);
        assertThat(send(create, adminCookie)).isEqualTo(create.path("body"));
        assertThat(send(call("create-plugin-instance", 2), readerCookie).path("code").asString())
                .isEqualTo("forbidden");
        assertThat(send(call("create-plugin-instance", 3), adminCookie).path("code").asString())
                .isEqualTo("invalid");
        assertAuditCodes(List.of("plugin_instance.created"));
    }

    @Test
    void savesKeepingBlankSecretsAndDeletesWithoutDeletingRuns() throws Exception {
        assertThat(send(call("save-and-delete-plugin-instance", 0), adminCookie))
                .isEqualTo(call("save-and-delete-plugin-instance", 0).path("body"));
        assertThat(send(call("save-and-delete-plugin-instance", 2), adminCookie).path("code").asString())
                .isEqualTo("invalid");
        send(call("save-and-delete-plugin-instance", 3), adminCookie);
        String deleted = client.delete().uri("/api/plugin-instances/pi35").header("Cookie", adminCookie)
                .exchange().expectStatus().isNoContent().expectBody(String.class)
                .returnResult().getResponseBody();
        assertThat(deleted).isNullOrEmpty();
        assertThat(send(call("save-and-delete-plugin-instance", 5), adminCookie))
                .isEqualTo(call("save-and-delete-plugin-instance", 5).path("body"));
        assertThat(send(call("save-and-delete-plugin-instance", 6), adminCookie).path("code").asString())
                .isEqualTo("plugin.predefined");
        assertAuditCodes(List.of("plugin_instance.configured", "plugin_instance.configured",
                "plugin_instance.deleted"));
    }

    @Test
    void refusesInvalidConfigurationAndRemovingTheLastIdentity() throws Exception {
        for (int index = 0; index <= 9; index++) {
            JsonNode call = call("plugin-configuration-refusals", index);
            JsonNode actual = send(call, adminCookie);
            if (call.has("code")) {
                assertThat(actual.path("code").asString()).isEqualTo(call.path("code").asString());
            } else {
                assertThat(actual).isEqualTo(call.path("body"));
            }
        }
        for (int index = 0; index <= 3; index++) {
            JsonNode call = call("refuse-removing-the-last-identity-plugin", index);
            JsonNode actual = send(call, adminCookie);
            if (call.has("code")) {
                assertThat(actual.path("code").asString()).isEqualTo(call.path("code").asString());
            } else {
                assertThat(actual).isEqualTo(call.path("body"));
            }
        }
        assertAuditCodes(List.of("plugin_instance.created", "plugin_instance.disabled",
                "plugin_instance.disabled", "plugin_instance.disabled"));
    }

    @Test
    void matchesImpactEnableDisableAndRunRecording() throws Exception {
        for (int index : List.of(0, 1, 2, 3, 4, 6, 8, 12, 13)) {
            JsonNode call = call("instance-enable-disable-impact-and-run", index);
            String userId = call.path("as").asString();
            String cookie = "u3".equals(userId) ? adminCookie
                    : "u8".equals(userId) ? readerCookie : session(userId);
            JsonNode actual = send(call, cookie);
            if (call.has("code")) {
                assertThat(actual.path("code").asString()).isEqualTo(call.path("code").asString());
            } else {
                assertThat(actual).isEqualTo(call.path("body"));
            }
        }
        JsonNode impact = body(client.get().uri("/api/plugin-instances/pi20/impact").header("Cookie", adminCookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        assertThat(impact.path("hookCount").asInt()).isEqualTo(2);
        assertThat(impact.path("hooks").size()).isEqualTo(2);
        assertAuditCodes(List.of("plugin_instance.disabled", "plugin_instance.enabled"));
    }

    @Test
    void savesCustodyAndStartsAPlacingRun() {
        int before = placementRunCount();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "Moravica project");
        body.put("configuration", Map.of("expr", ".request.project == \"Moravica\""));
        body.put("linkedCategoryId", null);
        body.put("settings", Map.of("kind", "Custody", "custodyId", "pc3"));
        client.put().uri("/api/plugin-instances/pi35").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk();
        assertThat(placementRunCount()).isEqualTo(before + 1);
    }

    @Test
    void disablingCustodyStartsAPlacingRun() {
        int before = placementRunCount();
        client.post().uri("/api/plugin-instances/pi35/disable").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk();
        assertThat(placementRunCount()).isEqualTo(before + 1);
    }

    @Test
    void enablingCustodyStartsAPlacingRun() {
        client.post().uri("/api/plugin-instances/pi35/disable").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk();
        int before = placementRunCount();
        client.post().uri("/api/plugin-instances/pi35/enable").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk();
        assertThat(placementRunCount()).isEqualTo(before + 1);
    }

    @Test
    void deletingCustodyStartsAPlacingRun() {
        int before = placementRunCount();
        client.delete().uri("/api/plugin-instances/pi35").header("Cookie", adminCookie)
                .exchange().expectStatus().isNoContent();
        assertThat(placementRunCount()).isEqualTo(before + 1);
    }

    @Test
    void deletingKeepsRunsAndRemovesSchedules() {
        int runCount = dsl.fetchCount(RUNS, RUNS.INSTANCE_ID.eq("pi4"));
        int scheduleCount = dsl.fetchCount(SCHEDULES, SCHEDULES.INSTANCE_ID.eq("pi4"));
        assertThat(runCount).isPositive();
        assertThat(scheduleCount).isPositive();
        client.delete().uri("/api/plugin-instances/pi4").header("Cookie", adminCookie)
                .exchange().expectStatus().isNoContent();
        assertThat(dsl.fetchCount(RUNS, RUNS.INSTANCE_ID.eq("pi4"))).isEqualTo(runCount);
        assertThat(dsl.fetchCount(SCHEDULES, SCHEDULES.INSTANCE_ID.eq("pi4"))).isZero();
    }

    private JsonNode call(String scenarioName, int index) throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-plugins.json").toFile());
        for (JsonNode scenario : recording.path("scenarios")) {
            if (scenario.path("name").asString().equals(scenarioName)) {
                return scenario.path("calls").get(index);
            }
        }
        throw new IllegalStateException("No plugin recording scenario " + scenarioName);
    }

    private JsonNode send(JsonNode recorded, String cookie) throws Exception {
        String method = recorded.path("method").asString();
        String path = recorded.path("path").asString();
        int status = recorded.path("status").asInt();
        String response;
        if ("GET".equals(method)) {
            response = client.get().uri(path).header("Cookie", cookie).exchange().expectStatus()
                    .isEqualTo(status).expectBody(String.class).returnResult().getResponseBody();
        } else if ("DELETE".equals(method)) {
            response = client.delete().uri(path).header("Cookie", cookie).exchange().expectStatus()
                    .isEqualTo(status).expectBody(String.class).returnResult().getResponseBody();
        } else if ("POST".equals(method)) {
            response = client.post().uri(path).header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                    .body(recorded.has("requestBody") ? recorded.path("requestBody") : Map.of())
                    .exchange().expectStatus().isEqualTo(status).expectBody(String.class)
                    .returnResult().getResponseBody();
        } else {
            response = client.put().uri(path).header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                    .body(recorded.path("requestBody")).exchange().expectStatus().isEqualTo(status)
                    .expectBody(String.class).returnResult().getResponseBody();
        }
        return response == null || response.isBlank() ? mapper.createObjectNode() : body(response);
    }

    private void assertAuditCodes(List<String> expected) throws Exception {
        List<String> codes = new ArrayList<>();
        for (JSONB record : dsl.select(AUDIT_OUTBOX.RECORD).from(AUDIT_OUTBOX)
                .orderBy(AUDIT_OUTBOX.ID).fetch(AUDIT_OUTBOX.RECORD)) {
            assertThat(record.data()).doesNotContain("xoxb-5521-vera", "whsec-a90c", "key-8c2e41b0");
            codes.add(mapper.readTree(record.data()).path("code").asString());
        }
        assertThat(codes).containsExactlyElementsOf(expected);
    }

    private int placementRunCount() {
        return dsl.fetchCount(RUNS, RUNS.WHAT.eq("Placing open proposals again")
                .and(RUNS.CORE_NAME.eq("VERA")));
    }

    private String session(String userId) {
        String cookie = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk()
                .expectHeader().value("Set-Cookie", value -> assertThat(value).contains("vera_session="))
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie");
        return cookie.substring(0, cookie.indexOf(';'));
    }

    private JsonNode body(String value) {
        return mapper.readTree(value);
    }
}

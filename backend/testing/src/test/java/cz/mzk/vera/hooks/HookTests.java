package cz.mzk.vera.hooks;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import java.time.Clock;
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
import tools.jackson.databind.json.JsonMapper;

// HOOK-model; HOOK-retry; HOOK-delivery-states; ACT-hook-save; ACT-hook-pause.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class HookTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private EventRecorder events;
    @Autowired
    private Clock clock;
    @Autowired
    private JsonMapper json;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void hookReadsMatchTheRecording() throws Exception {
        runScenario("reads");
    }

    @Test
    void lifecycleAndDeliveryActsMatchTheRecordingAndWriteConfigurationAudit() throws Exception {
        runScenario("admin-hook-lifecycle-and-delivery-actions");
        assertThat(auditCodes()).contains("hook.created", "hook.changed", "hook.paused", "hook.resumed",
                "hook.deleted");
    }

    @Test
    void hookRefusalsMatchTheRecordingWithoutConfigurationWrites() throws Exception {
        runScenario("hook-refusals");
    }

    @Test
    void retryOfExhaustedDeliveryMatchesTheRecording() throws Exception {
        runScenario("admin-retries-an-exhausted-delivery");
        assertThat(jdbc.queryForObject("SELECT detail FROM hook_attempts WHERE delivery_id='DL-14' "
                + "ORDER BY position DESC LIMIT 1", String.class))
                .isEqualTo("connect ETIMEDOUT ops.internal:443");
    }

    @Test
    void exponentialRetryWaitsOneTwoAndFourMinutesThenGivesUp() throws Exception {
        runScenario("admin-retries-an-exhausted-delivery");
        advanceMinutes(1);
        runJobs();
        assertDelivery("waiting", 2);
        advanceMinutes(2);
        runJobs();
        assertDelivery("waiting", 3);
        advanceMinutes(4);
        runJobs();
        assertDelivery("waiting", 4);
        advanceMinutes(8);
        runJobs();
        assertDelivery("gave_up", 5);
    }

    @Test
    void fixedRetryWaitsFiveMinutes() throws Exception {
        runScenario("admin-retries-an-exhausted-delivery");
        jdbc.update("UPDATE hooks SET retry=?::jsonb WHERE id='H-03'",
                "{\"attempts\":3,\"backoff\":\"fixed\"}");
        advanceMinutes(1);
        runJobs();
        assertDelivery("waiting", 2);
        advanceMinutes(4);
        runJobs();
        assertDelivery("waiting", 2);
        advanceMinutes(1);
        runJobs();
        assertDelivery("gave_up", 3);
    }

    @Test
    void discardOfExhaustedDeliveryMatchesTheRecording() throws Exception {
        runScenario("admin-discards-an-exhausted-delivery");
    }

    @Test
    void recordedListEventMatchesAndSendsThroughTheChannelJob() throws Exception {
        String hookId = createHook("Test list hook", null, "");
        createList("Hook event list");
        runJobs();
        assertThat(jdbc.queryForObject("SELECT state FROM hook_deliveries WHERE hook_id=?", String.class, hookId))
                .isEqualTo("sent");
        assertThat(jdbc.queryForObject("SELECT payload->>'schema' FROM outbox WHERE recipient='#hook-tests'",
                String.class)).isEqualTo("vera.hook/1");
    }

    @Test
    void twoListEventsWithinTheBatchWindowMakeOneDelivery() {
        String hookId = createHook("Batched list hook", Map.of("waitMinutes", 1,
                "maxMinutes", 5, "by", "all"), "");
        createList("First batched list");
        createList("Second batched list");
        runJobs();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM hook_deliveries WHERE hook_id=?", Integer.class, hookId))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT jsonb_array_length(events) FROM hook_deliveries WHERE hook_id=?",
                Integer.class, hookId)).isEqualTo(2);
    }

    @Test
    void pausedHookAndDisabledChannelHoldDeliveriesUntilResumed() {
        String adminCookie = session("u3");
        String hookId = createHook("Held list hook", null, "");
        client.post().uri("/api/hooks/" + hookId + "/pause").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("reason", "test pause"))
                .exchange().expectStatus().isOk();
        createList("List while paused");
        runJobs();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM hook_deliveries WHERE hook_id=?", Integer.class, hookId))
                .isZero();
        client.post().uri("/api/hooks/" + hookId + "/resume").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk();
        jdbc.update("UPDATE plugin_instances SET is_enabled=false WHERE id='pi18'");
        createList("List while channel disabled");
        runJobs();
        assertThat(jdbc.queryForObject("SELECT state FROM hook_deliveries WHERE hook_id=?", String.class, hookId))
                .isEqualTo("waiting");
        assertThat(jdbc.queryForObject("SELECT attempts FROM hook_deliveries WHERE hook_id=?", Integer.class, hookId))
                .isZero();
        jdbc.update("UPDATE plugin_instances SET is_enabled=true WHERE id='pi18'");
        client.post().uri("/api/hooks/" + hookId + "/pause").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("reason", "channel enabled"))
                .exchange().expectStatus().isOk();
        client.post().uri("/api/hooks/" + hookId + "/resume").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk();
        runJobs();
        assertThat(jdbc.queryForObject("SELECT state FROM hook_deliveries WHERE hook_id=?", String.class, hookId))
                .isEqualTo("sent");
    }

    @Test
    void conditionThatDoesNotMatchCreatesNoDelivery() {
        String hookId = createHook("Filtered list hook", null, "category under Periodicals");
        createList("Unrelated list");
        runJobs();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM hook_deliveries WHERE hook_id=?", Integer.class, hookId))
                .isZero();
    }

    @Test
    void userAddressedDeliveryIsSuppressedByRecipientPreference() {
        Map<String, Object> request = jdbc.queryForMap("SELECT id, requester_id FROM requests ORDER BY id LIMIT 1");
        String requestId = (String) request.get("id");
        String requesterId = (String) request.get("requester_id");
        client.patch().uri("/api/session/settings").header("Cookie", session(requesterId))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("notifications",
                        Map.of("doNotSend", true, "hooks", Map.of())))
                .exchange().expectStatus().isOk();
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("name", "User-addressed hook");
        draft.put("events", List.of("request.declined"));
        draft.put("filter", "");
        draft.put("channelId", "pi17");
        draft.put("recipient", "ignored@example.test");
        draft.put("message", "");
        draft.put("batch", null);
        draft.put("retry", Map.of("attempts", 1, "backoff", "fixed"));
        draft.put("recipientPreference", Map.of("label", "Requests", "defaultEnabled", true));
        String hookId = client.post().uri("/api/hooks").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(draft).exchange().expectStatus().isOk()
                .expectBody(JsonNode.class).returnResult().getResponseBody().path("id").asString();
        events.record(new EventInput(EventCode.REQUEST_DECLINED, "request", requestId, null,
                new EventInput.System(), "hook-suppression-test", clock.instant(),
                json.readTree("{\"batchSize\":null}"), null));
        runJobs();
        assertThat(jdbc.queryForObject("SELECT state FROM hook_deliveries WHERE hook_id=?", String.class, hookId))
                .isEqualTo("suppressed");
    }

    private void runScenario(String name) throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-hooks.json").toFile());
        JsonNode scenario = scenario(recording, name);
        assertThat(scenario).as(name).isNotNull();
        Map<String, String> cookies = new HashMap<>();
        for (JsonNode call : scenario.path("calls")) {
            String method = call.path("method").asString();
            String path = call.path("path").asString();
            String user = call.path("as").asString();
            if (path.startsWith("/api/plugin-instances/")) {
                String instanceId = path.substring("/api/plugin-instances/".length(), path.lastIndexOf('/'));
                boolean enabled = path.endsWith("/enable");
                jdbc.update("UPDATE plugin_instances SET is_enabled=? WHERE id=?", enabled, instanceId);
                continue;
            }
            RestTestClient.RequestBodySpec request = client.method(HttpMethod.valueOf(method))
                    .uri(URI.create(path)).header("Cookie", cookies.computeIfAbsent(user, this::session));
            if (call.has("requestBody")) {
                request.contentType(MediaType.APPLICATION_JSON).body(call.path("requestBody").toString());
            }
            var response = request.exchange().expectBody(String.class).returnResult();
            assertThat(response.getStatus().value()).as(name + " " + path).isEqualTo(call.path("status").asInt());
            if (call.has("body")) {
                JsonNode actual = mapper.readTree(response.getResponseBody());
                assertRecording(call.path("body"), actual, name + " " + path);
            }
            if (call.has("code")) {
                JsonNode actual = mapper.readTree(response.getResponseBody());
                assertThat(actual.path("code").asString()).as(name + " " + path)
                        .isEqualTo(call.path("code").asString());
            }
        }
    }

    private JsonNode scenario(JsonNode recording, String name) {
        for (JsonNode item : recording.path("scenarios")) {
            if (name.equals(item.path("name").asString())) {
                return item;
            }
        }
        return null;
    }

    private String session(String userId) {
        var response = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult();
        return response.getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void assertRecording(JsonNode expected, JsonNode actual, String pointer) {
        if (expected.isString() && expected.asString().startsWith("<") && expected.asString().endsWith(">")) {
            return;
        }
        if (expected.isObject()) {
            assertThat(actual.isObject()).as("object at %s", pointer).isTrue();
            assertThat(actual.size()).as("fields at %s", pointer).isEqualTo(expected.size());
            expected.properties().forEach(entry -> assertRecording(entry.getValue(), actual.path(entry.getKey()),
                    pointer + "." + entry.getKey()));
        } else if (expected.isArray()) {
            assertThat(actual.size()).as("array at %s", pointer).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertRecording(expected.get(index), actual.get(index), pointer + "[" + index + "]");
            }
        } else if (expected.isNumber() && actual.isNumber()) {
            assertThat(actual.decimalValue().compareTo(expected.decimalValue())).as("number at %s", pointer).isZero();
        } else {
            assertThat(actual).as("value at %s", pointer).isEqualTo(expected);
        }
    }

    private java.util.List<String> auditCodes() {
        return jdbc.query("SELECT record->>'code' FROM audit_outbox ORDER BY id",
                (row, index) -> row.getString(1));
    }

    private void runJobs() {
        client.post().uri("/_engine/jobs/run").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of()).exchange().expectStatus().isOk();
    }

    private String createHook(String name, Map<String, Object> batch, String filter) {
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("name", name);
        draft.put("events", List.of("list.created"));
        draft.put("filter", filter);
        draft.put("channelId", "pi18");
        draft.put("recipient", "#hook-tests");
        draft.put("message", "");
        draft.put("batch", batch);
        draft.put("retry", Map.of("attempts", 1, "backoff", "fixed"));
        return client.post().uri("/api/hooks").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(draft).exchange().expectStatus().isOk()
                .expectBody(JsonNode.class).returnResult().getResponseBody().path("id").asString();
    }

    private void createList(String name) {
        client.post().uri("/api/digitization-lists").header("Cookie", session("u2"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of(
                        "name", name, "startsOn", "2026-06-29", "endsOn", "2026-06-30",
                        "targetPages", 1, "memberIds", List.of()))
                .exchange().expectStatus().isCreated();
    }

    private void advanceMinutes(int minutes) {
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("advance", Map.of("minutes", minutes))).exchange().expectStatus().isOk();
    }

    private void assertDelivery(String state, int attempts) {
        assertThat(jdbc.queryForObject("SELECT state FROM hook_deliveries WHERE id='DL-14'", String.class))
                .isEqualTo(state);
        assertThat(jdbc.queryForObject("SELECT attempts FROM hook_deliveries WHERE id='DL-14'", Integer.class))
                .isEqualTo(attempts);
    }
}

package cz.mzk.vera.tasks;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// TASK-read; TASK-retention; ACT-run-cancel.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class TasksTests {
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
    private ObjectMapper mapper;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void taskReadsMatchTheBaseTasksRecording() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-tasks.json").toFile());
        for (JsonNode scenario : recording.path("scenarios")) {
            for (JsonNode call : scenario.path("calls")) {
                String method = call.path("method").asString();
                String path = call.path("path").asString();
                if (!method.equals("GET")) {
                    break;
                }
                if (!isTaskRead(path)) {
                    continue;
                }
                String cookie = session(call.path("as").asString());
                var response = client.get().uri(URI.create(path)).header("Cookie", cookie)
                        .exchange().expectBody(String.class).returnResult();
                assertThat(response.getStatus().value()).as(scenario.path("name").asString() + " " + path)
                        .isEqualTo(call.path("status").asInt());
                if (call.has("text")) {
                    assertThat(response.getResponseBody()).as(path).isEqualTo(call.path("text").asString());
                } else {
                    JsonNode actual = mapper.readTree(response.getResponseBody());
                    if (call.path("status").asInt() == 200) {
                        assertJson(call.path("body"), actual, path);
                    } else if (call.path("body").has("detail")) {
                        assertThat(actual.path("detail").asString()).as(path)
                                .isEqualTo(call.path("body").path("detail").asString());
                    }
                }
            }
        }
    }

    @Test
    void indexSupportsEachFilterFacetAndAnInclusiveDayRange() throws Exception {
        JsonNode running = get("/api/tasks?state=Running", "u3");
        assertThat(running.path("running").size()).isEqualTo(2);
        assertThat(get("/api/tasks?trigger=schedule", "u3").path("facets").path("triggers").toString())
                .contains("schedule");
        assertThat(get("/api/tasks?plugin=pi4", "u3").path("facets").path("instanceIds").toString())
                .contains("pi4");
        assertThat(get("/api/tasks?by=u8", "u3").path("facets").path("startedBy").toString())
                .contains("u8");
        JsonNode day = get("/api/tasks?started=2026-06-25..2026-06-25", "u3");
        assertThat(day.path("running").size() + day.path("finished").size()).isEqualTo(6);
        assertThat(get("/api/tasks?q=Kramerius", "u3").path("finished").toString()).contains("Kramerius");
        JsonNode own = get("/api/tasks", "u8");
        assertThat(own.path("visibleCount").asInt()).isEqualTo(2);
        assertThat(own.path("running").get(0).path("id").asString()).isEqualTo("T-9915");
        assertThat(own.path("schedules").isNull()).isTrue();
    }

    @Test
    void seededRunningAndFinishedRunDetailsAndLogsAreStored() throws Exception {
        JsonNode running = get("/api/tasks/T-9916", "u3");
        assertThat(running.path("run").path("doneCount").asInt()).isEqualTo(88);
        assertThat(running.path("items").size()).isEqualTo(6);
        JsonNode runningLog = running.path("log");
        assertThat(runningLog.get(runningLog.size() - 1).path("text").asString()).isEqualTo("… running");
        JsonNode finished = get("/api/tasks/T-9905", "u3");
        assertThat(finished.path("errors").size()).isEqualTo(3);
        JsonNode finishedLog = finished.path("log");
        assertThat(finishedLog.get(finishedLog.size() - 1).path("text").asString())
                .isEqualTo("finished — done with errors");
        JsonNode skipped = get("/api/tasks/T-9914", "u3");
        assertThat(skipped.path("log").size()).isEqualTo(2);
        assertThat(skipped.path("log").get(1).path("text").asString())
                .startsWith("skipped — ");
        String text = client.get().uri("/api/tasks/T-9916/log").header("Cookie", session("u3"))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        assertThat(text).contains("T-9916 started", "… running");
    }

    @Test
    void ordinaryRunsExpireAtDaysAndFailedRunsAtFailedDays() throws Exception {
        int before = get("/api/tasks", "u3").path("visibleCount").asInt();
        jdbc.update("UPDATE runs SET started_at='2026-03-01T00:00:00Z' WHERE id='T-9912'");
        jdbc.update("UPDATE runs SET started_at='2025-07-01T00:00:00Z' WHERE id='T-9897'");
        JsonNode index = get("/api/tasks", "u3");
        assertThat(index.path("visibleCount").asInt()).isEqualTo(before - 1);
        assertThat(client.get().uri("/api/tasks/T-9912").header("Cookie", session("u3"))
                .exchange().expectStatus().isNotFound()).isNotNull();
        assertThat(client.get().uri("/api/tasks/T-9897").header("Cookie", session("u3"))
                .exchange().expectStatus().isOk()).isNotNull();
    }

    @Test
    void retentionActUpdatesTheStoredValueAndRefusesShorterFailureRetention() throws Exception {
        client.put().uri("/api/tasks/retention").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("days", 60, "failedDays", 120))
                .exchange().expectStatus().isOk().expectBody().json("{\"days\":60,\"failedDays\":120}");
        client.put().uri("/api/tasks/retention").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("days", 120, "failedDays", 90))
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.code").isEqualTo("retention.failed_shorter");
        jdbc.update("DELETE FROM role_grants WHERE permission='task.schedule'");
        client.put().uri("/api/tasks/retention").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("days", 60, "failedDays", 120))
                .exchange().expectStatus().isForbidden();
    }

    @Test
    void cancelWritesTheCancelledStateNoteAndLogAndReturnsEachRefusal() throws Exception {
        client.post().uri("/api/tasks/T-9915/cancel").header("Cookie", session("u8"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.state").isEqualTo("Cancelled")
                .jsonPath("$.note").isEqualTo("Stopped after 7 of 12; what it had already done stays.")
                .jsonPath("$.cancelledBy").isEqualTo("u8");
        String log = client.get().uri("/api/tasks/T-9915/log").header("Cookie", session("u8"))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        assertThat(log).contains("cancelled by Kateřina Novotná");
        assertThat(log).contains("7 of 12 processed", "finished — cancelled");
        assertThat(log.split("7 of 12 processed", -1)).hasSize(2);
        client.post().uri("/api/tasks/T-missing/cancel").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isNotFound();
        client.post().uri("/api/tasks/T-9905/cancel").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("task.not_running");
        jdbc.update("DELETE FROM role_grants WHERE permission='task.cancel'");
        client.post().uri("/api/tasks/T-9916/cancel").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isForbidden();
    }

    private boolean isTaskRead(String path) {
        return path.equals("/api/tasks") || path.startsWith("/api/tasks?")
                || path.equals("/api/tasks/running") || path.matches("/api/tasks/[^/]+")
                || path.matches("/api/tasks/[^/]+/log");
    }

    private JsonNode get(String path, String userId) throws Exception {
        String body = client.get().uri(path).header("Cookie", session(userId)).exchange().expectStatus()
                .isOk().expectBody(String.class).returnResult().getResponseBody();
        return mapper.readTree(body);
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void assertJson(JsonNode expected, JsonNode actual, String path) {
        if (expected.isObject()) {
            assertThat(actual.isObject()).as(path).isTrue();
            assertThat(actual.size()).as(path).isEqualTo(expected.size());
            expected.properties().forEach(entry -> assertJson(entry.getValue(), actual.path(entry.getKey()),
                    path + "." + entry.getKey()));
        } else if (expected.isArray()) {
            assertThat(actual.size()).as(path).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertJson(expected.get(index), actual.get(index), path + "[" + index + "]");
            }
        } else if (expected.isNumber() && actual.isNumber()) {
            assertThat(actual.asDouble()).as(path).isEqualTo(expected.asDouble());
        } else {
            assertThat(actual).as(path).isEqualTo(expected);
        }
    }
}

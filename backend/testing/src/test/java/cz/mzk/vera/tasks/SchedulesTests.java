package cz.mzk.vera.tasks;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import org.jooq.DSLContext;
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

// ENT-schedule; L26; ACT-schedule-save; ACT-schedule-pause; ACT-schedule-run.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class SchedulesTests {
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
    private DSLContext dsl;
    @Autowired
    private ScheduleQueue scheduleQueue;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void readsScheduleTimelineLikeTheRecordingIncludingRepeats() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-schedules.json").toFile());
        JsonNode expected = recording.path("scenarios").get(0).path("calls").get(0).path("body");
        JsonNode actual = mapper.readTree(client.get().uri(URI.create("/api/schedules?range=day"))
                .header("Cookie", session("u3")).exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody());
        assertThat(actual).isEqualTo(expected);
        assertThat(actual.path("schedules").get(7).path("source").path("kind").asString())
                .isEqualTo("repeat");
    }

    @Test
    void createsSavesDeletesPausesResumesAndRunsNowWithAuditCodes() throws Exception {
        String created = post("/api/schedules", "{\"instanceId\":\"pi4\",\"name\":\"Daily Kramerius\","
                + "\"cadence\":{\"every\":\"day\",\"at\":\"03:15\"},\"overlap\":\"skip\"}");
        JsonNode row = mapper.readTree(created);
        String id = row.path("id").asString();
        assertThat(row.path("nextAt").asString()).isNotBlank();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM jobs WHERE kind='schedule.fire'", Integer.class))
                .isEqualTo(1);

        String changed = put("/api/schedules/" + id, "{\"name\":\"Daily refreshed\","
                + "\"cadence\":{\"every\":\"day\",\"at\":\"04:15\"},\"overlap\":\"wait\"}");
        assertThat(mapper.readTree(changed).path("name").asString()).isEqualTo("Daily refreshed");
        String paused = post("/api/schedules/" + id + "/pause", "{\"reason\":\"Maintenance\"}");
        assertThat(mapper.readTree(paused).path("nextAt").isNull()).isTrue();
        client.post().uri("/api/schedules/" + id + "/pause").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body("{\"reason\":\"Again\"}")
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.code")
                .isEqualTo("schedule.already_paused");
        client.post().uri("/api/schedules/" + id + "/run").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.trigger.kind").isEqualTo("manual")
                .jsonPath("$.trigger.from.label").isEqualTo("Schedules");
        post("/api/schedules/" + id + "/resume", "{}");
        client.post().uri("/api/schedules/" + id + "/resume").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("schedule.not_paused");
        client.delete().uri("/api/schedules/" + id).header("Cookie", session("u3"))
                .exchange().expectStatus().isNoContent();
        assertThat(jdbc.queryForList("SELECT record->>'code' FROM audit_outbox ORDER BY id", String.class))
                .contains("schedule.created", "schedule.changed", "schedule.paused", "schedule.resumed",
                        "schedule.deleted");
    }

    @Test
    void refusesInvalidCadencesAndUnSchedulablePlugins() {
        String prefix = "{\"instanceId\":\"%s\",\"name\":\"Attempt\",\"cadence\":%s,"
                + "\"overlap\":\"skip\"}";
        client.post().uri("/api/schedules").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(prefix.formatted("pi4", "{\"every\":\"quarter\",\"at\":\"00:00\"}"))
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.code")
                .isEqualTo("schedule.quarterly_not_allowed");
        client.post().uri("/api/schedules").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(prefix.formatted("pi4", "{\"every\":\"minutes\",\"interval\":1}"))
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.code")
                .isEqualTo("schedule.too_often");
        client.post().uri("/api/schedules").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(prefix.formatted("pi24", "{\"every\":\"day\",\"at\":\"03:00\"}"))
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.code")
                .isEqualTo("schedule.not_schedulable");
        client.put().uri("/api/schedules/s2").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Attempt\",\"cadence\":{\"every\":\"minutes\",\"interval\":1},"
                        + "\"overlap\":\"skip\"}")
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.code")
                .isEqualTo("schedule.too_often");
        client.put().uri("/api/schedules/s2").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Attempt\",\"cadence\":{\"every\":\"quarter\",\"at\":\"00:00\"},"
                        + "\"overlap\":\"skip\"}")
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.code")
                .isEqualTo("schedule.quarterly_not_allowed");
    }

    @Test
    void scheduleRunNowCountsOnlyDocumentsStillInPlay() {
        client.post().uri("/api/schedules/s3/run").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.itemCount").isEqualTo(41);
    }

    @Test
    void refusesUnknownSchedulesAndPeopleWithoutTheNeededPermission() {
        client.post().uri("/api/schedules").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"instanceId\":\"missing\",\"name\":\"Attempt\","
                        + "\"cadence\":{\"every\":\"day\",\"at\":\"03:00\"},\"overlap\":\"skip\"}")
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.code")
                .isEqualTo("schedule.not_schedulable");
        client.post().uri("/api/schedules/missing/pause").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body("{\"reason\":\"No schedule\"}")
                .exchange().expectStatus().isNotFound();
        client.delete().uri("/api/schedules/missing").header("Cookie", session("u3"))
                .exchange().expectStatus().isNotFound();
        client.post().uri("/api/schedules").header("Cookie", session("u8"))
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"instanceId\":\"pi4\",\"name\":\"Attempt\","
                        + "\"cadence\":{\"every\":\"day\",\"at\":\"03:00\"},\"overlap\":\"skip\"}")
                .exchange().expectStatus().isForbidden();
        client.post().uri("/api/schedules/s1/run").header("Cookie", session("u8"))
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
    }

    @Test
    void scheduleFireStartsARunAndQueuesItsNextOccurrence() {
        queueSeededSchedule("s3");
        moveClock("2026-06-25T10:00:00Z");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM runs WHERE trigger->>'scheduleId'='s3' "
                + "AND started_at='2026-06-25T10:00:00Z'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM jobs WHERE kind='schedule.fire' "
                + "AND payload->>'scheduleId'='s3' AND due_at='2026-06-25T16:00:00Z'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void stalePausedScheduleFireDoesNothingAndResumeQueuesTheNextOne() {
        queueSeededSchedule("s3");
        client.post().uri("/api/schedules/s3/pause").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body("{\"reason\":\"Hold\"}")
                .exchange().expectStatus().isOk();
        moveClock("2026-06-25T10:00:00Z");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM runs WHERE trigger->>'scheduleId'='s3' "
                + "AND started_at='2026-06-25T10:00:00Z'", Integer.class)).isZero();
        post("/api/schedules/s3/resume", "{}");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM jobs WHERE kind='schedule.fire' "
                + "AND payload->>'scheduleId'='s3' AND due_at='2026-06-25T16:00:00Z'", Integer.class))
                .isEqualTo(1);
        moveClock("2026-06-25T16:00:00Z");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM runs WHERE trigger->>'scheduleId'='s3' "
                + "AND started_at='2026-06-25T16:00:00Z'", Integer.class)).isEqualTo(1);
    }

    @Test
    void skipOverlapWritesSkippedRunAndWaitAllowsTheRun() {
        queueSeededSchedule("s2");
        queueSeededSchedule("s4");
        moveClock("2026-06-25T09:00:00Z");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM runs WHERE trigger->>'scheduleId'='s2' "
                + "AND started_at='2026-06-25T09:00:00Z' AND state='Skipped' "
                + "AND note='The previous run was still going.'", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM run_log WHERE run_id IN "
                + "(SELECT id FROM runs WHERE trigger->>'scheduleId'='s2' "
                + "AND started_at='2026-06-25T09:00:00Z') AND text='skipped — "
                + "The previous run was still going.'", Integer.class)).isEqualTo(1);

        jdbc.update("UPDATE schedules SET overlap='wait' WHERE id='s4'");
        jdbc.update("UPDATE runs SET state='Running',finished_at=NULL WHERE id='T-9905'");
        jdbc.update("UPDATE runs SET state='Done',finished_at='2026-06-25T08:41:00Z' WHERE id='T-9915'");
        moveClock("2026-06-26T00:00:00Z");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM runs WHERE trigger->>'scheduleId'='s4' "
                + "AND started_at='2026-06-26T00:00:00Z'", Integer.class)).isZero();
        jdbc.update("UPDATE runs SET state='DoneWithErrors',finished_at='2026-06-25T00:21:40Z' "
                + "WHERE id='T-9905'");
        moveClock("2026-06-26T00:01:00Z");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM runs WHERE trigger->>'scheduleId'='s4' "
                + "AND started_at='2026-06-26T00:01:00Z'", Integer.class)).isEqualTo(1);
    }

    @Test
    void dailyScheduleKeepsItsWallClockTimeAcrossDaylightSaving() throws Exception {
        jdbc.update("DELETE FROM jobs WHERE kind='schedule.fire'");
        jdbc.update("DELETE FROM schedules");
        jdbc.update("UPDATE runs SET state='Done',finished_at='2026-06-25T08:41:00Z' WHERE id='T-9916'");
        moveClock("2026-10-24T04:15:00Z");
        String row = post("/api/schedules", "{\"instanceId\":\"pi4\",\"name\":\"DST test\","
                + "\"cadence\":{\"every\":\"day\",\"at\":\"06:15\"},\"overlap\":\"wait\"}");
        String id = mapper.readTree(row).path("id").asString();
        moveClock("2026-10-25T05:15:00Z");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM runs WHERE trigger->>'scheduleId'=? "
                + "AND started_at='2026-10-25T05:15:00Z'", Integer.class, id)).isEqualTo(1);
    }

    private String post(String path, String body) {
        return client.post().uri(path).header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody();
    }

    private String put(String path, String body) {
        return client.put().uri(path).header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody();
    }

    private String session(String userId) {
        String header = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk()
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie");
        return header.substring(0, header.indexOf(';'));
    }

    private void moveClock(String at) {
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("at", at, "frozen", true)).exchange().expectStatus().isOk();
    }

    private void queueSeededSchedule(String id) {
        String cadence = jdbc.queryForObject("SELECT cadence::text FROM schedules WHERE id=?", String.class, id);
        scheduleQueue.queue(dsl, id, scheduleQueue.cadence(cadence), Instant.parse("2026-06-25T08:40:00Z"));
    }
}

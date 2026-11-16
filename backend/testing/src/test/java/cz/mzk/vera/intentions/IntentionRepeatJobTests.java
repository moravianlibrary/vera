package cz.mzk.vera.intentions;

import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.util.Map;
import java.util.LinkedHashMap;
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
import tools.jackson.databind.ObjectMapper;

// LC-INT-repeat; LC-INT-archive. Jobs execute only through the backend testing control route.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class IntentionRepeatJobTests {
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
    private RepeatQueue repeatQueue;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
        var nextOn = dsl.select(INTENTION_TEMPLATES.NEXT_ON)
                .from(INTENTION_TEMPLATES)
                .where(INTENTION_TEMPLATES.ID.eq("t1"))
                .fetchOne(INTENTION_TEMPLATES.NEXT_ON);
        repeatQueue.queue(dsl, "t1", nextOn);
    }

    @Test
    void monthlyJobMakesTheOccurrenceArchivesItsPreviousAndQueuesTheNext() {
        moveClock("2026-07-01T00:00:00+02:00");
        runJobs();

        assertThat(jdbc.queryForMap("SELECT name, description, counts_from, ends_on, distribution_id, "
                        + "template_id FROM intentions WHERE template_id='t1' AND counts_from='2026-07-01'"))
                .containsEntry("name", "Měsíční výstup — July 2026")
                .containsEntry("description", "What the scanning room should deliver this month.")
                .containsEntry("counts_from", java.sql.Date.valueOf("2026-07-01"))
                .containsEntry("ends_on", java.sql.Date.valueOf("2026-07-31"))
                .containsEntry("distribution_id", "d1")
                .containsEntry("template_id", "t1");
        assertThat(jdbc.queryForObject(
                "SELECT archived_actor_kind FROM intentions WHERE id='i6'", String.class))
                .isEqualTo("system");
        assertThat(jdbc.queryForObject(
                "SELECT record->'actor'->>'kind' FROM audit_outbox "
                        + "WHERE record->>'code'='intention.archived' ORDER BY at DESC LIMIT 1",
                String.class)).isEqualTo("system");
        assertThat(jdbc.queryForObject(
                "SELECT record->'actor'->>'kind' FROM audit_outbox "
                        + "WHERE record->>'code'='intention.created' ORDER BY at DESC LIMIT 1",
                String.class)).isEqualTo("system");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM archived_intention_snapshots WHERE intention_id='i6'", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT next_on FROM intention_templates WHERE id='t1'", java.sql.Date.class))
                .isEqualTo(java.sql.Date.valueOf("2026-08-01"));
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM jobs WHERE kind='intention.repeat' AND state='due' "
                        + "AND payload->>'nextOn'='2026-08-01'", Integer.class)).isEqualTo(1);
    }

    @Test
    void repeatWriteKeepsBothNamePatterns() throws Exception {
        var response = client.post().uri("/api/intention-templates")
                .header("Cookie", session("u3")).header("Accept-Language", "cs")
                .contentType(MediaType.APPLICATION_JSON)
                .body(templateBody("Monthly output — {period}", "month", true))
                .exchange().expectStatus().isCreated().expectBody(String.class).returnResult().getResponseBody();
        var template = new ObjectMapper().readTree(response).path("template");
        assertThat(template.path("namePatterns").path("cs").asString())
                .isEqualTo("Měsíční výstup — {period}");
        assertThat(template.path("namePatterns").path("en").asString())
                .isEqualTo("Monthly output — {period}");
    }

    @Test
    void monthlyJobIsNotDueBeforeMidnightInPrague() {
        moveClock("2026-06-30T23:59:00+02:00");
        runJobs();

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM intentions WHERE template_id='t1' AND counts_from='2026-07-01'",
                Integer.class)).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT archived_at FROM intentions WHERE id='i6'", java.sql.Timestamp.class)).isNull();
    }

    @Test
    void lateJobMakesOnlyTheCurrentPeriodOccurrence() {
        moveClock("2026-09-10T00:00:00+02:00");
        runJobs();

        assertThat(jdbc.queryForObject(
                "SELECT name FROM intentions WHERE template_id='t1' AND counts_from='2026-09-01'",
                String.class)).isEqualTo("Měsíční výstup — September 2026");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM intentions WHERE template_id='t1' AND counts_from IN "
                        + "('2026-07-01', '2026-08-01')", Integer.class)).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM intentions WHERE id='i6' AND archived_at IS NOT NULL", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT next_on FROM intention_templates WHERE id='t1'", java.sql.Date.class))
                .isEqualTo(java.sql.Date.valueOf("2026-10-01"));
    }

    @Test
    void weeklyAndQuarterlyRepeatsCreatedThroughTheActUseTheirFirstPeriodBounds() {
        createRepeat("Weekly — {period}", "week");
        createRepeat("Quarterly — {period}", "quarter");
        moveClock("2026-07-01T00:00:00+02:00");
        runJobs();

        assertThat(jdbc.queryForObject(
                "SELECT name FROM intentions WHERE template_id='t2'", String.class))
                .isEqualTo("Týdně — Week 27, 2026");
        assertThat(jdbc.queryForObject(
                "SELECT counts_from || '/' || ends_on FROM intentions WHERE template_id='t2'", String.class))
                .isEqualTo("2026-06-29/2026-07-05");
        assertThat(jdbc.queryForObject(
                "SELECT name FROM intentions WHERE template_id='t3'", String.class))
                .isEqualTo("Čtvrtletně — Q3 2026");
        assertThat(jdbc.queryForObject(
                "SELECT counts_from || '/' || ends_on FROM intentions WHERE template_id='t3'", String.class))
                .isEqualTo("2026-07-01/2026-09-30");
    }

    @Test
    void savingANewPeriodMakesThePreviouslyQueuedJobStale() {
        saveTemplate("week", true);
        assertThat(jdbc.queryForObject(
                "SELECT next_on FROM intention_templates WHERE id='t1'", java.sql.Date.class))
                .isEqualTo(java.sql.Date.valueOf("2026-06-29"));
        moveClock("2026-07-01T00:00:00+02:00");
        runJobs();

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM intentions WHERE template_id='t1' AND counts_from='2026-06-29'",
                Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM intentions WHERE template_id='t1' AND counts_from='2026-07-01'",
                Integer.class)).isZero();
    }

    @Test
    void repeatConfiguredNotToArchiveKeepsThePreviousOccurrenceOpen() {
        saveTemplate("month", false);
        moveClock("2026-07-01T00:00:00+02:00");
        runJobs();

        assertThat(jdbc.queryForObject(
                "SELECT archived_at FROM intentions WHERE id='i6'", java.sql.Timestamp.class)).isNull();
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM intentions WHERE template_id='t1' AND archived_at IS NULL",
                Integer.class)).isEqualTo(2);
    }

    @Test
    void anExistingOccurrenceForThePeriodIsNotWrittenTwiceButTheRepeatMovesOn() {
        jdbc.update("INSERT INTO intentions (id, name, description, funding_kind, funding_project_id, "
                + "scope_category_id, scope_conditions, counts_from, ends_on, target_pages, distribution_id, "
                + "mix_revision, is_overall, position, template_id) SELECT 'i99', 'Existing July occurrence', "
                + "description, funding_kind, funding_project_id, scope_category_id, scope_conditions, "
                + "'2026-07-01', '2026-07-31', target_pages, distribution_id, mix_revision, false, 999, 't1' "
                + "FROM intentions WHERE id='i6'");
        moveClock("2026-07-01T00:00:00+02:00");
        runJobs();

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM intentions WHERE template_id='t1' AND counts_from='2026-07-01'",
                Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT next_on FROM intention_templates WHERE id='t1'", java.sql.Date.class))
                .isEqualTo(java.sql.Date.valueOf("2026-08-01"));
    }

    private void createRepeat(String namePattern, String every) {
        client.post().uri("/api/intention-templates")
                .header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(templateBody(namePattern, every, true))
                .exchange()
                .expectStatus().isCreated();
    }

    private void saveTemplate(String every, boolean archives) {
        client.put().uri("/api/intention-templates/t1")
                .header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(templateBody("Monthly output — {period}", every, archives))
                .exchange()
                .expectStatus().isOk();
    }

    private Map<String, Object> templateBody(String pattern, String every, boolean archives) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("description", "What the scanning room should deliver this month.");
        body.put("namePatterns", Map.of("cs", pattern.replace("Weekly", "Týdně").replace("Quarterly", "Čtvrtletně")
                        .replace("Monthly output", "Měsíční výstup"),
                "en", pattern));
        body.put("every", every);
        body.put("funding", Map.of("kind", "any"));
        body.put("scopeCategoryId", null);
        body.put("mix", Map.of("kind", "primary"));
        body.put("targetPages", 3000);
        body.put("isArchivingPrevious", archives);
        return body;
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .returnResult()
                .getResponseHeaders()
                .getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void moveClock(String at) {
        client.post().uri("/_engine/clock")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("at", java.time.OffsetDateTime.parse(at).toInstant().toString()))
                .exchange().expectStatus().isOk();
    }

    private void runJobs() {
        client.post().uri("/_engine/jobs/run")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of())
                .exchange().expectStatus().isOk();
    }
}

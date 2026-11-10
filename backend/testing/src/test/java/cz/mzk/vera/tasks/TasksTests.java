package cz.mzk.vera.tasks;

import static org.assertj.core.api.Assertions.assertThat;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_LINKS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_CURSORS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.RUNS;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.fakes.FakeRecords;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import cz.mzk.vera.tasks.Runs;
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
    @Autowired
    private Runs runs;
    @Autowired
    private FakeRecords fakeRecords;

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

    @Test
    void failedRegistryRunAgainWorksItsFixedSetInChunks() throws Exception {
        String runId = startAgain("Registry");
        JsonNode initial = get("/api/tasks/" + runId, "u3");
        int itemCount = initial.path("run").path("itemCount").asInt();
        assertThat(itemCount).isGreaterThan(25);
        jdbc.update("INSERT INTO run_targets(run_id,position,document_id,iteration_id) "
                        + "SELECT ?, ? + extra.n - 1, seed.document_id, seed.iteration_id "
                        + "FROM generate_series(1, ?) extra(n) CROSS JOIN (SELECT document_id,iteration_id "
                        + "FROM run_targets WHERE run_id=? ORDER BY position LIMIT 1) seed",
                runId, itemCount, 75 - itemCount, runId);
        jdbc.update("UPDATE runs SET item_count=75 WHERE id=?", runId);
        assertThat(initial.path("run").path("state").asString()).isEqualTo("Running");
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
        JsonNode afterFirstChunk = get("/api/tasks/" + runId, "u3");
        assertThat(afterFirstChunk.path("run").path("doneCount").asInt()).isEqualTo(25);
        assertThat(jdbc.queryForObject("SELECT items_per_minute FROM runs WHERE id=?", Double.class, runId))
                .isNull();
        assertThat(afterFirstChunk.path("run").path("secondsLeft").isNull()).isTrue();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"minutes\":1}}")
                .exchange().expectStatus().isOk();
        JsonNode afterSecondChunk = get("/api/tasks/" + runId, "u3");
        assertThat(afterSecondChunk.path("run").path("doneCount").asInt()).isEqualTo(50);
        assertThat(jdbc.queryForObject("SELECT items_per_minute FROM runs WHERE id=?", Double.class, runId))
                .isEqualTo(50);
        assertThat(afterSecondChunk.path("run").path("secondsLeft").asInt()).isPositive();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"minutes\":1}}")
                .exchange().expectStatus().isOk();
        JsonNode finished = get("/api/tasks/" + runId, "u3");
        assertThat(finished.path("run").path("state").asString()).isEqualTo("Done");
        assertThat(finished.path("run").path("doneCount").asInt()).isEqualTo(75);
        assertThat(finished.path("run").path("changes").get(0).path("label").asString())
                .contains("registry states");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM document_registry_records", Integer.class))
                .isGreaterThan(0);
        assertThat(jdbc.queryForObject("SELECT items_per_minute FROM runs WHERE id=?", Double.class, runId))
                .isPositive();
    }

    @Test
    void validationRunStoresDefects() throws Exception {
        String runId = startAgain("Validation");
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
        JsonNode finished = finishRun(runId);
        assertThat(finished.path("run").path("state").asString()).isIn("Done", "DoneWithErrors");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM iteration_defects", Integer.class))
                .isGreaterThan(0);
    }

    @Test
    void propertySourceRunWritesValuesForItsMissingPropertySet() throws Exception {
        String runId = startAgain("PropertySource");
        int itemCount = get("/api/tasks/" + runId, "u3").path("run").path("itemCount").asInt();
        assertThat(itemCount).isGreaterThan(0);
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
        JsonNode finished = finishRun(runId);
        assertThat(finished.path("run").path("doneCount").asInt()).isEqualTo(itemCount);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM iteration_property_sources", Integer.class))
                .isGreaterThan(0);
    }

    @Test
    void unavailableInstanceFailsTheRun() throws Exception {
        String runId = startAgain("Registry");
        String instanceId = jdbc.queryForObject("SELECT instance_id FROM runs WHERE id=?", String.class, runId);
        jdbc.update("UPDATE plugin_implementations SET descriptor_id='missing-test-plugin' "
                + "WHERE id=(SELECT implementation_id FROM plugin_instances WHERE id=?)", instanceId);
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
        JsonNode failed = get("/api/tasks/" + runId, "u3");
        assertThat(failed.path("run").path("state").asString()).isEqualTo("Failed");
        assertThat(failed.path("run").path("failure").asString()).isEqualTo("The source did not answer.");
    }

    @Test
    void switchedOffInstanceFailsWithThePluginMessage() throws Exception {
        String runId = startAgain("Registry");
        String instanceId = jdbc.queryForObject("SELECT instance_id FROM runs WHERE id=?", String.class, runId);
        jdbc.update("UPDATE plugin_instances SET is_enabled=false WHERE id=?", instanceId);
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
        JsonNode failed = get("/api/tasks/" + runId, "u3");
        assertThat(failed.path("run").path("state").asString()).isEqualTo("Failed");
        assertThat(failed.path("run").path("failure").asString()).isEqualTo("The plugin was switched off.");
    }

    @Test
    void catalogSyncKeepsPagesRechecksHeldDocumentsResumesAndDoesNotAdvanceOnFailure() throws Exception {
        declareOperation("pi1", "sync");
        fakeRecords.failCatalogPage("pi1", 1);
        String firstRun = startPluginRun("pi1", "Catalog sync");
        runOneJob();
        assertThat(jdbc.queryForObject("SELECT cursor FROM plugin_cursors WHERE instance_id='pi1' "
                + "AND operation='sync'", String.class)).isEqualTo("1");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM catalog_mirror WHERE instance_id='pi1'", Integer.class))
                .isGreaterThan(0);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM events WHERE subject_kind='iteration' "
                + "AND subject_id='IT8' AND code='iteration.rechecked'", Integer.class)).isGreaterThan(0);
        JsonNode failed = finishRun(firstRun);
        assertThat(failed.path("run").path("state").asString()).isEqualTo("Failed");
        assertThat(jdbc.queryForObject("SELECT cursor FROM plugin_cursors WHERE instance_id='pi1' "
                + "AND operation='sync'", String.class)).isEqualTo("1");

        fakeRecords.clearCatalogFailure("pi1");
        String resumedRun = startPluginRun("pi1", "Catalog sync again");
        JsonNode done = finishRun(resumedRun);
        assertThat(done.path("run").path("state").asString()).isEqualTo("Done");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM catalog_mirror WHERE instance_id='pi1'", Integer.class))
                .isGreaterThan(2);
    }

    @Test
    void catalogChangesOnlyRechecksHeldDocumentsAmongChanges() throws Exception {
        declareOperation("pi1", "changes");
        String runId = startPluginRun("pi1", "Catalog changes");
        JsonNode done = finishRun(runId);
        assertThat(done.path("run").path("state").asString()).isEqualTo("Done");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM plugin_cursors WHERE instance_id='pi1' "
                + "AND operation='changes'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM events WHERE subject_kind='iteration' "
                + "AND subject_id='IT8' AND code='iteration.rechecked'", Integer.class)).isGreaterThan(0);
    }

    @Test
    void pi8HarvestProposesAsItsAgentAndPi29EmptyHarvestFinishesWithNoItems() throws Exception {
        String harvestRun = startPluginRun("pi8", "Periodical gaps");
        JsonNode harvested = finishRun(harvestRun);
        assertThat(harvested.path("run").path("state").asString()).isIn("Done", "DoneWithErrors");
        assertThat(jdbc.queryForObject("SELECT cursor FROM plugin_cursors WHERE instance_id='pi8' "
                + "AND operation='harvest'", String.class)).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM plugin_cursors WHERE instance_id='pi8' "
                + "AND operation='harvest'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT item_count FROM runs WHERE id=?", Integer.class, harvestRun))
                .isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT done_count FROM runs WHERE id=?", Integer.class, harvestRun))
                .isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM batches WHERE submitted_by="
                + "(SELECT id FROM users WHERE kind='agent' AND name='Periodical gaps')", Integer.class))
                .isGreaterThan(0);

        String emptyRun = startPluginRun("pi29", "Kramerius sweep");
        JsonNode empty = finishRun(emptyRun);
        assertThat(empty.path("run").path("state").asString()).isEqualTo("Done");
        assertThat(empty.path("run").path("itemCount").asInt()).isZero();
        assertThat(empty.path("run").path("doneCount").asInt()).isZero();
    }

    @Test
    void pi33AddsDetectedLinksAsA3WithHistoryAndDoesNotRemoveOrRepeatThem() throws Exception {
        List<String> linksBefore = jdbc.queryForList("SELECT id FROM iteration_links", String.class);
        String firstRun = startPluginRun("pi33", "Publication detection");
        JsonNode first = finishRun(firstRun);
        assertThat(first.path("run").path("state").asString()).isEqualTo("Done");
        List<String> linksAfterFirst = jdbc.queryForList("SELECT id FROM iteration_links", String.class);
        assertThat(linksAfterFirst).containsAll(linksBefore).hasSizeGreaterThan(linksBefore.size());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM iteration_links WHERE set_by='a3'", Integer.class))
                .isGreaterThan(0);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM events WHERE code IN "
                + "('iteration.published','iteration.link_added') AND actor->>'userId'='a3'", Integer.class))
                .isGreaterThan(0);
        int linksAfter = linksAfterFirst.size();

        JsonNode second = finishRun(startPluginRun("pi33", "Publication detection again"));
        assertThat(second.path("run").path("state").asString()).isEqualTo("Done");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM iteration_links", Integer.class)).isEqualTo(linksAfter);
    }

    @Test
    void placingRunReappliesPlacementsToEveryOpenProposal() throws Exception {
        int open = jdbc.queryForObject("SELECT count(*) FROM requests WHERE decision='Pending'", Integer.class);
        String requestId = jdbc.queryForObject("SELECT id FROM requests WHERE decision='Pending' "
                + "ORDER BY at,id LIMIT 1", String.class);
        jdbc.update("DELETE FROM request_placements WHERE request_id=?", requestId);
        // Runs.startPlacing is the small test-only path; the worker itself is reached over HTTP.
        String runId = runs.startPlacing("u3", Map.of("label", "Custody", "path", "/access"));
        assertThat(jdbc.queryForObject("SELECT item_count FROM runs WHERE id=?", Integer.class, runId)).isEqualTo(open);
        JsonNode done = finishRun(runId);
        assertThat(jdbc.queryForObject("SELECT core_name FROM runs WHERE id=?", String.class, runId))
                .isEqualTo("VERA");
        assertThat(done.path("run").path("state").asString()).isEqualTo("Done");
        assertThat(done.path("run").path("doneCount").asInt()).isEqualTo(open);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM request_placements WHERE request_id=?", Integer.class,
                requestId)).isGreaterThan(0);
    }

    private String startPluginRun(String instanceId, String what) {
        return runs.start(what, instanceId, null,
                Map.of("kind", "manual", "from", Map.of("label", "Plugins", "path", "/plugins")),
                "u3", null);
    }

    private void declareOperation(String instanceId, String operation) {
        jdbc.update("UPDATE plugin_implementations SET versions=jsonb_set(versions, "
                + "'{0,declares,operations}', to_jsonb(ARRAY[?]::text[])) WHERE id="
                + "(SELECT implementation_id FROM plugin_instances WHERE id=?)", operation, instanceId);
    }

    private void runOneJob() {
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
    }

    @Test
    void recordedCatalogRerunStartsWithAnEmptySet() throws Exception {
        JsonNode started = mapper.readTree(client.post().uri("/api/tasks/T-9897/rerun")
                .header("Cookie", session("u3")).contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        assertThat(started.path("id").asString()).isEqualTo("T-9917");
        assertThat(started.path("itemCount").asInt()).isZero();
        assertThat(started.path("doneCount").asInt()).isZero();
        assertThat(started.path("secondsLeft").isNull()).isTrue();
        assertThat(started.path("rerunOf").asString()).isEqualTo("T-9897");
    }

    @Test
    void cancelledRunStopsAtTheNextChunk() throws Exception {
        String runId = startAgain("Registry");
        jdbc.update("UPDATE runs SET state='Cancelled', finished_at='2026-06-25T08:40:00Z' WHERE id=?", runId);
        int before = jdbc.queryForObject("SELECT count(*) FROM document_registry_records", Integer.class);
        jdbc.update("INSERT INTO jobs(kind,due_at,state,attempt,payload) "
                        + "VALUES ('plugin.run','2026-06-25T08:40:00Z','due',0,?::jsonb)",
                "{\"runId\":\"" + runId + "\",\"offset\":25}");
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM document_registry_records", Integer.class))
                .isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT state FROM runs WHERE id=?", String.class, runId))
                .isEqualTo("Cancelled");
    }

    @Test
    void rerunReturnsNotFoundForMissingRun() {
        client.post().uri("/api/tasks/not-there/rerun").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isNotFound();
    }

    @Test
    void rerunRefusesCoreRuns() {
        client.post().uri("/api/tasks/T-9905/rerun").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.code").isEqualTo("task.not_rerunnable");
    }

    @Test
    void rerunRefusesWhenCallerCannotRunThePlugin() {
        String id = insertFailedRun("Registry");
        jdbc.update("DELETE FROM role_grants WHERE permission='plugin.run'");
        client.post().uri("/api/tasks/" + id + "/rerun").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isForbidden();
    }

    private String startAgain(String kind) throws Exception {
        String failedId = insertFailedRun(kind);
        String body = client.post().uri("/api/tasks/" + failedId + "/rerun")
                .header("Cookie", session("u3")).contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        JsonNode started = mapper.readTree(body);
        assertThat(started.path("rerunOf").asString()).isEqualTo(failedId);
        return started.path("id").asString();
    }

    private JsonNode finishRun(String runId) throws Exception {
        JsonNode found = get("/api/tasks/" + runId, "u3");
        for (int chunk = 0; chunk < 10 && "Running".equals(found.path("run").path("state").asString()); chunk++) {
            client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                    .body("{\"advance\":{\"minutes\":1}}")
                    .exchange().expectStatus().isOk();
            found = get("/api/tasks/" + runId, "u3");
        }
        return found;
    }

    private String insertFailedRun(String kind) {
        String instanceId = jdbc.queryForObject("SELECT pi.id FROM plugin_instances pi "
                        + "JOIN plugin_implementations p ON p.id=pi.implementation_id "
                        + "WHERE p.kind=? AND pi.is_enabled AND NOT pi.is_deleted ORDER BY pi.position LIMIT 1",
                String.class, kind);
        String id = "T-99999";
        jdbc.update("INSERT INTO runs(id,what,instance_id,trigger,started_by,state,started_at,item_count,done_count,"
                        + "changes,failure) VALUES(?, 'BK7d test run', ?, '{\"kind\":\"manual\",\"from\":{"
                        + "\"label\":\"Tasks\",\"path\":\"/tasks\"}}'::jsonb, 'u1', 'Failed', "
                        + "'2026-06-25T08:00:00Z', 0, 0, '[]'::jsonb, 'Plugin did not answer')",
                id, instanceId);
        return id;
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

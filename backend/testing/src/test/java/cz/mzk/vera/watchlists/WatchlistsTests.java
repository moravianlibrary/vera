package cz.mzk.vera.watchlists;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.jobs.Jobs;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.time.OffsetDateTime;
import java.util.concurrent.atomic.AtomicInteger;
import org.jooq.DSLContext;
import org.jooq.ExecuteContext;
import org.jooq.ExecuteListener;
import org.jooq.ExecuteListenerProvider;
import org.jooq.impl.DefaultExecuteListenerProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// WATCH-model; WATCH-audience; WATCH-delivery; WATCH-push.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class WatchlistsTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private DSLContext dsl;
    @Autowired
    private WatchlistManageLinks manageLinks;
    @Autowired
    private WatchlistQueries watchlists;
    @Autowired
    private EventRecorder events;
    @Autowired
    private Jobs jobs;
    @Autowired
    private JsonMapper json;

    @BeforeEach
    void reset() {
        client.post().uri("/_engine/reset").contentType(MediaType.APPLICATION_JSON)
                .body("{\"seed\":\"base\",\"frozen\":true}")
                .exchange().expectStatus().isOk();
    }

    @Test
    void readsSeededWatchlistsAndDeliveryChannelsForCurator() {
        String cookie = session("u3");
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo("W-shared-1")
                .jsonPath("$[0].viewer.push").isEqualTo(true);
        client.get().uri("/api/session/watchlist-channels").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo("pi16")
                .jsonPath("$[0].canReach").isEqualTo(true)
                .jsonPath("$[2].reach.claim").isEqualTo("slack_id")
                .jsonPath("$[2].canReach").isEqualTo(true);
        client.get().uri("/api/session/push-devices").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.deviceCount").isEqualTo(0);
    }

    @Test
    void administratorReadsItsSharedWatchlistsAgainstDocumentQueries() {
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, session("u2"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo("W-shared-1")
                .jsonPath("$[1].itemCount").isEqualTo(2)
                .jsonPath("$[2].itemCount").isEqualTo(10)
                .jsonPath("$[3].itemCount").isEqualTo(9)
                .jsonPath("$[4].itemCount").isEqualTo(2);
    }

    @Test
    void claimBasedDeliveryReportsUnreachableWhenIdentityHasNoClaim() {
        jdbc.update("UPDATE user_identities SET claims = '{}' WHERE user_id = 'u3'");
        client.get().uri("/api/session/watchlist-channels").header(HttpHeaders.COOKIE, session("u3"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[2].canReach").isEqualTo(false)
                .jsonPath("$[2].reach.claim").isEqualTo("slack_id");
    }

    @Test
    void registersPushDeviceIdempotentlyForItsOwner() {
        String cookie = session("u3");
        String body = "{\"endpoint\":\"https://push.example/device-a\","
                + "\"keys\":{\"p256dh\":\"key\",\"auth\":\"secret\"}}";
        client.post().uri("/api/session/push-devices").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.deviceCount").isEqualTo(1);
        client.post().uri("/api/session/push-devices").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.deviceCount").isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM push_devices WHERE user_id='u3'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void manageLinkIsSignedForItsPersonAndWatchlist() {
        String token = manageLinks.issue("u3", "W-u3-documents-1");
        WatchlistManageLinks.Link verified = manageLinks.verify(token);

        assertThat(verified).isNotNull();
        assertThat(verified.userId()).isEqualTo("u3");
        assertThat(verified.watchlistId()).isEqualTo("W-u3-documents-1");
    }

    @Test
    void tamperedManageLinkIsRefused() {
        String token = manageLinks.issue("u3", "W-u3-documents-1");
        String tampered = token.substring(0, token.length() - 1) + (token.endsWith("A") ? "B" : "A");

        assertThat(manageLinks.verify(tampered)).isNull();
    }

    @Test
    void recordedDocumentEventQueuesMatchingAndAddsDurableEntries() {
        String cookie = session("u3");
        String documentId = client.get().uri("/api/documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody()
                .path("items").get(0).path("document").path("id").asString();
        events.record(new EventInput(EventCode.DOCUMENT_RELINKED, "document", documentId, null,
                new EventInput.User("u3"), "watchlist-match-test", null,
                json.readTree("{\"catalogId\":{\"from\":\"old\",\"to\":\"new\"}}"), null));

        client.post().uri("/_engine/jobs/run").contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isOk();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM watchlist_entries WHERE user_id='u3' "
                + "AND watchlist_id='W-u3-documents-1' AND record_id=? AND baseline=false", Integer.class,
                documentId)).isEqualTo(1);
    }

    @Test
    void requestMatchCreatesAnEntryOnlyForAudienceMembers() {
        events.record(new EventInput(EventCode.REQUEST_CREATED, "request", "R19", null,
                new EventInput.User("u5"), "watchlist-audience-test", null,
                json.readTree("{\"batch\":null,\"source\":null}"), null));

        client.post().uri("/_engine/jobs/run").contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isOk();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM watchlist_entries WHERE user_id='u8' "
                + "AND watchlist_id='W-shared-4' AND record_id='D21' AND baseline=false", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM watchlist_entries WHERE user_id='u4' "
                + "AND watchlist_id='W-shared-4' AND record_id='D21'", Integer.class)).isZero();
    }

    @Test
    void mailWindowWithNoUnopenedEntriesSendsNothing() {
        OffsetDateTime now = currentTime();
        jdbc.update("INSERT INTO watchlist_mail_windows (id,user_id,send_at,state) VALUES (?,?,?,'waiting')",
                "WM-empty", "u3", now.minusSeconds(1));
        jobs.enqueue(dsl, "watchlist.mail", now.minusSeconds(1).toInstant(), Map.of("windowId", "WM-empty"));

        runJobs();

        assertThat(jdbc.queryForObject("SELECT state FROM watchlist_mail_windows WHERE id='WM-empty'", String.class))
                .isEqualTo("empty");
        assertThat(outboxCount()).isZero();
    }

    @Test
    void mailWindowLeavesOutAnEntrySeenBeforeItCloses() {
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, session("u3"))
                .exchange().expectStatus().isOk();
        OffsetDateTime now = currentTime();
        jdbc.update("UPDATE watchlist_viewers SET channels='{" + "\"pi16\":{\"isOn\":true}}'::jsonb, "
                + "seen_at=? WHERE user_id='u3' AND watchlist_id='W-u3-documents-1'", now);
        insertEntry("u3", "W-u3-documents-1", "D1", now.minusMinutes(1));
        jdbc.update("INSERT INTO watchlist_mail_windows (id,user_id,send_at,state) VALUES (?,?,?,'waiting')",
                "WM-seen", "u3", now.minusSeconds(1));
        jobs.enqueue(dsl, "watchlist.mail", now.minusSeconds(1).toInstant(), Map.of("windowId", "WM-seen"));

        runJobs();

        assertThat(jdbc.queryForObject("SELECT state FROM watchlist_mail_windows WHERE id='WM-seen'", String.class))
                .isEqualTo("empty");
        assertThat(outboxCount()).isZero();
    }

    @Test
    void mailWindowGroupsTwoWatchlistsAndListsEachRecordOnce() {
        String cookie = session("u3");
        String firstId = createDocumentWatchlist(cookie, "Mail Lidove", "Lidové");
        String secondId = createDocumentWatchlist(cookie, "Mail MZK", "MZK");
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk();
        jdbc.update("UPDATE watchlist_viewers SET channels=jsonb_build_object('pi16',"
                + "jsonb_build_object('isOn',true)) WHERE user_id='u3' AND watchlist_id IN (?,?)", firstId, secondId);
        OffsetDateTime now = currentTime();
        insertEntry("u3", firstId, "D1", now.minusMinutes(2));
        insertEntry("u3", secondId, "D1", now.minusMinutes(2));
        insertEntry("u3", secondId, "D2", now.minusMinutes(1));
        jdbc.update("INSERT INTO watchlist_mail_windows (id,user_id,send_at,state) VALUES (?,?,?,'waiting')",
                "WM-grouped", "u3", now.minusSeconds(1));
        jobs.enqueue(dsl, "watchlist.mail", now.minusSeconds(1).toInstant(), Map.of("windowId", "WM-grouped"));

        runJobs();

        assertThat(jdbc.queryForObject("SELECT state FROM watchlist_mail_windows WHERE id='WM-grouped'", String.class))
                .isEqualTo("sent");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM outbox", Integer.class)).isEqualTo(1);
        JsonNode payload = jdbc.queryForObject("SELECT payload FROM outbox LIMIT 1", (rs, row) ->
                json.readTree(rs.getString(1)));
        assertThat(payload.path("records").size()).isEqualTo(2);
        int groupedWatchlists = 0;
        for (JsonNode record : payload.path("records")) {
            if ("D1".equals(record.path("recordId").asString())) {
                groupedWatchlists = record.path("watchlistIds").size();
            }
        }
        assertThat(groupedWatchlists).isEqualTo(2);
    }

    @Test
    void mailWindowRechecksAudienceBeforeSending() {
        String cookie = session("u4");
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk();
        jdbc.update("UPDATE watchlists SET audience = '{\"kind\":\"some\",\"groupIds\":[\"g1\"],"
                + "\"roleIds\":[]}'::jsonb WHERE id='W-shared-1'");
        jdbc.update("UPDATE watchlist_viewers SET channels = '{\"pi16\":{\"isOn\":true}}'::jsonb "
                + "WHERE user_id='u4' AND watchlist_id='W-shared-1'");
        OffsetDateTime now = currentTime();
        insertEntry("u4", "W-shared-1", "D1", now.minusMinutes(2));
        jdbc.update("INSERT INTO watchlist_mail_windows (id,user_id,send_at,state) VALUES (?,?,?,'waiting')",
                "WM-access", "u4", now.minusSeconds(1));
        jobs.enqueue(dsl, "watchlist.mail", now.minusSeconds(1).toInstant(), Map.of("windowId", "WM-access"));

        runJobs();

        assertThat(jdbc.queryForObject("SELECT state FROM watchlist_mail_windows WHERE id='WM-access'", String.class))
                .isEqualTo("empty");
        assertThat(outboxCount()).isZero();
    }

    @Test
    void changedSystemFilterSendsAReviewNotice() {
        client.get().uri("/api/watchlists?view=requests").header(HttpHeaders.COOKIE, session("u8"))
                .exchange().expectStatus().isOk();
        jdbc.update("UPDATE watchlist_viewers SET channels=jsonb_build_object('pi16',"
                + "jsonb_build_object('isOn',true)) WHERE user_id='u8' AND watchlist_id='W-shared-4'");
        client.patch().uri("/api/watchlists/W-shared-4").header(HttpHeaders.COOKIE, session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body("{\"filter\":{\"decision\":\"Denied\"}}")
                .exchange().expectStatus().isOk();

        runJobs();

        assertThat(outboxCount()).isGreaterThan(0);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM jobs WHERE kind='watchlist.notice' "
                + "AND state='done'", Integer.class)).isEqualTo(1);
    }

    @Test
    void removedAudienceMemberReceivesAStopNotice() {
        client.get().uri("/api/watchlists?view=requests").header(HttpHeaders.COOKIE, session("u8"))
                .exchange().expectStatus().isOk();
        jdbc.update("UPDATE watchlist_viewers SET channels=jsonb_build_object('pi16',"
                + "jsonb_build_object('isOn',true)) WHERE user_id='u8' AND watchlist_id='W-shared-4'");
        client.patch().uri("/api/watchlists/W-shared-4").header(HttpHeaders.COOKIE, session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"audience\":{\"kind\":\"some\",\"groupIds\":[\"g2\"],\"roleIds\":[]}}")
                .exchange().expectStatus().isOk();

        runJobs();

        assertThat(outboxCount()).isGreaterThan(0);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM jobs WHERE kind='watchlist.notice' "
                + "AND state='done'", Integer.class)).isEqualTo(1);
    }

    @Test
    void chatEntryUsesThePersonChannelSwitch() {
        String cookie = session("u3");
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk();
        JsonNode channels = client.get().uri("/api/session/watchlist-channels")
                .header(HttpHeaders.COOKIE, cookie).exchange().expectStatus().isOk()
                .expectBody(JsonNode.class).returnResult().getResponseBody();
        String channelId = channels.get(2).path("id").asString();
        jdbc.update("UPDATE watchlist_viewers SET channels=jsonb_build_object(?,"
                + "jsonb_build_object('isOn',true)) WHERE user_id='u3' AND watchlist_id='W-u3-documents-1'",
                channelId);
        OffsetDateTime now = currentTime();
        insertEntry("u3", "W-u3-documents-1", "D1", now.minusMinutes(1));
        jobs.enqueue(dsl, "watchlist.chat", now.toInstant(),
                Map.of("userId", "u3", "watchlistId", "W-u3-documents-1", "recordId", "D1"));
        int before = outboxCount();

        runJobs();

        assertThat(outboxCount()).isEqualTo(before + 1);
    }

    @Test
    void requestsMatchTheRequestIdentityThroughTheRequestsPageQuery() {
        JsonNode page = client.get().uri("/api/requests").header(HttpHeaders.COOKIE, session("u3"))
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String requestId = page.path("items").get(0).path("record").path("requests").get(0).path("id").asString();

        assertThat(watchlists.matchesRecord("requests", json.readTree("{}"), "u3", requestId))
                .isTrue();
    }

    @Test
    void validationsUseTheValidationsPageQueryAndIterationIdentity() {
        JsonNode page = client.get().uri("/api/validations").header(HttpHeaders.COOKIE, session("u8"))
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String iterationId = page.path("items").get(0).path("iteration").path("id").asString();

        assertThat(watchlists.matchesRecord("validations", json.readTree("{}"), "u8", iterationId)).isTrue();
    }

    @Test
    void listsUseTheDigitizationListIndexQueryAndListIdentity() {
        JsonNode page = client.get().uri("/api/digitization-lists").header(HttpHeaders.COOKIE, session("u2"))
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String listId = page.path("items").get(0).path("list").path("id").asString();

        assertThat(watchlists.matchesRecord("lists", json.readTree("{}"), "u2", listId)).isTrue();
    }

    @Test
    void projectsCategoriesMixesIntentionsAndTasksUseTheirPageQueries() {
        JsonNode projectsPage = client.get().uri("/api/projects/overview")
                .header(HttpHeaders.COOKIE, session("u2")).exchange().expectStatus().isOk()
                .expectBody(JsonNode.class).returnResult().getResponseBody();
        String projectId = projectsPage.path("rows").get(0).path("project").path("id").asString();
        assertThat(watchlists.matchesRecord("projects", json.readTree("{}"), "u2", projectId)).isTrue();

        JsonNode categoriesPage = client.get().uri("/api/categories/overview")
                .header(HttpHeaders.COOKIE, session("u2")).exchange().expectStatus().isOk()
                .expectBody(JsonNode.class).returnResult().getResponseBody();
        String categoryId = categoriesPage.path("nodes").get(0).path("categoryId").asString();
        assertThat(watchlists.matchesRecord("categories", json.readTree("{}"), "u2", categoryId)).isTrue();

        JsonNode mixesPage = client.get().uri("/api/mixes").header(HttpHeaders.COOKIE, session("u2"))
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String mixId = mixesPage.get(0).path("id").asString();
        assertThat(watchlists.matchesRecord("mixes", json.readTree("{}"), "u2", mixId)).isTrue();

        JsonNode intentionsPage = client.get().uri("/api/intentions/overview")
                .header(HttpHeaders.COOKIE, session("u2")).exchange().expectStatus().isOk()
                .expectBody(JsonNode.class).returnResult().getResponseBody();
        String intentionId = intentionsPage.path("rows").get(0).path("intention").path("id").asString();
        assertThat(watchlists.matchesRecord("intentions", json.readTree("{}"), "u2", intentionId)).isTrue();

        JsonNode tasksPage = client.get().uri("/api/tasks").header(HttpHeaders.COOKIE, session("u2"))
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        JsonNode taskRun = tasksPage.path("running").isEmpty()
                ? tasksPage.path("finished").get(0) : tasksPage.path("running").get(0);
        String runId = taskRun.path("id").asString();
        assertThat(watchlists.matchesRecord("tasks", json.readTree("{}"), "u2", runId)).isTrue();
    }

    @Test
    void projectCategoryMixIntentionAndTaskEventsCreateTheirViewEntries() {
        String cookie = session("u2");
        JsonNode projectsPage = client.get().uri("/api/projects/overview").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String projectId = projectsPage.path("rows").get(0).path("project").path("id").asString();
        JsonNode categoriesPage = client.get().uri("/api/categories/overview").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String categoryId = categoriesPage.path("nodes").get(0).path("categoryId").asString();
        JsonNode mixesPage = client.get().uri("/api/mixes").header(HttpHeaders.COOKIE, cookie).exchange()
                .expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String mixId = mixesPage.get(0).path("id").asString();
        JsonNode intentionsPage = client.get().uri("/api/intentions/overview").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String intentionId = intentionsPage.path("rows").get(0).path("intention").path("id").asString();
        JsonNode tasksPage = client.get().uri("/api/tasks").header(HttpHeaders.COOKIE, cookie).exchange()
                .expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        JsonNode taskRun = tasksPage.path("running").isEmpty()
                ? tasksPage.path("finished").get(0) : tasksPage.path("running").get(0);
        String runId = taskRun.path("id").asString();

        Map<String, String> watchlistIds = Map.of(
                "projects", createOtherViewWatchlist(cookie, "Project arrivals", "projects"),
                "categories", createOtherViewWatchlist(cookie, "Category arrivals", "categories"),
                "mixes", createOtherViewWatchlist(cookie, "Mix arrivals", "mixes"),
                "intentions", createOtherViewWatchlist(cookie, "Intention arrivals", "intentions"),
                "tasks", createOtherViewWatchlist(cookie, "Task arrivals", "tasks"));
        recordMatchEvent("test-project-match", "project", projectId);
        recordMatchEvent("test-category-match", "category", categoryId);
        recordMatchEvent("test-mix-match", "mix", mixId);
        recordMatchEvent("test-intention-match", "intention", intentionId);
        recordMatchEvent("test-task-match", "run", runId);

        runJobs();

        for (Map.Entry<String, String> entry : watchlistIds.entrySet()) {
            assertThat(jdbc.queryForObject("SELECT count(*) FROM watchlist_entries WHERE watchlist_id=? "
                    + "AND baseline=false", Integer.class, entry.getValue()))
                    .as(entry.getKey()).isEqualTo(1);
        }
    }

    @Test
    void iterationEventCreatesAValidationViewEntry() {
        JsonNode page = client.get().uri("/api/validations").header(HttpHeaders.COOKIE, session("u8"))
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String iterationId = page.path("items").get(0).path("iteration").path("id").asString();
        events.record(new EventInput(EventCode.ITERATION_VERDICT_ACCEPTED, "iteration", iterationId, null,
                new EventInput.User("u8"), "watchlist-validation-match", null,
                json.readTree("{\"defects\":[]}"), null));

        runJobs();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM watchlist_entries WHERE user_id='u8' "
                + "AND watchlist_id='W-shared-5' AND record_id=? AND baseline=false", Integer.class,
                iterationId)).isEqualTo(1);
    }

    @Test
    void listEventCreatesAListViewEntry() {
        String cookie = session("u3");
        JsonNode page = client.get().uri("/api/digitization-lists").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
        String listId = page.path("items").get(0).path("list").path("id").asString();
        String watchlistId = createOtherViewWatchlist(cookie, "List watchlist", "lists");
        events.fire(new EventInput(EventCode.LIST_STARTED, "list", listId, null,
                new EventInput.System(), "watchlist-list-match", currentTime().toInstant(),
                json.readTree("{}"), null));

        runJobs();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM watchlist_entries WHERE user_id='u3' "
                + "AND watchlist_id=? AND record_id=? AND baseline=false", Integer.class, watchlistId, listId))
                .isEqualTo(1);
    }

    @Test
    void pushDeviceAnsweredGoneIsRemovedAfterThePushJob() {
        String cookie = session("u3");
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk();
        client.post().uri("/api/session/push-devices").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"endpoint\":\"https://push.example/gone\",\"keys\":{\"p256dh\":\"key\",\"auth\":\"secret\"}}")
                .exchange().expectStatus().isOk();
        String documentId = client.get().uri("/api/documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody()
                .path("items").get(0).path("document").path("id").asString();
        OffsetDateTime now = jdbc.queryForObject("SELECT at FROM test_clock WHERE id=true", OffsetDateTime.class);
        OffsetDateTime enteredAt = now.minusSeconds(31);
        jdbc.update("UPDATE push_devices SET created_at=? WHERE user_id='u3'", now.minusSeconds(60));
        jdbc.update("INSERT INTO watchlist_entries (user_id,watchlist_id,record_id,entered_at,baseline,"
                        + "filter_version,delivered_at) VALUES ('u3','W-u3-documents-1',?,?,false,1,'{}'::jsonb)",
                documentId, enteredAt);
        jdbc.update("UPDATE watchlist_viewers SET push=true,push_since=NULL,seen_at=NULL "
                + "WHERE user_id='u3' AND watchlist_id='W-u3-documents-1'");
        jdbc.update("INSERT INTO watchlist_push_batches (id,user_id,watchlist_id,first_at,send_at,state) "
                        + "VALUES ('WP-test','u3','W-u3-documents-1',?,?, 'waiting')",
                enteredAt, now.minusSeconds(1));
        jdbc.update("INSERT INTO jobs (kind,due_at,payload,state,attempt) "
                        + "VALUES ('watchlist.push',?,'{\"batchId\":\"WP-test\"}'::jsonb,'due',0)",
                now.minusSeconds(1));

        client.post().uri("/_engine/jobs/run").contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isOk();

        assertThat(jdbc.queryForMap("SELECT state,error FROM jobs WHERE kind='watchlist.push' ORDER BY id DESC LIMIT 1"))
                .containsEntry("state", "done");
        assertThat(jdbc.queryForObject("SELECT state FROM watchlist_push_batches WHERE id='WP-test'", String.class))
                .isEqualTo("sent");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM push_devices WHERE user_id='u3'", Integer.class))
                .isZero();
    }

    @Test
    void pushIsCapturedWithItsDevice() {
        String cookie = session("u3");
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk();
        client.post().uri("/api/session/push-devices").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"endpoint\":\"https://push.example/live\","
                        + "\"keys\":{\"p256dh\":\"key\",\"auth\":\"secret\"}}")
                .exchange().expectStatus().isOk();
        String documentId = client.get().uri("/api/documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody()
                .path("items").get(0).path("document").path("id").asString();
        OffsetDateTime now = currentTime();
        OffsetDateTime enteredAt = now.minusSeconds(31);
        jdbc.update("UPDATE push_devices SET created_at=? WHERE user_id='u3'", now.minusSeconds(60));
        insertEntry("u3", "W-u3-documents-1", documentId, enteredAt);
        jdbc.update("UPDATE watchlist_viewers SET push=true,push_since=NULL,seen_at=NULL "
                + "WHERE user_id='u3' AND watchlist_id='W-u3-documents-1'");
        jdbc.update("INSERT INTO watchlist_push_batches (id,user_id,watchlist_id,first_at,send_at,state) "
                        + "VALUES ('WP-live','u3','W-u3-documents-1',?,?, 'waiting')",
                enteredAt, now.minusSeconds(1));
        jobs.enqueue(dsl, "watchlist.push", now.minusSeconds(1).toInstant(), Map.of("batchId", "WP-live"));

        runJobs();

        assertThat(jdbc.queryForObject("SELECT state FROM watchlist_push_batches WHERE id='WP-live'", String.class))
                .isEqualTo("sent");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM outbox WHERE channel='push'", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM push_devices WHERE user_id='u3'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void createsChangesViewsAndDeletesPersonalWatchlist() {
        String cookie = session("u3");
        String body = "{\"name\":\"Personal test\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"unique-watchlist-test\"},\"audience\":{\"kind\":\"personal\"}}";
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isCreated()
                .expectBody().jsonPath("$.name").isEqualTo("Personal test").jsonPath("$.id").exists();
        client.patch().uri("/api/watchlists/W-u3-documents-1/viewer").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"position\":2,\"channels\":{\"pi18\":true}}")
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.channels.pi18.isOn").isEqualTo(true)
                .jsonPath("$.channels.pi18.since").exists();
        client.post().uri("/api/watchlists/W-u3-documents-1/seen").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.seenAt").exists();
        client.delete().uri("/api/watchlists/W-u3-documents-1").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isNoContent();
    }

    @Test
    void newWatchlistTakesTheLastViewerPosition() {
        String cookie = session("u3");
        String body = "{\"name\":\"Last position test\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"last-position-test\"},"
                + "\"audience\":{\"kind\":\"personal\"}}";
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isCreated();

        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[5].name").isEqualTo("Last position test")
                .jsonPath("$[5].viewer.position").isEqualTo(5);
    }

    @Test
    void recordedReadsUsePositionsAfterEarlierUsersWatchlistsWereMaterialized() {
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, session("u3"))
                .exchange().expectStatus().isOk();

        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, session("u8"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].viewer.position").isEqualTo(0)
                .jsonPath("$[1].viewer.position").isEqualTo(1)
                .jsonPath("$[2].id").isEqualTo("W-u8-documents-1")
                .jsonPath("$[2].viewer.position").isEqualTo(15)
                .jsonPath("$[3].viewer.position").isEqualTo(16)
                .jsonPath("$[4].viewer.position").isEqualTo(17);
    }

    @Test
    void recordedAdminActionsKeepTheViewerPositionsCreatedBySeen() {
        String cookie = session("u3");
        String draft = "{\"name\":\"Recording watchlist\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"recording-watchlist-unique\"},"
                + "\"audience\":{\"kind\":\"personal\"}}";
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(draft).exchange().expectStatus().isCreated();
        client.patch().uri("/api/watchlists/W-u3-documents-1/viewer").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{\"position\":2,\"channels\":{\"pi18\":true}}")
                .exchange().expectStatus().isOk();
        client.post().uri("/api/watchlists/W-u3-documents-1/seen").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk();

        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo("W-shared-1")
                .jsonPath("$[0].viewer.position").isEqualTo(1)
                .jsonPath("$[1].id").isEqualTo("W-shared-2")
                .jsonPath("$[1].viewer.position").isEqualTo(2)
                .jsonPath("$[2].id").isEqualTo("W-u3-documents-1")
                .jsonPath("$[2].viewer.position").isEqualTo(2)
                .jsonPath("$[3].viewer.position").isEqualTo(3)
                .jsonPath("$[4].viewer.position").isEqualTo(4)
                .jsonPath("$[5].name").isEqualTo("Recording watchlist")
                .jsonPath("$[5].viewer.position").isEqualTo(5);
    }

    @Test
    void firstBaseDocumentWatchlistReadsForSevenPeopleFinishWithinOneAndAHalfSeconds() {
        AtomicInteger queries = new AtomicInteger();
        ExecuteListener listener = new ExecuteListener() {
            @Override
            public void executeStart(ExecuteContext context) {
                queries.incrementAndGet();
            }
        };
        ExecuteListenerProvider[] original = dsl.configuration().executeListenerProviders();
        ExecuteListenerProvider[] instrumented = Arrays.copyOf(original, original.length + 1);
        instrumented[original.length] = new DefaultExecuteListenerProvider(listener);
        dsl.configuration().set(instrumented);
        try {
            long startedAt = System.nanoTime();
            for (String userId : List.of("u3", "u8", "u2", "u4", "u5", "u10", "u9")) {
                queries.set(0);
                readDocumentWatchlists(userId, queries);
                System.out.printf("watchlist GET %s: %d ms, %d SQL executions%n", userId,
                        lastReadMillis, queries.get());
                assertThat(lastReadMillis).as("%s first read took %d ms", userId, lastReadMillis)
                        .isLessThan(500);
            }
            long elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000;
            assertThat(elapsedMillis).as("seven first document watchlist reads took %d ms", elapsedMillis)
                    .isLessThan(1_500);
        } finally {
            dsl.configuration().set(original);
        }
    }

    @Test
    void rejectsBadPageFilterAndKeepsAudienceAndPermissionRefusals() {
        String cookie = session("u3");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Bad\",\"view\":\"documents\",\"filter\":{"
                        + "\"status\":\"Available\"},\"audience\":{\"kind\":\"personal\"}}")
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.type").isEqualTo("https://vera.mzk.cz/problems/watchlist.invalid_filter");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, session("u5"))
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Personal\",\"view\":\"documents\",\"filter\":{},"
                        + "\"audience\":{\"kind\":\"personal\"}}")
                .exchange().expectStatus().isForbidden().expectBody()
                .jsonPath("$.type").isEqualTo("https://vera.mzk.cz/problems/watchlist.manager_required");
    }

    @Test
    void checksAudienceReachDuplicateAndEveryWatchlistActRefusal() {
        String admin = session("u3");
        String personal = "{\"name\":\"Recording watchlist\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"recording-watchlist-unique\"},"
                + "\"audience\":{\"kind\":\"personal\"}}";
        String system = "{\"name\":\"Recording shared watchlist\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"recording-watchlist-unique\"},"
                + "\"audience\":{\"kind\":\"everyone\"}}";
        String reachSystem = system.substring(0, system.length() - 1) + ",\"watchlistId\":null}";
        client.get().uri("/api/watchlists?view=documents&mode=manage-system")
                .header(HttpHeaders.COOKIE, session("u5")).exchange().expectStatus().isForbidden();
        client.post().uri("/api/watchlists/reach").header(HttpHeaders.COOKIE, session("u5"))
                .contentType(MediaType.APPLICATION_JSON).body(reachSystem).exchange().expectStatus().isForbidden();
        client.post().uri("/api/watchlists/reach").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Recording watchlist\",\"view\":\"documents\","
                        + "\"filter\":{\"q\":\"recording-watchlist-unique\"},"
                        + "\"audience\":{\"kind\":\"personal\"},\"watchlistId\":null}")
                .exchange().expectStatus().isOk().expectBody().json("{\"userCount\":0,"
                        + "\"outOfViewCount\":0,\"duplicateCount\":0}");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, session("u5"))
                .contentType(MediaType.APPLICATION_JSON).body(system).exchange()
                .expectStatus().isForbidden().expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.manager_required");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON).body(personal).exchange().expectStatus().isCreated();
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body(personal.replace("Recording watchlist", "Duplicate"))
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.already_saved");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body(personal.replace("\"audience\":{\"kind\":\"personal\"}",
                        "\"audience\":{\"kind\":\"personal\"},\"copyOf\":\"missing\""))
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.source_unavailable");
        client.patch().uri("/api/watchlists/W-u3-documents-1").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON).body("{\"filter\":{\"status\":\"Available\"}}")
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.invalid_filter");
        client.patch().uri("/api/watchlists/W-u3-documents-1").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk();
        client.patch().uri("/api/watchlists/W-u3-documents-1/viewer").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON).body("{\"channels\":{\"pi18\":\"yes\"}}")
                .exchange().expectStatus().isEqualTo(422);
        client.patch().uri("/api/watchlists/W-shared-1").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"audience\":{\"kind\":\"personal\"}}")
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.system_to_personal");
        client.patch().uri("/api/watchlists/W-u3-documents-1").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"audience\":{\"kind\":\"everyone\"}}")
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.personal_to_system");
        client.patch().uri("/api/watchlists/W-u3-documents-2").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"filter\":{\"priority\":\"Urgent,High\",\"copy\":\"None\"}}")
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.already_saved");
        client.patch().uri("/api/watchlists/W-shared-2").header(HttpHeaders.COOKIE, session("u8"))
                .contentType(MediaType.APPLICATION_JSON).body("{\"name\":\"Changed\"}")
                .exchange().expectStatus().isForbidden().expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.manager_required");
        client.delete().uri("/api/watchlists/W-shared-2").header(HttpHeaders.COOKIE, session("u8"))
                .exchange().expectStatus().isForbidden().expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.manager_required");
    }

    @Test
    void sharedWatchlistIsOnlyListedForItsAudience() {
        jdbc.update("UPDATE watchlists SET audience = '{\"kind\":\"some\",\"groupIds\":[\"g1\"],\"roleIds\":[]}'::jsonb WHERE id='W-shared-1'");
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, session("u4"))
                .exchange().expectStatus().isOk().expectBody().json("[]");
    }

    private String session(String userId) {
        String setCookie = client.post().uri("/_engine/sessions")
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("userId", userId))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult()
                .getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE);
        return setCookie.split(";", 2)[0];
    }

    private OffsetDateTime currentTime() {
        return jdbc.queryForObject("SELECT at FROM test_clock WHERE id=true", OffsetDateTime.class);
    }

    private void insertEntry(String userId, String watchlistId, String recordId, OffsetDateTime enteredAt) {
        jdbc.update("INSERT INTO watchlist_entries (user_id,watchlist_id,record_id,entered_at,baseline,"
                        + "filter_version,delivered_at) SELECT ?,?,?,?,false,filter_version,'{}'::jsonb "
                        + "FROM watchlists WHERE id=?",
                userId, watchlistId, recordId, enteredAt, watchlistId);
    }

    private void recordMatchEvent(String eventId, String subjectKind, String subjectId) {
        OffsetDateTime at = currentTime();
        jdbc.update("INSERT INTO hook_events (id,code,subject_kind,subject_id,occurred_at,correlation_id,"
                        + "cause,actor,changes) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb)",
                eventId, "test." + subjectKind + ".matched", subjectKind, subjectId, at,
                "test-match-" + eventId, "{\"kind\":\"act\",\"act\":\"test\",\"run\":null}",
                "{\"kind\":\"person\",\"id\":\"u2\",\"name\":null}", "[]");
        jobs.enqueue(dsl, "watchlist.match", at.toInstant(), Map.of("eventId", eventId));
    }

    private String createDocumentWatchlist(String cookie, String name, String query) {
        String body = "{\"name\":\"" + name + "\",\"view\":\"documents\",\"filter\":{\"q\":\""
                + query + "\"},\"audience\":{\"kind\":\"personal\"}}";
        JsonNode created = client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isCreated()
                .expectBody(JsonNode.class).returnResult().getResponseBody();
        return created.path("id").asString();
    }

    private String createOtherViewWatchlist(String cookie, String name, String view) {
        String body = "{\"name\":\"" + name + "\",\"view\":\"" + view
                + "\",\"filter\":{},\"audience\":{\"kind\":\"personal\"}}";
        JsonNode created = client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isCreated()
                .expectBody(JsonNode.class).returnResult().getResponseBody();
        return created.path("id").asString();
    }

    private void runJobs() {
        client.post().uri("/_engine/jobs/run").contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isOk();
    }

    private int outboxCount() {
        return jdbc.queryForObject("SELECT count(*) FROM outbox", Integer.class);
    }

    private long lastReadMillis;

    private void readDocumentWatchlists(String userId, AtomicInteger queries) {
        String cookie = session(userId);
        queries.set(0);
        long startedAt = System.nanoTime();
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk();
        lastReadMillis = (System.nanoTime() - startedAt) / 1_000_000;
    }
}

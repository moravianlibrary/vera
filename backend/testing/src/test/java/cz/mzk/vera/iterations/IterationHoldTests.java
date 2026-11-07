package cz.mzk.vera.iterations;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.util.Map;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

// ACT-cancel; ACT-resume; ACT-overrule; ACT-page-count; ACT-recheck.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class IterationHoldTests {
    @Container
    @ServiceConnection
    static final org.testcontainers.postgresql.PostgreSQLContainer POSTGRES =
            new org.testcontainers.postgresql.PostgreSQLContainer("postgres:18");

    @Autowired private RestTestClient client;
    @Autowired private TemplateResetService reset;
    @Autowired private DSLContext dsl;

    @BeforeEach
    void loadBase() { reset.reset("base", true); }

    @Test
    void entersPageCountClearsPagesAndWritesPageCountEvent() throws Exception {
        var response = post("/api/iterations/IT11/page-count", "u8", Map.of("pages", 312), 200);
        assertThat(response.path("clearedKeys").toString()).contains("pi9:R01:pages");
        assertThat(response.path("review").isNull()).isTrue();
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq("IT11"))
                .fetchOne(0, String.class)).isEqualTo("Ready");
        assertThat(dsl.select(DOCUMENT_PAGE_SOURCES.VALUE).from(DOCUMENT_PAGE_SOURCES)
                .where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.eq("D11")
                        .and(DOCUMENT_PAGE_SOURCES.SOURCE.eq("manual")))
                .fetchOne(0, Integer.class)).isEqualTo(312);
        assertThat(dsl.selectCount().from(ITERATION_DEFECTS).where(ITERATION_DEFECTS.ITERATION_ID.eq("IT11"))
                .fetchOne(0, int.class)).isZero();
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT11")
                .and(EVENTS.CODE.eq("iteration.page_count_entered"))))).isTrue();
    }

    @Test
    void rechecksCatalogRepairsAndMovesEnqueuedToReadyWhenLastDefectClears() throws Exception {
        reset.reset("bk4h-recheck", true);
        var response = post("/api/iterations/IT10/recheck", "u3", Map.of(), 200);
        assertThat(response.path("clearedKeys").toString()).contains("pi9:R03:245$a");
        assertThat(response.path("progress").asString()).isEqualTo("Ready");
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq("IT10"))
                .fetchOne(0, String.class)).isEqualTo("Ready");
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT10")
                .and(EVENTS.CODE.eq("iteration.rechecked"))))).isTrue();
    }

    @Test
    void cancellationHoldsProgressAndClearsListThenResumeReturnsToPool() throws Exception {
        var cancelled = post("/api/iterations/IT25/cancel", "u8",
                Map.of("publicText", "Not available now.", "internalText", "Scanner unavailable."), 200);
        assertThat(cancelled.path("askerCount").asInt()).isEqualTo(1);
        assertThat(dsl.select(ITERATIONS.CANCELLATION_CAUSE).from(ITERATIONS)
                .where(ITERATIONS.ID.eq("IT25")).fetchOne(0, String.class)).isEqualTo("Decided");
        assertThat(dsl.select(ITERATIONS.LIST_ID).from(ITERATIONS).where(ITERATIONS.ID.eq("IT25"))
                .fetchOne(0, String.class)).isNull();
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq("IT25"))
                .fetchOne(0, String.class)).isEqualTo("Enqueued");
        var cancelledEvent = dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT25")
                .and(EVENTS.CODE.eq("iteration.cancelled"))).fetchOne();
        assertThat(cancelledEvent.getData().data()).contains("Regional weeklies");
        post("/api/iterations/IT9/resume", "u3", Map.of(), 200);
        assertThat(dsl.select(ITERATIONS.CANCELLATION_CAUSE).from(ITERATIONS)
                .where(ITERATIONS.ID.eq("IT9")).fetchOne(0, String.class)).isNull();
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq("IT9"))
                .fetchOne(0, String.class)).isEqualTo("Ready");
    }

    @Test
    void overrulesRestrictionAndKeepsScannedProgressFixed() throws Exception {
        var response = post("/api/iterations/IT14/overrule", "u3", Map.of("note", "Rights cleared."), 200);
        assertThat(response.path("progress").asString()).isEqualTo("Enqueued");
        assertThat(dsl.select(ITERATIONS.OVERRIDE_NOTE).from(ITERATIONS).where(ITERATIONS.ID.eq("IT14"))
                .fetchOne(0, String.class)).isEqualTo("Rights cleared.");
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT14")
                .and(EVENTS.CODE.eq("iteration.restriction_overruled"))))).isTrue();
    }

    @Test
    void eachActRequiresASessionAndRefusalsDoNotWrite() {
        int eventsBefore = dsl.selectCount().from(EVENTS).fetchOne(0, int.class);
        postNoSession("/api/iterations/IT11/page-count", Map.of("pages", 312));
        postNoSession("/api/iterations/IT11/recheck", Map.of());
        Map<String, Object> cancelBody = new java.util.LinkedHashMap<>();
        cancelBody.put("publicText", "Not available.");
        cancelBody.put("internalText", null);
        postNoSession("/api/iterations/IT25/cancel", cancelBody);
        postNoSession("/api/iterations/IT9/resume", Map.of());
        postNoSession("/api/iterations/IT14/overrule", Map.of("note", "Rights cleared."));
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(eventsBefore);
    }

    @Test
    void refusesInvalidStatesWithoutChangingRowsOrEvents() throws Exception {
        int eventsBefore = dsl.selectCount().from(EVENTS).fetchOne(0, int.class);
        post("/api/iterations/IT9/cancel", "u3",
                Map.of("publicText", "Not available.", "internalText", "Because."), 409);
        post("/api/iterations/IT11/overrule", "u3", Map.of("note", "Rights."), 409);
        post("/api/iterations/IT11/resume", "u3", Map.of(), 409);
        post("/api/iterations/IT12/page-count", "u3", Map.of("pages", 312), 409);
        post("/api/iterations/IT12/page-count", "u2", Map.of("pages", 312), 403);
        post("/api/iterations/IT11/page-count", "u8", Map.of("pages", 0), 422);
        post("/api/iterations/IT0/recheck", "u3", Map.of(), 409);
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(eventsBefore);
    }

    @Test
    void recheckNeverMovesScannedProgressBackAndKeepsCancelledProgressHeld() throws Exception {
        var scanned = post("/api/iterations/IT12/recheck", "u3", Map.of(), 200);
        assertThat(scanned.path("progress").asString()).isEqualTo("Digitized");
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq("IT12"))
                .fetchOne(0, String.class)).isEqualTo("Digitized");
        var cancelled = post("/api/iterations/IT9/recheck", "u3", Map.of(), 200);
        assertThat(cancelled.path("progress").asString()).isEqualTo("Ready");
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq("IT9"))
                .fetchOne(0, String.class)).isEqualTo("Ready");
    }

    private tools.jackson.databind.JsonNode post(String path, String user, Object body, int status)
            throws Exception {
        String cookie = session(user);
        String response = client.post().uri(URI.create(path)).contentType(MediaType.APPLICATION_JSON)
                .header("Cookie", cookie).body(body).exchange().expectStatus().isEqualTo(status)
                .expectBody(String.class).returnResult().getResponseBody();
        return response == null ? new tools.jackson.databind.ObjectMapper().nullNode()
                : new tools.jackson.databind.ObjectMapper().readTree(response);
    }

    private void postNoSession(String path, Object body) {
        client.post().uri(URI.create(path)).contentType(MediaType.APPLICATION_JSON).body(body)
                .exchange().expectStatus().isUnauthorized();
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }
}

package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_STATES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
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
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// ACT-request-decide; STAT-validation; STAT-public; LOG-one-act-one-story.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class RequestDecisionTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private DSLContext dsl;
    @Autowired
    private ObjectMapper mapper;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void approvesMultiAskRowWithOneIterationAndSharedEvents() throws Exception {
        String cookie = session("u8");
        int asks = dsl.selectCount().from(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq("D20")
                .and(REQUESTS.DECISION.eq("Pending"))).fetchOne(0, int.class);
        assertThat(asks).isGreaterThan(1);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("categoryId", "c21");
        body.put("priority", "Normal");
        body.put("rescanNote", null);
        JsonNode answer = post("/api/requests/D20/approve", cookie, body, 200);
        assertThat(answer.path("decision").asString()).isEqualTo("Approved");
        assertThat(answer.path("askCount").asInt()).isEqualTo(asks);
        var iteration = dsl.selectFrom(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq("D20")).fetchOne();
        assertThat(iteration).isNotNull();
        assertThat(iteration.getRequestId()).isEqualTo(dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq("D20")).orderBy(REQUESTS.AT, REQUESTS.ID)
                .limit(1).fetchOne(REQUESTS.ID));
        assertThat(dsl.selectCount().from(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq("D20"))
                .fetchOne(0, int.class)).isEqualTo(1);
        List<String> relations = dsl.select(REQUESTS.ITERATION_RELATION).from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq("D20")).orderBy(REQUESTS.AT, REQUESTS.ID)
                .fetch(REQUESTS.ITERATION_RELATION);
        assertThat(relations.getFirst()).isEqualTo("Originates");
        assertThat(relations.subList(1, relations.size())).containsOnly("Tracks");
        var eventRows = dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.in(dsl.select(REQUESTS.ID)
                .from(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq("D20"))))
                .and(EVENTS.CODE.eq("request.approved")).fetch();
        assertThat(eventRows).hasSize(asks);
        assertThat(eventRows.stream().map(row -> row.getCorrelationId()).distinct()).hasSize(1);
        assertThat(eventRows.getFirst().getCorrelationId()).startsWith("C-");
        JsonNode eventData = mapper.readTree(eventRows.getFirst().getData().data());
        assertThat(eventData.path("batchSize").asInt()).isEqualTo(asks);
        assertThat(eventData.path("iterationId").asString()).isEqualTo(iteration.getId());
        assertThat(dsl.selectCount().from(DOCUMENT_STATES).where(DOCUMENT_STATES.DOCUMENT_ID.eq("D20"))
                .fetchOne(0, int.class)).isEqualTo(1);
        assertThat(dsl.selectCount().from(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.eq(iteration.getId()))
                .fetchOne(0, int.class)).isEqualTo(1);
        assertThat(dsl.selectCount().from(REQUEST_STATES).where(REQUEST_STATES.DOCUMENT_ID.eq("D20"))
                .fetchOne(0, int.class)).isEqualTo(asks);
    }

    @Test
    void plainApprovalLeavesRescanActorNull() throws Exception {
        post("/api/requests/D25/approve", session("u8"), approval(), 200);
        assertThat(dsl.select(REQUESTS.RESCAN_ACTOR_ID).from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq("D25")).fetch(REQUESTS.RESCAN_ACTOR_ID))
                .containsOnlyNulls();
    }

    @Test
    void declineKeepsBothTextsOnRequestsAndEvents() throws Exception {
        String cookie = session("u8");
        JsonNode answer = post("/api/requests/D25/decline", cookie, Map.of(
                "publicText", "This title is already being digitized.",
                "internalText", "The archive confirmed the planned run."), 200);
        assertThat(answer.path("decision").asString()).isEqualTo("Denied");
        var request = dsl.selectFrom(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq("D25")).fetchOne();
        assertThat(request.getDecision()).isEqualTo("Denied");
        assertThat(request.getDeclineInternalText()).isEqualTo("The archive confirmed the planned run.");
        var event = dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq(request.getId())
                .and(EVENTS.CODE.eq("request.declined"))).fetchOne();
        assertThat(event.getReasonPublic()).isEqualTo("This title is already being digitized.");
        assertThat(event.getReasonInternal()).isEqualTo("The archive confirmed the planned run.");
    }

    @Test
    void approvesBatchLeavingExcludedAndRescanRowsPending() throws Exception {
        JsonNode answer = post("/api/requests/batches/B-0143/approve", session("u8"), Map.of(
                "categoryId", "c21", "priority", "Normal", "excludedIds", List.of("D28")), 200);
        assertThat(answer.path("approvedCount").asInt()).isEqualTo(3);
        assertThat(answer.path("rescanCount").asInt()).isEqualTo(1);
        assertThat(dsl.select(REQUESTS.DECISION).from(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq("D28"))
                .fetch(REQUESTS.DECISION)).containsOnly("Pending");
    }

    @Test
    void approvalRefusalsLeaveRequestsIterationsAndEventsUnchanged() throws Exception {
        String cookie = session("u8");
        int events = dsl.selectCount().from(EVENTS).fetchOne(0, int.class);
        int iterations = dsl.selectCount().from(ITERATIONS).fetchOne(0, int.class);
        post("/api/requests/D22/approve", cookie, approval(), 403);
        post("/api/requests/D24/approve", cookie, approval(), 409);
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(events);
        assertThat(dsl.selectCount().from(ITERATIONS).fetchOne(0, int.class)).isEqualTo(iterations);
        assertThat(dsl.select(REQUESTS.DECISION).from(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq("D22"))
                .fetch(REQUESTS.DECISION)).containsOnly("Pending");
    }

    @Test
    void refusalProblemMatchesEngineShapeWithoutInstance() throws Exception {
        JsonNode refusal = post("/api/requests/D22/approve", session("u8"), approval(), 403);
        assertThat(refusal).isEqualTo(mapper.readTree("""
                {
                  "type": "https://vera.mzk.cz/problems/proposal.outside_request_custody",
                  "title": "Forbidden",
                  "status": 403,
                  "detail": "This proposal is outside your request custody",
                  "code": "proposal.outside_request_custody"
                }
                """));
        assertThat(refusal.has("instance")).isFalse();
    }

    @Test
    void approvalRefusesAParentCategoryWithoutWriting() throws Exception {
        int events = dsl.selectCount().from(EVENTS).fetchOne(0, int.class);
        int iterations = dsl.selectCount().from(ITERATIONS).fetchOne(0, int.class);
        Map<String, Object> body = new LinkedHashMap<>(approval());
        body.put("categoryId", "c2");
        JsonNode refusal = post("/api/requests/D25/approve", session("u8"), body, 422);
        assertThat(refusal.path("code").asString()).isEqualTo("category.not_leaf");
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(events);
        assertThat(dsl.selectCount().from(ITERATIONS).fetchOne(0, int.class)).isEqualTo(iterations);
    }

    @Test
    void rescanNeedsANoteAndKeepsItOnTheOriginatingAskAndEvent() throws Exception {
        String cookie = session("u8");
        JsonNode refusal = post("/api/requests/D27/approve", cookie, approval(), 422);
        assertThat(refusal.path("code").asString()).isEqualTo("proposal.rescan_reason_missing");
        Map<String, Object> body = new LinkedHashMap<>(approval());
        body.put("rescanNote", "The existing copy is incomplete.");
        post("/api/requests/D27/approve", cookie, body, 200);
        var request = dsl.selectFrom(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq("D27")).fetchOne();
        assertThat(request.getRescanActorId()).isEqualTo("u8");
        assertThat(request.getRescanNote()).isEqualTo("The existing copy is incomplete.");
        var event = dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq(request.getId())
                .and(EVENTS.CODE.eq("request.approved"))).fetchOne();
        assertThat(event.getReasonInternal()).isEqualTo("The existing copy is incomplete.");
    }

    @Test
    void withdrawsOnlyOwnPendingAskAndRefusesOtherCases() throws Exception {
        postStatus("/api/requests/D21/withdraw", session("u10"), null, 403);
        JsonNode refused = post("/api/requests/D2/withdraw", session("u5"), null, 404);
        assertThat(refused.path("code").asString()).isEqualTo("request.not_asked");
        post("/api/requests/D21/withdraw", session("u5"), null, 200);
        JsonNode decided = post("/api/requests/D21/withdraw", session("u5"), null, 409);
        assertThat(decided.path("code").asString()).isEqualTo("proposal.decided");
        assertThat(dsl.select(REQUESTS.DECISION).from(REQUESTS).where(REQUESTS.ID.eq("R19"))
                .fetchOne(REQUESTS.DECISION)).isEqualTo("Withdrawn");
    }

    @Test
    void rejectsInvalidDecisionBodiesAtTheContractBoundary() {
        postStatus("/api/requests/D25/decline", session("u8"), Map.of(
                "publicText", " ", "internalText", "private"), 422);
        postStatus("/api/requests/D25/approve", session("u8"),
                Map.of("categoryId", "c21", "rescanNote", ""), 422);
    }

    @Test
    void allFourDecisionRoutesRequireASession() {
        postStatus("/api/requests/D20/approve", null, approval(), 401);
        postStatus("/api/requests/D25/decline", null, Map.of("publicText", "No", "internalText", "No"), 401);
        postStatus("/api/requests/D21/withdraw", null, null, 401);
        postStatus("/api/requests/batches/B-0143/approve", null,
                Map.of("categoryId", "c21", "priority", "Normal", "excludedIds", List.of()), 401);
    }

    private Map<String, Object> approval() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("categoryId", "c21");
        body.put("priority", "Normal");
        body.put("rescanNote", null);
        return body;
    }

    private JsonNode post(String path, String cookie, Object body, int status) throws Exception {
        var request = client.post().uri(URI.create(path)).contentType(MediaType.APPLICATION_JSON);
        if (cookie != null) {
            request.header("Cookie", cookie);
        }
        if (body != null) {
            request.body(body);
        }
        return mapper.readTree(request.exchange().expectStatus().isEqualTo(status)
                .expectBody(String.class).returnResult().getResponseBody());
    }

    private void postStatus(String path, String cookie, Object body, int status) {
        var request = client.post().uri(URI.create(path)).contentType(MediaType.APPLICATION_JSON);
        if (cookie != null) {
            request.header("Cookie", cookie);
        }
        if (body != null) {
            request.body(body);
        }
        request.exchange().expectStatus().isEqualTo(status);
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }
}

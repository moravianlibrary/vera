package cz.mzk.vera.validations;

import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_VERDICTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// ACT-accept; ACT-deny; ACT-revoke; STAT-gates-move-progress.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ValidationActTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private DSLContext dsl;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void acceptingLastOutstandingDefectMovesEnqueuedToReadyAndStoresEvent() throws Exception {
        JsonNode answer = post("/api/validations/IT16/accept", session("u8"),
                Map.of("defectKeys", new String[] {"pi9:R03:pages"}, "note", "An estimate is enough here."), 200);
        assertThat(answer.path("review").asString()).isEqualTo("Approved");
        assertThat(answer.path("progress").asString()).isEqualTo("Ready");
        assertThat(dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq("IT16")).fetchOne().getProgress())
                .isEqualTo("Ready");
        assertThat(dsl.selectFrom(ITERATION_STATES).where(ITERATION_STATES.ITERATION_ID.eq("IT16"))
                .fetchOne().getReviewState()).isEqualTo("Approved");
        assertThat(dsl.selectCount().from(ITERATION_VERDICTS)
                .where(ITERATION_VERDICTS.ITERATION_ID.eq("IT16")).fetchOne(0, int.class)).isEqualTo(1);
        assertThat(dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT16")
                .and(EVENTS.CODE.eq("iteration.verdict_accepted"))).fetchOne()).isNotNull();
    }

    @Test
    void denialRecordsPublicTextAndDeniedReview() throws Exception {
        Map<String, Object> denial = new LinkedHashMap<>();
        denial.put("defectKeys", new String[] {"pi9:R07:260$c"});
        denial.put("publicText", "The publication years are unclear on the record.");
        denial.put("internalText", null);
        JsonNode answer = post("/api/validations/IT13/deny", session("u8"), denial, 200);
        assertThat(answer.path("review").asString()).isEqualTo("Denied");
        var verdict = dsl.selectFrom(ITERATION_VERDICTS).where(ITERATION_VERDICTS.ITERATION_ID.eq("IT13"))
                .orderBy(ITERATION_VERDICTS.POSITION.desc()).limit(1).fetchOne();
        assertThat(verdict.getVerdict()).isEqualTo("Denied");
        assertThat(verdict.getPublicText()).isEqualTo("The publication years are unclear on the record.");
        assertThat(dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT13")
                .and(EVENTS.CODE.eq("iteration.verdict_denied"))).fetchOne()).isNotNull();
    }

    @Test
    void revokingAcceptanceMakesTheDefectOutstandingAgain() throws Exception {
        JsonNode answer = post("/api/validations/IT3/revoke", session("u8"),
                Map.of("defectKeys", new String[] {"pi9:R02:pages"}), 200);
        assertThat(answer.path("review").asString()).isEqualTo("Needed");
        assertThat(answer.path("progress").asString()).isEqualTo("Enqueued");
        assertThat(dsl.selectFrom(ITERATION_STATES).where(ITERATION_STATES.ITERATION_ID.eq("IT3"))
                .fetchOne().getReviewState()).isEqualTo("Needed");
        assertThat(dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT3")
                .and(EVENTS.CODE.eq("iteration.verdict_revoked"))).fetchOne()).isNotNull();
    }

    @Test
    void refusalsLeaveVerdictsAndEventsUntouched() throws Exception {
        String cookie = session("u8");
        int originalEvents = dsl.selectCount().from(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT3"))
                .fetchOne(0, int.class);
        Map<String, Object> changedBody = new LinkedHashMap<>();
        changedBody.put("defectKeys", new String[] {"pi9:R01:pages"});
        changedBody.put("note", null);
        post("/api/validations/IT19/accept", cookie,
                changedBody, 409);
        Map<String, Object> forbiddenBody = new LinkedHashMap<>();
        forbiddenBody.put("defectKeys", new String[] {"pi10:R01:041$a"});
        forbiddenBody.put("note", null);
        JsonNode forbidden = post("/api/validations/IT14/accept", cookie, forbiddenBody, 409);
        assertThat(forbidden.path("code").asString()).isEqualTo("validation.forbidden_by_rule");
        JsonNode changed = post("/api/validations/IT3/revoke", cookie,
                Map.of("defectKeys", new String[] {"missing"}), 409);
        assertThat(changed.path("code").asString()).isEqualTo("validation.defects_not_accepted");
        assertThat(dsl.selectCount().from(ITERATION_VERDICTS).where(ITERATION_VERDICTS.ITERATION_ID.eq("IT3"))
                .fetchOne(0, int.class)).isEqualTo(1);
        assertThat(dsl.selectCount().from(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT3"))
                .fetchOne(0, int.class)).isEqualTo(originalEvents);
    }

    @Test
    void allFourActsRequireASession() {
        client.post().uri("/api/validations/IT16/accept").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("defectKeys", new String[] {"pi9:R03:pages"}, "note", "Enough"))
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/validations/IT13/deny").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("defectKeys", new String[] {"pi9:R07:260$c"}, "publicText", "Reason",
                        "internalText", "Internal reason"))
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/validations/IT3/revoke").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("defectKeys", new String[] {"pi9:R02:pages"}))
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/batches/B1/retry").contentType(MediaType.APPLICATION_JSON).body(Map.of())
                .exchange().expectStatus().isUnauthorized();
    }

    @Test
    void retriesOnlyFailedBatchItemsAndKeepsFailureDetails() throws Exception {
        JsonNode answer = post("/api/batches/B-0141/retry", session("u3"), Map.of(), 200);
        assertThat(answer.path("batchId").asString()).isEqualTo("B-0141");
        assertThat(answer.path("retriedIds").get(0).asString()).isEqualTo("IT17");
        var iteration = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq("IT17")).fetchOne();
        assertThat(iteration.getProgress()).isEqualTo("Enqueued");
        assertThat(iteration.getIngestFailureAttempts()).isEqualTo(2);
        assertThat(iteration.getIngestFailureError())
                .isEqualTo("Catalog record MZK03-000601877 has no 245 field; the adapter rejected it.");
        var event = dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_KIND.eq("request")
                .and(EVENTS.SUBJECT_ID.eq(iteration.getRequestId()))
                .and(EVENTS.CODE.eq("request.ingest_retried"))).fetchOne();
        assertThat(event).isNotNull();
        assertThat(event.getCorrelationId()).isNotBlank();
        assertThat(post("/api/batches/B-0141/retry", session("u3"), Map.of(), 409)
                .path("code").asString()).isEqualTo("batch.no_failed_items");
    }

    @Test
    void retryRefusalsCoverPermissionBatchAndCustody() throws Exception {
        assertThat(post("/api/batches/B-0141/retry", session("u5"), Map.of(), 403)
                .path("detail").asString()).isEqualTo("You may not retry additions");
        assertThat(post("/api/batches/missing/retry", session("u3"), Map.of(), 404)
                .path("detail").asString()).isEqualTo("No such batch");
        assertThat(post("/api/batches/B-0141/retry", session("u8"), Map.of(), 403)
                .path("code").asString()).isEqualTo("batch.outside_custody");
        assertThat(dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq("IT17")).fetchOne().getProgress())
                .isEqualTo("IngestFailed");
    }

    private String session(String userId) {
        var response = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody().returnResult();
        return response.getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private JsonNode post(String path, String cookie, Object body, int status) throws Exception {
        String value = client.post().uri(path).header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                .body(body).exchange().expectStatus().isEqualTo(status).expectBody(String.class)
                .returnResult().getResponseBody();
        return value == null ? mapper.nullNode() : mapper.readTree(value);
    }
}

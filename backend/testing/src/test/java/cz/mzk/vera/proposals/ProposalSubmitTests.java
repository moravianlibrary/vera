package cz.mzk.vera.proposals;

import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.HOOK_EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.JOBS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_SUGGESTIONS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_STATES;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.nio.file.Path;
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

// ACT-propose; ENT-batch; LC-REQ-join; LC-REQ-approve-now; LOG-one-act-one-story.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ProposalSubmitTests {
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
    void submitsNewAndJoiningItemsInOneBatchWithSharedCreatedEventCorrelation() throws Exception {
        Map<String, Object> draft = draft(List.of(
                item("catalogId", "MZK01-001277001", "1940"),
                item("catalogId", "MZK01-001277001", "1936–1938"),
                item("catalogId", "MZK03-000556300", "1902")));
        JsonNode report = post(draft, "u5", 201);
        assertThat(report.path("proposed").asInt()).isEqualTo(1);
        assertThat(report.path("joined").asInt()).isEqualTo(1);
        assertThat(report.path("approved").asInt()).isZero();
        assertThat(report.path("batch").path("size").asInt()).isEqualTo(2);
        assertThat(report.path("skipped").size()).isEqualTo(1);
        List<String> ids = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(report.path("batch").path("id").asString()))
                .fetch(REQUESTS.ID);
        assertThat(ids).hasSize(2);
        assertThat(dsl.select(REQUESTS.CHECKED_AT).from(REQUESTS).where(REQUESTS.ID.in(ids))
                .fetch(REQUESTS.CHECKED_AT)).containsOnlyNulls();
        assertThat(dsl.fetchCount(JOBS, JOBS.KIND.eq("proposal.check").and(JOBS.STATE.eq("due"))))
                .isEqualTo(2);
        var createdEvents = dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.in(ids))
                .and(EVENTS.CODE.eq("request.created")).fetch();
        assertThat(createdEvents).hasSize(2);
        assertThat(createdEvents.stream().map(row -> row.getCorrelationId()).distinct()).hasSize(1);
        assertThat(dsl.fetchCount(BATCHES)).isEqualTo(51);
        String newDocument = dsl.select(REQUESTS.DOCUMENT_ID).from(REQUESTS)
                .where(REQUESTS.ID.in(ids)).and(REQUESTS.DOCUMENT_ID.ne("D8"))
                .fetchOne(REQUESTS.DOCUMENT_ID);
        assertThat(dsl.fetchCount(DOCUMENTS, DOCUMENTS.ID.eq(newDocument))).isEqualTo(1);
        assertThat(dsl.fetchCount(DOCUMENT_PROPERTY_SOURCES,
                DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(newDocument))).isEqualTo(2);
        assertThat(dsl.fetchCount(DOCUMENT_STATES,
                DOCUMENT_STATES.DOCUMENT_ID.eq(newDocument))).isEqualTo(1);
        assertThat(dsl.select(REQUEST_PLACEMENTS.REQUEST_ID).from(REQUEST_PLACEMENTS)
                .where(REQUEST_PLACEMENTS.REQUEST_ID.in(ids))
                .fetch(REQUEST_PLACEMENTS.REQUEST_ID)).allMatch(ids::contains);
        ids.forEach(id -> assertThat(dsl.fetchCount(REQUEST_STATES,
                REQUEST_STATES.REQUEST_ID.eq(id))).isEqualTo(1));
        assertThat(ids.stream().map(id -> dsl.select(REQUESTS.DOCUMENT_ID).from(REQUESTS)
                .where(REQUESTS.ID.eq(id)).fetchOne(REQUESTS.DOCUMENT_ID)).distinct()).hasSize(2);
    }

    @Test
    void recordsReaderSubmitResponse() throws Exception {
        JsonNode report = assertRecordedSubmit("a-reader-then-admin-and-reader-pages", "u5", 0);
        String documentId = dsl.select(REQUESTS.DOCUMENT_ID).from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(report.path("batch").path("id").asString()))
                .and(REQUESTS.DOCUMENT_ID.ne("D8")).fetchOne(REQUESTS.DOCUMENT_ID);
        JsonNode detail = mapper.readTree(client.get().uri("/api/documents/" + documentId + "?perspective=my")
                .header("Cookie", session("u5")).exchange().expectStatus().isOk().expectBody(String.class)
                .returnResult().getResponseBody());
        assertThat(detail.path("record").path("document").path("properties").get(0).path("key"))
                .isEqualTo(mapper.readTree("\"title\""));
        assertThat(detail.path("record").path("document").path("properties").get(1).path("key"))
                .isEqualTo(mapper.readTree("\"material_type\""));
    }

    @Test
    void readerSubmitJobsDoNotFail() throws Exception {
        assertRecordedSubmit("a-reader-then-admin-and-reader-pages", "u5", 0);
        JsonNode report = runJobs();
        assertThat(report.path("failed").asInt()).as("failed jobs in the control response").isZero();
        var failures = dsl.select(JOBS.KIND, JOBS.ERROR).from(JOBS)
                .where(JOBS.STATE.eq("failed")).fetch();
        assertThat(failures).as("failed jobs (kind and error)").isEmpty();
    }

    @Test
    void readerCheckOfARecordNoRegistryHoldsStoresNoCopy() throws Exception {
        JsonNode submitted = assertRecordedSubmit("a-reader-then-admin-and-reader-pages", "u5", 0);
        String requestId = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(submitted.path("batch").path("id").asString()))
                .and(REQUESTS.DOCUMENT_ID.ne("D8")).fetchOne(REQUESTS.ID);
        String documentId = dsl.select(REQUESTS.DOCUMENT_ID).from(REQUESTS)
                .where(REQUESTS.ID.eq(requestId)).fetchOne(REQUESTS.DOCUMENT_ID);
        assertThat(runJobs().path("failed").asInt()).isZero();
        JsonNode detail = mapper.readTree(client.get().uri("/api/documents/" + documentId + "?perspective=my")
                .header("Cookie", session("u5")).exchange().expectStatus().isOk().expectBody(String.class)
                .returnResult().getResponseBody());
        assertThat(detail.path("record").path("document").path("registryRecords").size()).isZero();
        assertThat(dsl.select(REQUESTS.CHECKED_AT).from(REQUESTS).where(REQUESTS.ID.eq(requestId))
                .fetchOne(REQUESTS.CHECKED_AT)).isNotNull();
        assertThat(dsl.fetchExists(dsl.selectFrom(REQUEST_EXISTING_COPIES)
                .where(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(requestId)))).isFalse();
    }

    @Test
    void recordedReaderAndProjectSubmissionsGetClassifierSuggestionsAfterChecks() throws Exception {
        JsonNode reader = assertRecordedSubmit("a-reader-then-admin-and-reader-pages", "u5", 0);
        runJobs();
        assertClassifierSuggestion(reader.path("batch").path("id").asString());

        reset.reset("base", true);
        JsonNode project = assertRecordedSubmit("c-project-user-project-custody", "u9", 0);
        runJobs();
        assertClassifierSuggestion(project.path("batch").path("id").asString());
    }

    @Test
    void recordsApproveNowSubmitResponse() throws Exception {
        assertRecordedSubmit("b-admin-approve-now", "u3", 0);
    }

    @Test
    void recordsProjectCustodySubmitResponse() throws Exception {
        assertRecordedSubmit("c-project-user-project-custody", "u9", 0);
    }

    @Test
    void recordsDailyLimitSubmitResponses() throws Exception {
        giveProposalRole("u5", 10, 2);
        assertRecordedSubmit("proposal-daily-limit", "u5", 0);
        var call = recordedSubmit("proposal-daily-limit", 1);
        String cookie = session("u5");
        String body = client.post().uri("/api/proposals").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(call.path("requestBody")).exchange()
                .expectStatus().isEqualTo(call.path("status").asInt()).expectBody(String.class)
                .returnResult().getResponseBody();
        assertThat(body).contains("proposal.daily_limit");
    }

    @Test
    void joiningMovingWorkTracksCurrentIterationAsDuplicate() {
        dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, "InProgress")
                .where(ITERATIONS.ID.eq("IT8")).execute();
        JsonNode report = post(draft(List.of(item("catalogId", "MZK01-001277001", "1936–1938"))),
                "u5", 201);
        String requestId = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(report.path("batch").path("id").asString()))
                .fetchOne(REQUESTS.ID);
        var request = dsl.select(REQUESTS.DECISION, REQUESTS.TRACKS_ITERATION_ID).from(REQUESTS)
                .where(REQUESTS.ID.eq(requestId)).fetchOne();
        assertThat(request.get(REQUESTS.DECISION)).isEqualTo("Duplicate");
        assertThat(request.get(REQUESTS.TRACKS_ITERATION_ID)).isEqualTo("IT8");
    }

    @Test
    void approveNowHoldsUntilCheckThenCreatesItsIteration() {
        Map<String, Object> draft = draft(List.of(item("catalogId", "MZK03-000778120", null)));
        draft.put("approval", Map.of("categoryId", "c21", "priority", "Normal"));
        JsonNode report = post(draft, "u3", 201);
        assertThat(report.path("proposed").asInt()).isEqualTo(1);
        assertThat(report.path("approved").asInt()).isZero();
        String requestId = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(report.path("batch").path("id").asString()))
                .fetchOne(REQUESTS.ID);
        assertThat(dsl.select(REQUESTS.DECISION).from(REQUESTS).where(REQUESTS.ID.eq(requestId))
                .fetchOne(REQUESTS.DECISION)).isEqualTo("Pending");
        assertThat(dsl.select(EVENTS.CODE).from(EVENTS).where(EVENTS.SUBJECT_ID.eq(requestId))
                .fetch(EVENTS.CODE)).containsExactly("request.created", "request.held");
        runJobs();
        assertThat(dsl.select(REQUESTS.DECISION).from(REQUESTS).where(REQUESTS.ID.eq(requestId))
                .fetchOne(REQUESTS.DECISION)).isEqualTo("Approved");
        assertThat(dsl.fetchCount(EVENTS, EVENTS.SUBJECT_ID.eq(requestId))).isEqualTo(3);
        String iterationId = dsl.select(REQUESTS.ITERATION_ID).from(REQUESTS)
                .where(REQUESTS.ID.eq(requestId)).fetchOne(REQUESTS.ITERATION_ID);
        assertThat(dsl.fetchCount(ITERATION_STATES,
                ITERATION_STATES.ITERATION_ID.eq(iterationId))).isEqualTo(1);
        assertThat(dsl.fetchCount(DOCUMENT_STATES, DOCUMENT_STATES.DOCUMENT_ID.eq(
                dsl.select(REQUESTS.DOCUMENT_ID).from(REQUESTS).where(REQUESTS.ID.eq(requestId))
                        .fetchOne(REQUESTS.DOCUMENT_ID)))).isEqualTo(1);
        assertThat(dsl.fetchCount(REQUEST_STATES, REQUEST_STATES.REQUEST_ID.eq(requestId))).isEqualTo(1);
    }

    @Test
    void submittedProposalIsUncheckedUntilItsJobStoresTheRegistryCopy() {
        JsonNode report = post(draft(List.of(item("catalogId", "MZK01-001277001", "1939"))), "u5", 201);
        String requestId = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(report.path("batch").path("id").asString()))
                .fetchOne(REQUESTS.ID);
        assertThat(dsl.select(REQUESTS.CHECKED_AT).from(REQUESTS).where(REQUESTS.ID.eq(requestId))
                .fetchOne(REQUESTS.CHECKED_AT)).isNull();
        assertThat(dsl.fetchCount(REQUEST_EXISTING_COPIES,
                REQUEST_EXISTING_COPIES.REQUEST_ID.eq(requestId))).isZero();
        runJobs();
        assertThat(dsl.select(REQUESTS.CHECKED_AT).from(REQUESTS).where(REQUESTS.ID.eq(requestId))
                .fetchOne(REQUESTS.CHECKED_AT)).isNotNull();
        assertThat(dsl.select(REQUEST_EXISTING_COPIES.SOURCE).from(REQUEST_EXISTING_COPIES)
                .where(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(requestId))
                .fetch(REQUEST_EXISTING_COPIES.SOURCE)).contains("Kramerius");
        assertThat(dsl.select(REQUEST_EXISTING_COPIES.LINK).from(REQUEST_EXISTING_COPIES)
                .where(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(requestId))
                .fetch(REQUEST_EXISTING_COPIES.LINK))
                .contains("https://kramerius.mzk.cz/view/uuid:demo-new-volume");
    }

    @Test
    void decisionsRefuseApprovalUntilProposalChecksRun() {
        Map<String, Object> submitted = draft(List.of(item("catalogId", "MZK01-001277001", "1940")));
        JsonNode report = post(submitted, "u5", 201);
        String requestId = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(report.path("batch").path("id").asString()))
                .fetchOne(REQUESTS.ID);
        String documentId = dsl.select(REQUESTS.DOCUMENT_ID).from(REQUESTS)
                .where(REQUESTS.ID.eq(requestId)).fetchOne(REQUESTS.DOCUMENT_ID);
        Map<String, Object> approval = new LinkedHashMap<>();
        approval.put("categoryId", "c21");
        approval.put("priority", "Normal");
        approval.put("rescanNote", null);
        client.post().uri("/api/requests/" + documentId + "/approve").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(approval)
                .exchange().expectStatus().isEqualTo(409).expectBody()
                .jsonPath("$.code").isEqualTo("proposal.checks_pending");
    }

    @Test
    void failedRegistryCheckLeavesTheAskUncheckedAndSchedulesARetry() {
        reset.reset("l78b-registry-failure", true);
        JsonNode report = post(draft(List.of(item("catalogId", "MZK01-001277001", "1939"))), "u5", 201);
        String requestId = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(report.path("batch").path("id").asString()))
                .fetchOne(REQUESTS.ID);
        runJobs();
        assertThat(dsl.select(REQUESTS.CHECKED_AT).from(REQUESTS).where(REQUESTS.ID.eq(requestId))
                .fetchOne(REQUESTS.CHECKED_AT)).isNull();
        var retry = dsl.selectFrom(JOBS).where(JOBS.KIND.eq("proposal.check").and(JOBS.STATE.eq("due")))
                .fetchOne();
        assertThat(retry).isNotNull();
        assertThat(retry.getDueAt().toInstant()).isAfter(dsl.select(REQUESTS.AT).from(REQUESTS)
                .where(REQUESTS.ID.eq(requestId)).fetchOne(REQUESTS.AT).toInstant());
    }

    @Test
    void approveNowWithAnExistingCopyStaysPendingAfterItsCheck() {
        Map<String, Object> draft = draft(List.of(item("catalogId", "MZK01-001277001", "1939")));
        draft.put("approval", Map.of("categoryId", "c21", "priority", "Normal"));
        JsonNode report = post(draft, "u3", 201);
        String requestId = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(report.path("batch").path("id").asString()))
                .fetchOne(REQUESTS.ID);
        assertThat(dsl.select(HOOK_EVENTS.CODE).from(HOOK_EVENTS)
                .where(HOOK_EVENTS.SUBJECT_ID.eq(requestId)).fetch(HOOK_EVENTS.CODE))
                .contains("request.created", "request.held");
        runJobs();
        assertThat(dsl.select(REQUESTS.DECISION).from(REQUESTS).where(REQUESTS.ID.eq(requestId))
                .fetchOne(REQUESTS.DECISION)).isEqualTo("Pending");
        assertThat(dsl.fetchCount(cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES,
                cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES.REQUEST_ID.eq(requestId)))
                .isGreaterThan(0);
        assertThat(dsl.select(HOOK_EVENTS.CORRELATION_ID).from(HOOK_EVENTS)
                .where(HOOK_EVENTS.SUBJECT_ID.eq(requestId)).fetch(HOOK_EVENTS.CORRELATION_ID).stream()
                .distinct()).hasSize(1);
    }

    @Test
    void nothingAcceptedReturnsNullBatchAndWritesNoBatch() {
        Map<String, Object> draft = draft(List.of(item("catalogId", "MZK01-001622010", "1889")));
        int before = dsl.fetchCount(BATCHES);
        JsonNode report = post(draft, "u6", 201);
        assertThat(report.path("batch").isNull()).isTrue();
        assertThat(report.path("skipped")).hasSize(1);
        assertThat(dsl.fetchCount(BATCHES)).isEqualTo(before);
    }

    @Test
    void submitRequiresASession() {
        client.post().uri("/api/proposals").contentType(MediaType.APPLICATION_JSON)
                .body(draft(List.of(item("catalogId", "MZK03-000778120", null))))
                .exchange().expectStatus().isUnauthorized();
    }

    @Test
    void tooManyItemsRefusesWithoutWriting() {
        Map<String, Object> draft = draft(List.of(
                item("catalogId", "MZK03-000778120", null),
                item("catalogId", "MZK03-000778120", null),
                item("catalogId", "MZK03-000778120", null),
                item("catalogId", "MZK03-000778120", null),
                item("catalogId", "MZK03-000778120", null)));
        dsl.deleteFrom(USER_HAND_ROLES).where(USER_HAND_ROLES.USER_ID.eq("u5")).execute();
        dsl.deleteFrom(USER_MAPPED_ROLES).where(USER_MAPPED_ROLES.USER_ID.eq("u5")).execute();
        giveProposalRole("u5", 2, null);
        int batchCount = dsl.fetchCount(BATCHES);
        post(draft, "u5", 422);
        assertThat(dsl.fetchCount(BATCHES)).isEqualTo(batchCount);
    }

    @Test
    void dailyLimitRefusesTheWholeSubmissionWithoutWriting() {
        giveProposalRole("u5", 10, 2);
        Map<String, Object> first = draft(List.of(
                item("catalogId", "MZK01-001277001", "1940"),
                item("catalogId", "MZK01-001277001", "1936–1938")));
        int batchCount = dsl.fetchCount(BATCHES);
        post(first, "u5", 201);
        Map<String, Object> next = draft(List.of(item("catalogId", "VKOL01-000456123", "1941")));
        client.post().uri("/api/proposals").header("Cookie", session("u5"))
                .contentType(MediaType.APPLICATION_JSON).body(next).exchange().expectStatus()
                .isEqualTo(429).expectBody().jsonPath("$.code").isEqualTo("proposal.daily_limit");
        assertThat(dsl.fetchCount(BATCHES)).isEqualTo(batchCount + 1);
    }

    @Test
    void projectUserCanSubmitIntoTheirApprovedProject() {
        Map<String, Object> draft = draft(List.of(item("catalogId", "MZK01-001277001", "1940")));
        draft.put("projectId", "p1");
        JsonNode report = post(draft, "u9", 201);
        assertThat(report.path("proposed").asInt()).isEqualTo(1);
        assertThat(report.path("batch").path("size").asInt()).isEqualTo(1);
    }

    @Test
    void rejectedProjectRefusesForItsMemberWithoutWriting() {
        Map<String, Object> draft = draft(List.of(item("catalogId", "MZK03-000778120", null)));
        draft.put("projectId", "p9");
        int batchCount = dsl.fetchCount(BATCHES);
        client.post().uri("/api/proposals").header("Cookie", session("u4"))
                .contentType(MediaType.APPLICATION_JSON).body(draft).exchange().expectStatus()
                .isEqualTo(422).expectBody().jsonPath("$.code").isEqualTo("project.not_proposable");
        assertThat(dsl.fetchCount(BATCHES)).isEqualTo(batchCount);
    }

    @Test
    void approvalWithoutDecisionPermissionRefusesWithoutWriting() {
        giveProposalRole("u5", null, null);
        Map<String, Object> draft = draft(List.of(item("catalogId", "MZK03-000778120", null)));
        draft.put("approval", Map.of("categoryId", "c21", "priority", "Normal"));
        int batchCount = dsl.fetchCount(BATCHES);
        client.post().uri("/api/proposals").header("Cookie", session("u5"))
                .contentType(MediaType.APPLICATION_JSON).body(draft).exchange().expectStatus()
                .isForbidden().expectBody().jsonPath("$.detail").isEqualTo("You may not propose this");
        assertThat(dsl.fetchCount(BATCHES)).isEqualTo(batchCount);
    }

    private JsonNode post(Map<String, Object> draft, String userId, int status) {
        String body = client.post().uri("/api/proposals").header("Cookie", session(userId))
                .contentType(MediaType.APPLICATION_JSON).body(draft).exchange().expectStatus()
                .isEqualTo(status).expectBody(String.class).returnResult().getResponseBody();
        try {
            return mapper.readTree(body);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private JsonNode runJobs() {
        String body = client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody();
        try {
            return mapper.readTree(body);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void assertClassifierSuggestion(String batchId) {
        var suggestions = dsl.select(REQUEST_SUGGESTIONS.CATEGORY_ID, REQUEST_SUGGESTIONS.CLASSIFIER_ID)
                .from(REQUEST_SUGGESTIONS.join(REQUESTS)
                        .on(REQUESTS.ID.eq(REQUEST_SUGGESTIONS.REQUEST_ID)))
                .where(REQUESTS.BATCH_ID.eq(batchId))
                .and(REQUEST_SUGGESTIONS.CATEGORY_ID.eq("c21"))
                .and(REQUEST_SUGGESTIONS.CLASSIFIER_ID.eq("pi30"))
                .fetch();
        assertThat(suggestions).isNotEmpty().allSatisfy(suggestion -> {
            assertThat(suggestion.get(REQUEST_SUGGESTIONS.CATEGORY_ID)).isEqualTo("c21");
            assertThat(suggestion.get(REQUEST_SUGGESTIONS.CLASSIFIER_ID)).isEqualTo("pi30");
        });
    }

    private JsonNode assertRecordedSubmit(String scenarioName, String userId, int callIndex) throws Exception {
        JsonNode call = recordedSubmit(scenarioName, callIndex);
        String body = client.post().uri("/api/proposals").header("Cookie", session(userId))
                .contentType(MediaType.APPLICATION_JSON).body(call.path("requestBody")).exchange()
                .expectStatus().isEqualTo(call.path("status").asInt()).expectBody(String.class)
                .returnResult().getResponseBody();
        JsonNode actual = mapper.readTree(body);
        JsonNode expected = call.path("body");
        assertThat(actual.path("batch").path("id").asString()).matches("B-\\d{4}");
        assertThat(actual.path("batch").path("name")).isEqualTo(expected.path("batch").path("name"));
        assertThat(actual.path("batch").path("submittedBy"))
                .isEqualTo(expected.path("batch").path("submittedBy"));
        assertThat(actual.path("batch").path("submittedAt").asString())
                .matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z");
        assertThat(actual.path("batch").path("source")).isEqualTo(expected.path("batch").path("source"));
        assertThat(actual.path("batch").path("size")).isEqualTo(expected.path("batch").path("size"));
        assertThat(actual.path("proposed")).isEqualTo(expected.path("proposed"));
        assertThat(actual.path("approved")).isEqualTo(expected.path("approved"));
        assertThat(actual.path("joined")).isEqualTo(expected.path("joined"));
        assertThat(actual.path("skipped")).isEqualTo(expected.path("skipped"));
        return actual;
    }

    private JsonNode recordedSubmit(String scenarioName, int callIndex) throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-proposals.json").toFile());
        for (JsonNode scenario : recording.path("scenarios")) {
            if (scenario.path("name").asString().equals(scenarioName)) {
                List<JsonNode> calls = new ArrayList<>();
                for (JsonNode call : scenario.path("calls")) {
                    if (call.path("method").asString().equals("POST")
                            && call.path("path").asString().equals("/api/proposals")) {
                        calls.add(call);
                    }
                }
                return calls.get(callIndex);
            }
        }
        throw new IllegalArgumentException("Unknown recorded proposal scenario: " + scenarioName);
    }

    private Map<String, Object> draft(List<Map<String, Object>> items) {
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("items", items);
        draft.put("reason", null);
        draft.put("projectId", null);
        draft.put("batchName", null);
        draft.put("approval", null);
        draft.put("entrySourceId", null);
        return draft;
    }

    private Map<String, Object> item(String type, String value, String unit) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("type", type);
        item.put("value", value);
        item.put("unit", unit);
        item.put("reason", null);
        return item;
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void giveProposalRole(String userId, Integer batchLimit, Integer dailyLimit) {
        dsl.deleteFrom(USER_HAND_ROLES).where(USER_HAND_ROLES.USER_ID.eq(userId)).execute();
        dsl.deleteFrom(USER_MAPPED_ROLES).where(USER_MAPPED_ROLES.USER_ID.eq(userId)).execute();
        dsl.insertInto(ROLES).set(ROLES.ID, "submit-limit").set(ROLES.NAME, "submit-limit")
                .set(ROLES.DESCRIPTION, "Proposal test").set(ROLES.IS_SHIPPED, false)
                .set(ROLES.PROPOSAL_BATCH_LIMIT, batchLimit).set(ROLES.PROPOSAL_DAILY_LIMIT, dailyLimit)
                .set(ROLES.POSITION, 100).execute();
        dsl.insertInto(ROLE_GRANTS).set(ROLE_GRANTS.ROLE_ID, "submit-limit")
                .set(ROLE_GRANTS.POSITION, 0).set(ROLE_GRANTS.PERMISSION, "request.create")
                .set(ROLE_GRANTS.SCOPE, (String) null).execute();
        dsl.insertInto(USER_HAND_ROLES).set(USER_HAND_ROLES.USER_ID, userId)
                .set(USER_HAND_ROLES.ROLE_ID, "submit-limit").set(USER_HAND_ROLES.POSITION, 0).execute();
    }
}

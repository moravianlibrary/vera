package cz.mzk.vera.ingest;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_REGISTRY_RECORDS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.JOBS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.fakes.FakeIngest;
import cz.mzk.vera.testing.seeds.SeedReader;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import tools.jackson.databind.json.JsonMapper;

// LC-ITER-ingest; B5; STAT-defect-key; STAT-gates.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class IngestTests {
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
    private IngestQueue ingestQueue;
    @Autowired
    private FakeIngest fakeIngest;
    @Autowired
    private SeedReader seeds;
    @Autowired
    private JsonMapper json;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void approvingASeededRequestQueuesAndRunsIngest() throws Exception {
        Map<String, Object> approval = new java.util.LinkedHashMap<>();
        approval.put("categoryId", "c21");
        approval.put("priority", "Normal");
        approval.put("rescanNote", null);
        post("/api/requests/D20/approve", "u8", approval, 200);
        String iterationId = dsl.select(ITERATIONS.ID).from(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq("D20"))
                .fetchOne(ITERATIONS.ID);
        assertThat(dsl.fetchCount(JOBS, JOBS.KIND.eq("ingest").and(JOBS.STATE.eq("due")))).isEqualTo(1);
        runJobs();
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq(iterationId))
                .fetchOne(ITERATIONS.PROGRESS)).withFailMessage("ingest error: %s",
                        dsl.select(ITERATIONS.INGEST_FAILURE_ERROR).from(ITERATIONS)
                                .where(ITERATIONS.ID.eq(iterationId)).fetchOne(ITERATIONS.INGEST_FAILURE_ERROR))
                .isEqualTo("Ready");
        assertThat(dsl.fetchCount(ITERATION_DEFECTS, ITERATION_DEFECTS.ITERATION_ID.eq(iterationId))).isZero();
        assertThat(dsl.fetchCount(DOCUMENT_REGISTRY_RECORDS,
                DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq("D20"))).isGreaterThan(0);
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS).where(EVENTS.SUBJECT_ID.eq(iterationId)
                .and(EVENTS.CODE.eq("iteration.ingested"))))).isTrue();
    }

    @Test
    void ingestSkipsAPropertySourceWithoutOnIngest() throws Exception {
        submitNew("l67-ingest");
        runJobs();
        String iterationId = iterationFor("MZK03-000778120");
        assertThat(dsl.fetchCount(ITERATION_PROPERTY_SOURCES,
                ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iterationId)
                        .and(ITERATION_PROPERTY_SOURCES.KEY.eq("page_count")))).isZero();
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq(iterationId))
                .fetchOne(ITERATIONS.PROGRESS)).isNotEqualTo("IngestFailed");
    }

    @Test
    void refusedApprovalQueuesNoIngestJob() {
        int before = dsl.fetchCount(JOBS, JOBS.KIND.eq("ingest"));
        Map<String, Object> approval = new java.util.LinkedHashMap<>();
        approval.put("categoryId", "c21");
        approval.put("priority", "Normal");
        approval.put("rescanNote", null);
        post("/api/requests/D22/approve", "u8", approval, 403);
        assertThat(dsl.fetchCount(JOBS, JOBS.KIND.eq("ingest"))).isEqualTo(before);
    }

    @Test
    void approveNowWithoutAnIngestEntryHasNoFindingsAndBecomesReady() throws Exception {
        submitNew("base");
        runJobs();
        String iterationId = iterationFor("MZK03-000778120");
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq(iterationId))
                .fetchOne(ITERATIONS.PROGRESS)).isEqualTo("Ready");
        assertThat(dsl.fetchCount(ITERATION_DEFECTS, ITERATION_DEFECTS.ITERATION_ID.eq(iterationId))).isZero();
    }

    @Test
    void approveNowUsesTheCatalogsIngestEntry() throws Exception {
        submitNew("bk4h-ingest-answer");
        runJobs();
        String iterationId = iterationFor("MZK03-000778120");
        assertThat(dsl.fetchExists(dsl.selectOne().from(ITERATION_DEFECTS)
                .where(ITERATION_DEFECTS.ITERATION_ID.eq(iterationId))
                .and(ITERATION_DEFECTS.KEY.eq("pi9:R88:title")))).isTrue();
        assertThat(dsl.fetchExists(dsl.selectOne().from(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iterationId)
                        .and(ITERATION_PROPERTY_SOURCES.KEY.eq("page_count"))))).isTrue();
        assertThat(dsl.fetchExists(dsl.selectOne().from(DOCUMENT_PAGE_SOURCES)
                .where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.eq(documentFor(iterationId))
                        .and(DOCUMENT_PAGE_SOURCES.SOURCE.eq("catalog"))
                        .and(DOCUMENT_PAGE_SOURCES.VALUE.eq(23))))).isTrue();
        OffsetDateTime firstSeen = OffsetDateTime.parse("2020-01-01T00:00:00Z");
        dsl.update(ITERATION_DEFECTS).set(ITERATION_DEFECTS.FIRST_SEEN_AT, firstSeen)
                .where(ITERATION_DEFECTS.ITERATION_ID.eq(iterationId)).execute();
        dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, "Enqueued").where(ITERATIONS.ID.eq(iterationId)).execute();
        ingestQueue.queue(dsl, iterationId);
        runJobs();
        assertThat(dsl.select(ITERATION_DEFECTS.FIRST_SEEN_AT).from(ITERATION_DEFECTS)
                .where(ITERATION_DEFECTS.ITERATION_ID.eq(iterationId)
                        .and(ITERATION_DEFECTS.KEY.eq("pi9:R88:title")))
                .fetchOne(ITERATION_DEFECTS.FIRST_SEEN_AT)).isEqualTo(firstSeen);
    }

    @ParameterizedTest
    @CsvSource({
        "unavailable,bk4h-ingest-unavailable",
        "timeout,bk4h-ingest-timeout",
        "malformed,bk4h-ingest-malformed"
    })
    void failedPluginCallsKeepTheirErrorAndCanBeRetried(String fault, String seed) throws Exception {
        reset.reset(seed, true);
        approveD20();
        String iterationId = dsl.select(ITERATIONS.ID).from(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq("D20"))
                .fetchOne(ITERATIONS.ID);
        int defectsBefore = dsl.fetchCount(ITERATION_DEFECTS,
                ITERATION_DEFECTS.ITERATION_ID.eq(iterationId));
        int registryBefore = dsl.fetchCount(DOCUMENT_REGISTRY_RECORDS,
                DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq("D20"));
        runJobs();
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq(iterationId))
                .fetchOne(ITERATIONS.PROGRESS)).isEqualTo("IngestFailed");
        assertThat(dsl.select(ITERATIONS.INGEST_FAILURE_ERROR).from(ITERATIONS)
                .where(ITERATIONS.ID.eq(iterationId)).fetchOne(ITERATIONS.INGEST_FAILURE_ERROR))
                .as("fault: %s", fault).contains("Kramerius");
        assertThat(dsl.fetchCount(ITERATION_DEFECTS, ITERATION_DEFECTS.ITERATION_ID.eq(iterationId)))
                .isEqualTo(defectsBefore);
        assertThat(dsl.fetchCount(DOCUMENT_REGISTRY_RECORDS,
                DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq("D20"))).isEqualTo(registryBefore);
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS).where(EVENTS.SUBJECT_ID.eq(iterationId)
                .and(EVENTS.CODE.eq("iteration.ingest_failed"))))).isTrue();
        fakeIngest.reset(seeds.read("base"));
        dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, "Enqueued").where(ITERATIONS.ID.eq(iterationId)).execute();
        ingestQueue.queue(dsl, iterationId);
        runJobs();
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS).where(EVENTS.SUBJECT_ID.eq(iterationId)
                .and(EVENTS.CODE.eq("iteration.ingested"))))).isTrue();
    }

    @Test
    void staleAttemptDoesNotWriteIngestResults() {
        var iteration = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq("IT25")).fetchOne();
        dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, "Ready").where(ITERATIONS.ID.eq("IT25")).execute();
        int defects = dsl.fetchCount(ITERATION_DEFECTS, ITERATION_DEFECTS.ITERATION_ID.eq("IT25"));
        int records = dsl.fetchCount(DOCUMENT_REGISTRY_RECORDS,
                DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq(iteration.getDocumentId()));
        ingestQueue.queue(dsl, "IT25");
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
        assertThat(dsl.fetchCount(ITERATION_DEFECTS, ITERATION_DEFECTS.ITERATION_ID.eq("IT25")))
                .isEqualTo(defects);
        assertThat(dsl.fetchCount(DOCUMENT_REGISTRY_RECORDS,
                DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq(iteration.getDocumentId()))).isEqualTo(records);
    }

    private void runJobs() throws Exception {
        String response = client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody();
        JsonNode report = json.readTree(response);
        assertThat(report.path("failed").asInt()).isZero();
    }

    private void submitNew(String seed) {
        reset.reset(seed, true);
        Map<String, Object> item = new java.util.LinkedHashMap<>();
        item.put("type", "catalogId");
        item.put("value", "MZK03-000778120");
        item.put("unit", null);
        item.put("reason", null);
        Map<String, Object> draft = new java.util.LinkedHashMap<>();
        draft.put("items", java.util.List.of(item));
        draft.put("reason", null);
        draft.put("projectId", null);
        draft.put("batchName", null);
        draft.put("approval", Map.of("categoryId", "c21", "priority", "Normal"));
        draft.put("entrySourceId", null);
        client.post().uri("/api/proposals").contentType(MediaType.APPLICATION_JSON)
                .header("Cookie", session("u8")).body(draft).exchange().expectStatus().isCreated();
    }

    private void approveD20() {
        Map<String, Object> approval = new java.util.LinkedHashMap<>();
        approval.put("categoryId", "c21");
        approval.put("priority", "Normal");
        approval.put("rescanNote", null);
        post("/api/requests/D20/approve", "u8", approval, 200);
    }

    private String iterationFor(String catalogId) {
        String documentId = dsl.select(DOCUMENTS.ID).from(DOCUMENTS)
                .where(DOCUMENTS.CATALOG_ID.eq(catalogId)).fetchOne(DOCUMENTS.ID);
        return dsl.select(ITERATIONS.ID).from(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq(documentId))
                .fetchOne(ITERATIONS.ID);
    }

    private String documentFor(String iterationId) {
        return dsl.select(ITERATIONS.DOCUMENT_ID).from(ITERATIONS).where(ITERATIONS.ID.eq(iterationId))
                .fetchOne(ITERATIONS.DOCUMENT_ID);
    }

    private void post(String path, String userId, Object body, int status) {
        client.post().uri(URI.create(path)).contentType(MediaType.APPLICATION_JSON)
                .header("Cookie", session(userId)).body(body).exchange().expectStatus().isEqualTo(status);
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }
}

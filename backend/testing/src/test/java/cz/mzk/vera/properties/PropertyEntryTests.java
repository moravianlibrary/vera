package cz.mzk.vera.properties;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
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
import tools.jackson.databind.json.JsonMapper;

// DOC-property-hand; ACT-property-entry: one document or selection, including every refusal.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class PropertyEntryTests {
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
    private JsonMapper json;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void entersADocumentValueWithItsHandTierAndEvent() throws Exception {
        String cookie = session("u3");
        JsonNode result = put("/api/documents/D1/properties/size", cookie, Map.of("value", "A3"), 200);
        assertThat(result.path("isRechecked").asBoolean()).isFalse();
        var hand = dsl.selectFrom(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq("D1")
                        .and(DOCUMENT_PROPERTY_SOURCES.KEY.eq("size")))
                .fetch().stream().filter(row -> row.getSource().data().contains("hand")).findFirst().orElseThrow();
        assertThat(hand.getTier()).isEqualTo(100);
        assertThat(hand.getValue().data()).isEqualTo("\"A3\"");
        assertThat(hand.getSetBy()).isEqualTo("u3");
        assertThat(eventCount("document.property_changed", "D1")).isEqualTo(1);
        JsonNode detail = get("/api/documents/D1", cookie, 200);
        assertThat(detail.toString()).contains("A3");
    }

    @Test
    void bulkEntryCommitsPerDocumentAndReportsTheRefusalForEach() throws Exception {
        String cookie = session("u3");
        JsonNode entered = post("/api/documents/properties/size", cookie,
                Map.of("value", "A4", "documentIds", List.of("D2", "D3")), 200);
        assertThat(entered.path("enteredCount").asInt()).isEqualTo(2);
        assertThat(entered.path("refusals").size()).isZero();
        assertThat(dsl.fetchCount(dsl.selectFrom(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.KEY.eq("size")
                        .and(DOCUMENT_PROPERTY_SOURCES.SET_BY.eq("u3"))))).isEqualTo(2);

        JsonNode refused = post("/api/documents/properties/machines", cookie,
                Map.of("value", List.of("bookeye"), "documentIds", List.of("D20", "D1")), 200);
        assertThat(refused.path("enteredCount").asInt()).isZero();
        assertThat(refused.path("refusals").get(0).path("message").asString())
                .isEqualTo("There is no attempt to set it on yet");
        assertThat(refused.path("refusals").get(1).path("message").asString())
                .isEqualTo("This attempt is scanned; what it was scanned with stays");
        assertThat(dsl.fetchCount(dsl.selectFrom(EVENTS).where(EVENTS.CODE.eq("iteration.property_changed"))))
                .isZero();
    }

    @Test
    void handValueCanBeClearedAndAttemptValuesStayOnTheirIteration() throws Exception {
        String cookie = session("u3");
        put("/api/documents/D1/properties/size", cookie, Map.of("value", "A3"), 200);
        JsonNode cleared = put("/api/documents/D1/properties/size", cookie,
                json.readTree("{\"value\":null}"), 200);
        assertThat(cleared.path("isRechecked").asBoolean()).isFalse();
        assertThat(dsl.fetchCount(dsl.selectFrom(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq("D1")
                        .and(DOCUMENT_PROPERTY_SOURCES.KEY.eq("size"))
                        .and(DOCUMENT_PROPERTY_SOURCES.SET_BY.eq("u3"))))).isZero();

        put("/api/documents/D2/properties/machines", cookie,
                Map.of("value", List.of("zeutschel")), 200);
        assertThat(dsl.fetchCount(dsl.selectFrom(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.KEY.eq("machines")
                        .and(ITERATION_PROPERTY_SOURCES.SET_BY.eq("u3"))))).isEqualTo(1);
    }

    @Test
    void refusesInMockOrderAndDoesNotWrite() throws Exception {
        String cookie = session("u3");
        int eventsBefore = dsl.fetchCount(dsl.selectFrom(EVENTS));
        assertProblem(put("/api/documents/D1/properties/title", cookie,
                Map.of("value", "A hand title"), 403), "forbidden");
        assertProblem(put("/api/documents/D1/properties/size", cookie,
                Map.of("value", "not-a-size"), 422), "property.value_not_allowed");
        assertProblem(put("/api/documents/D20/properties/machines", cookie,
                Map.of("value", List.of("bookeye")), 409), "property.no_attempt");
        assertProblem(put("/api/documents/D1/properties/machines", cookie,
                Map.of("value", List.of("bookeye")), 409), "iteration.scanned");
        assertThat(dsl.fetchCount(dsl.selectFrom(EVENTS))).isEqualTo(eventsBefore);
        assertProblem(put("/api/documents/D1/properties/missing", cookie,
                Map.of("value", "x"), 404), "not_found");
    }

    @Test
    void titlePermissionReachesTheHandEntryRuleAsInPropertyApprovalRecording() throws Exception {
        String cookie = session("u3");
        Map<String, Object> role = new java.util.LinkedHashMap<>();
        role.put("name", "Catalog title editor");
        role.put("description", "May edit catalog-sourced properties.");
        role.put("grants", List.of(Map.of("permission", "access.read", "scope", "any"),
                        Map.of("permission", "access.manage", "scope", "any"),
                        Map.of("permission", "iteration.read", "scope", "any"),
                        Map.of("permission", "property.title.edit", "scope", "any")));
        role.put("proposalBatchLimit", null);
        role.put("proposalDailyLimit", null);
        post("/api/access/roles", cookie, role, 200);
        put("/api/access/users/u3/roles", cookie, Map.of("roleIds", List.of("admin", "catalog-title-editor")), 200);
        assertProblem(put("/api/documents/D1/properties/title", cookie,
                Map.of("value", "Attempted hand edit"), 422), "property.not_by_hand");
        JsonNode pending = post("/api/requests/D21/approve", cookie,
                approvalBody(), 409);
        assertProblem(pending, "proposal.checks_pending");
        JsonNode rescan = post("/api/requests/D22/approve", cookie,
                approvalBody(), 422);
        assertProblem(rescan, "proposal.rescan_reason_missing");
        JsonNode batch = post("/api/requests/batches/B-0143/approve", cookie,
                Map.of("categoryId", "c21", "priority", "Normal",
                        "excludedIds", List.of("D25", "D26", "D27", "D28", "D20")), 409);
        assertProblem(batch, "batch.nothing_to_approve");
    }

    @Test
    void rerunsChecksWhenAValidationRuleReadsTheEnteredProperty() throws Exception {
        reset.reset("property-entry-validation", true);
        JsonNode result = put("/api/documents/D1/properties/size", session("u3"),
                Map.of("value", "A3"), 200);
        assertThat(result.path("isRechecked").asBoolean()).isTrue();
        assertThat(eventCount("iteration.property_changed", "IT1")).isEqualTo(1);
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq("IT1"))
                .fetchOne(0, String.class)).isEqualTo("Published");
    }

    @Test
    void bothEntryRoutesRequireASession() {
        client.put().uri("/api/documents/D1/properties/size").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("value", "A3")).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/documents/properties/size").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("value", "A3", "documentIds", List.of("D1")))
                .exchange().expectStatus().isUnauthorized();
    }

    private JsonNode get(String path, String cookie, int status) throws Exception {
        return json.readTree(client.get().uri(URI.create(path)).header("Cookie", cookie).exchange()
                .expectStatus().isEqualTo(status).expectBody(String.class).returnResult().getResponseBody());
    }

    private JsonNode put(String path, String cookie, Object body, int status) throws Exception {
        return json.readTree(client.put().uri(URI.create(path)).header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isEqualTo(status)
                .expectBody(String.class).returnResult().getResponseBody());
    }

    private JsonNode post(String path, String cookie, Object body, int status) throws Exception {
        return json.readTree(client.post().uri(URI.create(path)).header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isEqualTo(status)
                .expectBody(String.class).returnResult().getResponseBody());
    }

    private void assertProblem(JsonNode problem, String code) {
        assertThat(problem.path("code").asString()).isEqualTo(code);
    }

    private Map<String, Object> approvalBody() {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("categoryId", "c21");
        body.put("priority", "Normal");
        body.put("rescanNote", null);
        return body;
    }

    private int eventCount(String code, String subjectId) {
        return dsl.fetchCount(dsl.selectFrom(EVENTS).where(EVENTS.CODE.eq(code)
                .and(EVENTS.SUBJECT_ID.eq(subjectId))));
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }
}

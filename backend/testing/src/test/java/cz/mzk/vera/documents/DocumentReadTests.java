package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.jooq.DSLContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import cz.mzk.vera.testing.seeds.TemplateResetService;

// VIEW-documents-audience; ENT-batch.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class DocumentReadTests {
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
    void detailReturnsTheSeededDocumentRecordAndHistoryToAdmin() {
        String cookie = session("u3");
        client.get().uri("/api/documents/D1").header("Cookie", cookie).exchange().expectStatus().isOk()
            .expectBody().jsonPath("$.audience").isEqualTo("staff")
            .jsonPath("$.record.document.id").isEqualTo("D1")
            .jsonPath("$.record.iterations.length()").isNotEmpty()
            .jsonPath("$.record.iterations[0].defects[0].publicText")
            .isEqualTo("Publication year is unclear on the record.")
            .jsonPath("$.record.iterations[0].defects[0].internalText")
            .isEqualTo("MARC 260$c reads \"19uu\"; publication year cannot be resolved.")
            .jsonPath("$.record.document.properties[0].key").isEqualTo("title")
            .jsonPath("$.record.document.properties[1].key").isEqualTo("material_type")
            .jsonPath("$.record.document.properties[2].key").isEqualTo("shelf_mark")
            .jsonPath("$.record.document.properties[3].key").isEqualTo("size")
            .jsonPath("$.record.requests.length()").isNotEmpty()
            .jsonPath("$.log.length()").isNotEmpty();
    }

    @Test
    void detailIncludesRestrictionAndDefectsForD14() {
        client.get().uri("/api/documents/D14").header("Cookie", session("u3")).exchange()
            .expectStatus().isOk().expectBody()
            .jsonPath("$.record.iterations[0].restriction.rule").isEqualTo("Copyright")
            .jsonPath("$.record.iterations[0].defects[0].key").isEqualTo("pi10:R01:041$a");
    }

    @Test
    void detailAndBatchesRequireASession() {
        client.get().uri("/api/documents/D1").exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/batches").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void myDocumentsRedactsToTheRequestersRecordAndHistory() {
        String cookie = session("u5");
        client.get().uri("/api/documents/D1?perspective=my").header("Cookie", cookie).exchange()
            .expectStatus().isOk().expectBody().jsonPath("$.audience").isEqualTo("public")
            .jsonPath("$.record.requests.length()").isEqualTo(1)
            .jsonPath("$.record.requests[0].id").isEqualTo("R1")
            .jsonPath("$.record.iterations.length()").isEqualTo(1)
            .jsonPath("$.record.iterations[0].id").isEqualTo("IT1")
            .jsonPath("$.record.iterations[0].properties.length()").isEqualTo(0)
            .jsonPath("$.log[0].data").isEmpty()
            .jsonPath("$.record.document.properties.length()").isEqualTo(3)
            .jsonPath("$.record.document.properties[0].sources[0].setBy").isEmpty()
            .jsonPath("$.log[?(@.actor.kind == 'undisclosed')].length()").isNotEmpty();
    }

    @Test
    void myDocumentsRequiresRequestReadMine() {
        client.get().uri("/api/documents/D1?perspective=my").header("Cookie", session("u10"))
            .exchange().expectStatus().isForbidden().expectBody().jsonPath("$.detail")
            .isEqualTo("You may not open My Documents");
    }

    @Test
    void publicDeclineWithholdsItsInternalText() {
        grant("u6", "read-own-asks", "request.read_mine", null);
        client.get().uri("/api/documents/D23?perspective=my").header("Cookie", session("u6"))
            .exchange().expectStatus().isOk().expectBody()
            .jsonPath("$.record.requests[0].id").isEqualTo("R21")
            .jsonPath("$.record.requests[0].decline.internalText").isEmpty();
    }

    @Test
    void missingAndIterationlessDocumentsAreOutOfStaffReach() {
        String cookie = session("u3");
        client.get().uri("/api/documents/missing").header("Cookie", cookie).exchange()
            .expectStatus().isNotFound();
        client.get().uri("/api/documents/D20").header("Cookie", cookie).exchange()
            .expectStatus().isNotFound();
    }

    @Test
    void custodyReachIncludesDescendantsButNotOutsideCategories() {
        grant("reach-custody", "iteration.read", "custody");
        dsl.insertInto(CATEGORY_MEMBERS).set(CATEGORY_MEMBERS.CATEGORY_ID, "c2")
            .set(CATEGORY_MEMBERS.USER_ID, "u10").set(CATEGORY_MEMBERS.POSITION, 100).execute();
        String cookie = session("u10");
        client.get().uri("/api/documents/D1").header("Cookie", cookie).exchange()
            .expectStatus().isOk().expectBody().jsonPath("$.record.document.id").isEqualTo("D1");
        client.get().uri("/api/documents/D4").header("Cookie", cookie).exchange()
            .expectStatus().isNotFound();
    }

    @Test
    void custodyReachAlsoIncludesAnOutsideDocumentAskedForByTheCaller() {
        grant("u5", "reach-custody-own-ask", "iteration.read", "custody");
        dsl.insertInto(CATEGORY_MEMBERS).set(CATEGORY_MEMBERS.CATEGORY_ID, "c2")
            .set(CATEGORY_MEMBERS.USER_ID, "u5").set(CATEGORY_MEMBERS.POSITION, 100).execute();
        client.get().uri("/api/documents/D4").header("Cookie", session("u5"))
            .exchange().expectStatus().isOk().expectBody().jsonPath("$.record.requests[0].id").isEqualTo("R4");
    }

    @Test
    void projectReachIncludesDocumentsWithProjectRequests() {
        grant("reach-project", "iteration.read", "project");
        dsl.insertInto(PROJECT_MEMBERS).set(PROJECT_MEMBERS.PROJECT_ID, "p1")
            .set(PROJECT_MEMBERS.USER_ID, "u10").set(PROJECT_MEMBERS.POSITION, 100).execute();
        client.get().uri("/api/documents/D1").header("Cookie", session("u10"))
            .exchange().expectStatus().isOk().expectBody().jsonPath("$.audience").isEqualTo("staff");
    }

    @Test
    void projectMyDocumentsIncludesAnotherPersonsProjectRequest() {
        grant("mine-project", "request.read_mine", "project");
        dsl.insertInto(PROJECT_MEMBERS).set(PROJECT_MEMBERS.PROJECT_ID, "p1")
            .set(PROJECT_MEMBERS.USER_ID, "u10").set(PROJECT_MEMBERS.POSITION, 100).execute();
        client.get().uri("/api/documents/D20?perspective=my").header("Cookie", session("u10"))
            .exchange().expectStatus().isOk().expectBody()
            .jsonPath("$.record.requests[?(@.id == 'R32')].requesterId").isEqualTo("u4");
    }

    @Test
    void ingestFailureErrorNeedsRequestReadIngestInTheRecordAndHistory() {
        grant("read-iterations", "iteration.read", "any");
        String hidden = client.get().uri("/api/documents/D7").header("Cookie", session("u10"))
            .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        assertThat(mapper.readTree(hidden).at("/record/iterations/0/ingestFailure/error").isNull()).isTrue();
        assertIngestError(mapper.readTree(hidden).path("log"), null);

        grant("read-ingest", "request.read_ingest", "any");
        String visible = client.get().uri("/api/documents/D7").header("Cookie", session("u10"))
            .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        assertThat(mapper.readTree(visible).at("/record/iterations/0/ingestFailure/error").asString())
            .isEqualTo("Catalog adapter returned HTTP 502 after 3 attempts.");
        assertIngestError(mapper.readTree(visible).path("log"),
            "Catalog adapter returned HTTP 502 after 3 attempts.");
    }

    @Test
    void historyIsNewestFirstAndBreaksTiesByInsertionPositionOncePerCause() {
        var first = dsl.selectFrom(EVENTS).where(EVENTS.ID.eq("E38")).fetchOne();
        var at = first.getAt();
        dsl.update(EVENTS).set(EVENTS.AT, at).where(EVENTS.ID.eq("E48")).execute();
        dsl.insertInto(EVENTS).set(EVENTS.ID, "E38-copy").set(EVENTS.CODE, first.getCode())
            .set(EVENTS.SUBJECT_KIND, first.getSubjectKind()).set(EVENTS.SUBJECT_ID, first.getSubjectId())
            .set(EVENTS.AT, first.getAt()).set(EVENTS.ACTOR, first.getActor())
            .set(EVENTS.CORRELATION_ID, first.getCorrelationId()).set(EVENTS.DATA, first.getData())
            .set(EVENTS.REASON_PUBLIC, first.getReasonPublic()).set(EVENTS.REASON_INTERNAL, first.getReasonInternal())
            .execute();

        var body = client.get().uri("/api/documents/D1").header("Cookie", session("u3"))
            .exchange().expectStatus().isOk().expectBody();
        body.jsonPath("$.log[0].id").isEqualTo("E89");
        body.jsonPath("$.log[1].id").isEqualTo("E38");
        body.jsonPath("$.log[2].id").isEqualTo("E48");
    }

    @Test
    void batchesAreInSeedOrderWithRequestCounts() {
        String cookie = session("u3");
        String body = client.get().uri("/api/batches").header("Cookie", cookie).exchange()
            .expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        var rows = mapper.readTree(body);
        var batches = dsl.selectFrom(BATCHES).orderBy(BATCHES.POSITION).fetch();
        assertThat(rows.size()).isEqualTo(batches.size());
        for (int index = 0; index < batches.size(); index++) {
            var batch = batches.get(index);
            var answer = rows.get(index);
            assertThat(answer.path("id").asString()).isEqualTo(batch.getId());
            assertThat(answer.path("size").asInt()).isEqualTo(dsl.selectCount().from(REQUESTS)
                .where(REQUESTS.BATCH_ID.eq(batch.getId())).fetchOne(0, int.class));
            assertThat(answer.path("source").isNull()).isTrue();
        }
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
            .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void grant(String roleId, String permission, String scope) {
        grant("u10", roleId, permission, scope);
    }

    private void grant(String userId, String roleId, String permission, String scope) {
        dsl.insertInto(ROLES).set(ROLES.ID, roleId).set(ROLES.NAME, roleId)
            .set(ROLES.DESCRIPTION, "test role").set(ROLES.IS_SHIPPED, false).set(ROLES.POSITION, 100)
            .execute();
        dsl.insertInto(ROLE_GRANTS).set(ROLE_GRANTS.ROLE_ID, roleId).set(ROLE_GRANTS.POSITION, 0)
            .set(ROLE_GRANTS.PERMISSION, permission).set(ROLE_GRANTS.SCOPE, scope).execute();
        int position = dsl.selectCount().from(USER_HAND_ROLES).where(USER_HAND_ROLES.USER_ID.eq(userId))
            .fetchOne(0, int.class);
        dsl.insertInto(USER_HAND_ROLES).set(USER_HAND_ROLES.USER_ID, userId)
            .set(USER_HAND_ROLES.ROLE_ID, roleId).set(USER_HAND_ROLES.POSITION, position).execute();
    }

    private void assertIngestError(JsonNode log, String expected) {
        boolean matched = false;
        for (JsonNode entry : log) {
            if (entry.path("code").asString().equals("iteration.ingest_failed")) {
                JsonNode error = entry.path("data").path("error");
                matched = expected == null ? error.isNull() : error.asString().equals(expected);
            }
        }
        assertThat(matched).isTrue();
    }
}

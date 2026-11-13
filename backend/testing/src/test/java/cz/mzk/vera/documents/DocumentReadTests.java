package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// VIEW-documents-audience; ENT-batch.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
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
    void catalogStateAppearsOnDocumentsRowsAndInTheDrawer() throws Exception {
        String cookie = session("u3");
        JsonNode page = mapper.readTree(client.get().uri("/api/documents?limit=100").header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        JsonNode d1 = null;
        for (JsonNode item : page.path("items")) {
            if ("D1".equals(item.path("document").path("id").asString())) {
                d1 = item.path("document").path("catalogState");
            }
        }
        assertThat(d1).isNotNull();
        assertThat(d1.path("kind").asString()).isEqualTo("replaced");
        assertThat(d1.path("catalogId").asString()).isEqualTo("MZK01-001502234");
        JsonNode drawerD1 = mapper.readTree(client.get().uri("/api/documents/D1").header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        JsonNode drawerD35 = mapper.readTree(client.get().uri("/api/documents/D35").header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        assertThat(drawerD1.path("record").path("document").path("catalogState").path("kind").asString())
                .isEqualTo("replaced");
        assertThat(drawerD35.path("record").path("document").path("catalogState").path("kind").asString())
                .isEqualTo("gone");
    }

    @Test
    void relinkActWritesTheCatalogIdEventAndRechecksTheCurrentIteration() throws Exception {
        String cookie = session("u3");
        client.post().uri("/api/documents/D1/relink").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("catalogId", "MZK01-001777777"))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.progress").isNotEmpty();
        assertThat(dsl.select(DOCUMENTS.CATALOG_ID).from(DOCUMENTS).where(DOCUMENTS.ID.eq("D1"))
                .fetchOne(DOCUMENTS.CATALOG_ID)).isEqualTo("MZK01-001777777");
        assertThat(dsl.select(DOCUMENTS.CATALOG_STATE).from(DOCUMENTS).where(DOCUMENTS.ID.eq("D1"))
                .fetchOne(DOCUMENTS.CATALOG_STATE)).isNull();
        assertThat(dsl.selectCount().from(EVENTS).where(EVENTS.SUBJECT_KIND.eq("document"))
                .and(EVENTS.SUBJECT_ID.eq("D1")).and(EVENTS.CODE.eq("document.relinked"))
                .fetchOne(0, int.class)).isEqualTo(1);
        assertThat(dsl.selectCount().from(EVENTS).where(EVENTS.SUBJECT_KIND.eq("iteration"))
                .and(EVENTS.SUBJECT_ID.eq("IT1")).and(EVENTS.CODE.eq("iteration.rechecked"))
                .fetchOne(0, int.class)).isGreaterThan(0);
    }

    @Test
    void relinkingTheGoneDocumentKeepsTheCatalogValidityDefect() {
        client.post().uri("/api/documents/D35/relink").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("catalogId", "MZK01-001502234"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.clearedKeys.length()").isEqualTo(0)
                .jsonPath("$.progress").isEqualTo("Enqueued")
                .jsonPath("$.review").isEqualTo("Needed");
    }

    @Test
    void relinkRefusesARecordTheCatalogDoesNotRead() {
        client.post().uri("/api/documents/D1/relink").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("catalogId", "MZK01-000000000"))
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.type").isEqualTo("https://vera.mzk.cz/problems/document.catalog_unread")
                .jsonPath("$.detail").isEqualTo("The catalog does not read this record");
    }

    @Test
    void relinkRefusesTheDocumentsOwnCatalogRecord() {
        client.post().uri("/api/documents/D1/relink").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("catalogId", "MZK01-001284756"))
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.type").isEqualTo("https://vera.mzk.cz/problems/document.same_catalog_record")
                .jsonPath("$.detail").isEqualTo("Choose a different catalog record");
    }

    @Test
    void relinkRefusesARecordAnotherDocumentAlreadyHolds() {
        dsl.update(DOCUMENTS).set(DOCUMENTS.CATALOG_ID, "MZK01-001777777")
                .set(DOCUMENTS.UNIT_VALUE, "1918–1925").where(DOCUMENTS.ID.eq("D2")).execute();
        client.post().uri("/api/documents/D1/relink").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("catalogId", "MZK01-001777777"))
                .exchange().expectStatus().isEqualTo(409).expectBody()
                .jsonPath("$.type").isEqualTo("https://vera.mzk.cz/problems/document.catalog_record_held")
                .jsonPath("$.detail").isEqualTo("Another document already holds this catalog record");
    }

    @Test
    void relinkNeedsIterationRecheckPermission() {
        grant("l78d-no-recheck", "iteration.read", "any");
        client.post().uri("/api/documents/D1/relink").header("Cookie", session("u10"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("catalogId", "MZK01-001777777"))
                .exchange().expectStatus().isForbidden().expectBody()
                .jsonPath("$.detail").isEqualTo("This is outside what you may change");
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
        client.get().uri("/api/documents").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void documentListAnswersThePageShapeAndUnknownCursorIsEmpty() {
        client.get().uri("/api/documents?limit=2").header("Cookie", session("u3")).exchange()
            .expectStatus().isOk().expectBody().jsonPath("$.audience").isEqualTo("staff")
            .jsonPath("$.total").isNotEmpty().jsonPath("$.items.length()")
            .isEqualTo(2).jsonPath("$.facets.statuses").isArray()
            .jsonPath("$.propertyFacets").isMap();
        client.get().uri("/api/documents?cursor=unknown").header("Cookie", session("u3")).exchange()
            .expectStatus().isOk().expectBody().jsonPath("$.items.length()").isEqualTo(0)
            .jsonPath("$.nextCursor").isEmpty();
    }

    @Test
    void documentListFiltersAndFacetsMatchTheRecordings() throws Exception {
        JsonNode recordings = mapper.readTree(Path.of("../../replay/recordings/base-records-filters.json")
            .toFile());
        for (JsonNode scenario : recordings.path("scenarios")) {
            String name = scenario.path("name").asString();
            if (!name.equals("documents-admin") && !name.equals("documents-reader")) {
                continue;
            }
            Map<String, String> cookies = new LinkedHashMap<>();
            for (JsonNode call : scenario.path("calls")) {
                String path = call.path("path").asString();
                if (!"GET".equals(call.path("method").asString())
                        || !path.startsWith("/api/documents")) {
                    continue;
                }
                String userId = call.path("as").asString();
                String cookie = cookies.computeIfAbsent(userId, this::session);
                JsonNode expected = call.path("body");
                var response = client.get().uri(URI.create(path)).header("Cookie", cookie)
                    .exchange().expectBody(String.class).returnResult();
                assertThat(response.getStatus()).as(path).isEqualTo(HttpStatus.OK);
                JsonNode actual = mapper.readTree(response.getResponseBody());
                assertThat(actual.path("audience")).isEqualTo(expected.path("audience"));
                assertThat(ids(actual.path("items"))).as(path)
                    .isEqualTo(ids(expected.path("items")));
                assertThat(actual.path("total")).isEqualTo(expected.path("total"));
                assertThat(actual.path("nextCursor")).isEqualTo(expected.path("nextCursor"));
                assertThat(actual.path("facets")).isEqualTo(expected.path("facets"));
                assertThat(actual.path("propertyFacets")).isEqualTo(expected.path("propertyFacets"));
                if (path.contains("group=")) {
                    assertThat(canonical(actual.path("groups"))).as(path)
                        .isEqualTo(canonical(expected.path("groups")));
                }
            }
        }
        JsonNode byRequest = mapper.readTree(client.get().uri("/api/documents?q=R1")
            .header("Cookie", session("u3")).exchange().expectStatus().isOk().expectBody(String.class)
            .returnResult().getResponseBody());
        assertThat(ids(byRequest.path("items"))).contains("D1");
    }

    @Test
    void groupingIsUnavailableToPublicAndNeedsReadIngestForStaff() throws Exception {
        JsonNode publicPage = mapper.readTree(client.get()
            .uri("/api/documents?perspective=my&group=batch").header("Cookie", session("u3"))
            .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        assertThat(publicPage.path("groups")).isEmpty();
        JsonNode staffPage = mapper.readTree(client.get().uri("/api/documents?group=batch")
            .header("Cookie", session("u10")).exchange().expectStatus().isOk()
            .expectBody(String.class).returnResult().getResponseBody());
        assertThat(staffPage.path("groups")).isEmpty();
    }

    @Test
    void batchGroupTotalsSpanSlicesWhileRowCountsFollowEachSlice() throws Exception {
        String cookie = session("u3");
        JsonNode first = mapper.readTree(client.get().uri("/api/documents?group=batch&limit=2")
            .header("Cookie", cookie).exchange().expectStatus().isOk().expectBody(String.class)
            .returnResult().getResponseBody());
        assertThat(first.path("groups").path(0).path("kind").asString()).isEqualTo("batch");
        assertThat(first.path("groups").path(0).path("total").asInt()).isEqualTo(3);
        assertThat(first.path("groups").path(0).path("rowCount").asInt()).isEqualTo(2);
        String cursor = first.path("nextCursor").asString();
        JsonNode second = mapper.readTree(client.get().uri("/api/documents?group=batch&limit=2&cursor=" + cursor)
            .header("Cookie", cookie).exchange().expectStatus().isOk().expectBody(String.class)
            .returnResult().getResponseBody());
        assertThat(second.path("groups").path(0).path("total").asInt()).isEqualTo(3);
        assertThat(second.path("groups").path(0).path("rowCount").asInt()).isEqualTo(1);
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
        client.get().uri("/api/documents?perspective=my").header("Cookie", session("u10"))
            .exchange().expectStatus().isForbidden();
    }

    @Test
    void custodyScopedListAndFacetsStayWithinTheCallersReach() throws Exception {
        grant("reach-custody", "iteration.read", "custody");
        dsl.insertInto(CATEGORY_MEMBERS).set(CATEGORY_MEMBERS.CATEGORY_ID, "c2")
            .set(CATEGORY_MEMBERS.USER_ID, "u10").set(CATEGORY_MEMBERS.POSITION, 100).execute();
        JsonNode page = mapper.readTree(client.get().uri("/api/documents?limit=200")
            .header("Cookie", session("u10")).exchange().expectStatus().isOk().expectBody(String.class)
            .returnResult().getResponseBody());
        List<String> ids = ids(page.path("items"));
        assertThat(ids).contains("D1").doesNotContain("D4");
        assertThat(page.path("facets").path("categoryIds").toString()).doesNotContain("c4");
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
            .exchange().expectStatus().isOk().expectBody().jsonPath("$.record.requests[0].id")
            .isEqualTo("R4");
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
            .set(EVENTS.REASON_PUBLIC, first.getReasonPublic())
            .set(EVENTS.REASON_INTERNAL, first.getReasonInternal())
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

    private List<String> ids(JsonNode items) {
        List<String> ids = new ArrayList<>();
        for (JsonNode item : items) {
            ids.add(item.path("document").path("id").asString());
        }
        return List.copyOf(ids);
    }

    private JsonNode canonical(JsonNode value) throws Exception {
        return mapper.readTree(value.toString().replace(".000Z", "Z"));
    }

    private void grant(String roleId, String permission, String scope) {
        grant("u10", roleId, permission, scope);
    }

    private void grant(String userId, String roleId, String permission, String scope) {
        dsl.insertInto(ROLES).set(ROLES.ID, roleId).set(ROLES.NAME, roleId)
            .set(ROLES.NAMES, JSONB.valueOf("{\"en\":\"" + roleId + "\"}"))
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

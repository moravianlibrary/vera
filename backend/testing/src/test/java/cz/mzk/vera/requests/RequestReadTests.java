package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_SUGGESTIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

// VIEW-requests; ACCESS-membership-not-capability; DOC-property-visibility; LOG-history.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class RequestReadTests {
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
    @Autowired
    private RequestSuggestions suggestions;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void detailMatchesTheRecordedAdminRowAndIncludesOnlyAskAndIterationHistory() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-records.json").toFile());
        JsonNode expected = null;
        for (JsonNode scenario : recording.path("scenarios")) {
            if (!"u3".equals(scenario.path("name").asString())) {
                continue;
            }
            for (JsonNode call : scenario.path("calls")) {
                if ("/api/requests".equals(call.path("path").asString())) {
                    for (JsonNode item : call.path("body").path("items")) {
                        if ("D20".equals(item.path("record").path("document").path("id").asString())) {
                            expected = item;
                        }
                    }
                }
            }
        }
        assertThat(expected).isNotNull();
        JsonNode detail = get("/api/requests/D20", session("u3"));
        assertThat(canonical(detail.path("row"))).isEqualTo(canonical(expected));
        assertThat(detail.path("canDecide").asBoolean()).isTrue();
        assertThat(detail.path("row").path("record").path("requests").size()).isEqualTo(4);
        Set<String> causes = new HashSet<>();
        String previousAt = null;
        for (JsonNode event : detail.path("log")) {
            assertThat(event.path("subjectId").asString()).isNotEqualTo("D20");
            String at = event.path("at").asString();
            if (previousAt != null) {
                assertThat(at.compareTo(previousAt)).isLessThanOrEqualTo(0);
            }
            previousAt = at;
            assertThat(causes.add(event.path("correlationId").asString() + "|"
                    + event.path("code").asString())).isTrue();
        }
    }

    @Test
    void choosesPendingThenDeniedThenWithdrawnAndOnlyOpenAsks() throws Exception {
        JsonNode denied = get("/api/requests/D23", session("u3"));
        assertThat(denied.path("row").path("decision").asString()).isEqualTo("Denied");
        assertThat(denied.path("canDecide").asBoolean()).isFalse();
        JsonNode withdrawn = get("/api/requests/D24", session("u3"));
        assertThat(withdrawn.path("row").path("decision").asString()).isEqualTo("Withdrawn");
        dsl.update(REQUESTS).set(REQUESTS.DOCUMENT_ID, "D23")
                .where(REQUESTS.ID.eq("R22")).execute();
        JsonNode closed = get("/api/requests/D23", session("u3"));
        assertThat(closed.path("row").path("decision").asString()).isEqualTo("Denied");
        assertThat(closed.path("row").path("record").path("requests").size()).isEqualTo(1);
        assertThat(closed.path("row").path("record").path("requests").get(0).path("id").asString())
                .isEqualTo("R21");
        getStatus("/api/requests/D24", session("u3"), 404);
        dsl.update(REQUESTS).set(REQUESTS.DOCUMENT_ID, "D30")
                .where(REQUESTS.ID.eq("R33")).execute();
        JsonNode open = get("/api/requests/D30", session("u3"));
        assertThat(open.path("row").path("decision").asString()).isEqualTo("Pending");
        assertThat(open.path("row").path("record").path("requests").size()).isEqualTo(1);
        assertThat(open.path("row").path("record").path("requests").get(0).path("id").asString())
                .isEqualTo("R34");
        getStatus("/api/requests/D1", session("u3"), 404);
        getStatus("/api/requests/no-such-document", session("u3"), 404);
    }

    @Test
    void returnsPlacedCustodiesOrTheFallbackAndListsFallbackFirst() throws Exception {
        JsonNode placed = get("/api/requests/D20", session("u3"));
        assertThat(placed.path("row").path("custodyIds").toString()).isEqualTo("[\"pc1\",\"pc2\"]");
        JsonNode fallback = get("/api/requests/D23", session("u3"));
        assertThat(fallback.path("row").path("custodyIds").toString()).isEqualTo("[\"pc0\"]");
        JsonNode custodies = get("/api/request-custodies", session("u3"));
        assertThat(custodies.get(0).path("isFallback").asBoolean()).isTrue();
        assertThat(custodies.get(0).path("id").asString()).isEqualTo("pc0");
        assertThat(custodies.size()).isEqualTo(4);
        assertThat(List.of(custodies.get(0).path("id").asString(), custodies.get(1).path("id").asString(),
                custodies.get(2).path("id").asString(), custodies.get(3).path("id").asString()))
                .containsExactly("pc0", "pc1", "pc2", "pc3");
    }

    @Test
    void custodyReachUsesDirectAndGroupMembershipAndHidesRowsOutsideReach() {
        grant("request-custody-reader", "request.read", "custody");
        dsl.insertInto(REQUEST_CUSTODY_MEMBERS).set(REQUEST_CUSTODY_MEMBERS.CUSTODY_ID, "pc1")
                .set(REQUEST_CUSTODY_MEMBERS.USER_ID, "u10").set(REQUEST_CUSTODY_MEMBERS.POSITION, 30).execute();
        get("/api/requests/D20", session("u10"));
        getStatus("/api/requests/D23", session("u10"), 404);

        reset.reset("base", true);
        grant("request-group-reader", "request.read", "custody");
        int groupPosition = dsl.selectCount().from(GROUP_MEMBERS)
                .where(GROUP_MEMBERS.GROUP_ID.eq("g1")).fetchOne(0, int.class);
        dsl.insertInto(GROUP_MEMBERS).set(GROUP_MEMBERS.GROUP_ID, "g1")
                .set(GROUP_MEMBERS.USER_ID, "u10").set(GROUP_MEMBERS.POSITION, groupPosition).execute();
        get("/api/requests/D20", session("u10"));
    }

    @Test
    void projectReachAndIndependentDecisionReach() {
        grant("request-project-reader", "request.read", "project");
        int projectPosition = dsl.selectCount().from(PROJECT_MEMBERS)
                .where(PROJECT_MEMBERS.PROJECT_ID.eq("p1")).fetchOne(0, int.class);
        dsl.insertInto(PROJECT_MEMBERS).set(PROJECT_MEMBERS.PROJECT_ID, "p1")
                .set(PROJECT_MEMBERS.USER_ID, "u10").set(PROJECT_MEMBERS.POSITION, projectPosition).execute();
        JsonNode detail = get("/api/requests/D20", session("u10"));
        assertThat(detail.path("canDecide").asBoolean()).isFalse();
        dsl.update(ROLE_GRANTS).set(ROLE_GRANTS.SCOPE, "any")
                .where(ROLE_GRANTS.ROLE_ID.eq("request-project-reader")).execute();
        grant("request-decider", "request.decide", "custody");
        assertThat(get("/api/requests/D20", session("u10")).path("canDecide").asBoolean()).isFalse();
    }

    @Test
    void staffPropertiesRequireIterationReadAndPublicProjectionClearsSetBy() {
        grant("request-property-reader", "request.read", "any");
        JsonNode publicProjection = get("/api/requests/D20", session("u10")).path("row").path("record");
        assertThat(hasProperty(publicProjection.path("document").path("properties"), "shelf_mark")).isFalse();
        assertSetByNull(publicProjection.path("document").path("properties"));
        addGrant("request-property-reader", "iteration.read", "any");
        JsonNode staffProjection = get("/api/requests/D20", session("u10")).path("row").path("record");
        assertThat(hasProperty(staffProjection.path("document").path("properties"), "shelf_mark")).isTrue();
        assertSetByPresent(staffProjection.path("document").path("properties"));
    }

    @Test
    void storesSecondClassifierSuggestionWhenTheFirstHasNoAnswer() {
        dsl.update(DOCUMENTS).set(DOCUMENTS.TYPE, "Map").where(DOCUMENTS.ID.eq("D20")).execute();
        suggestions.suggest(dsl, "R16");
        JsonNode checked = get("/api/requests/D20", session("u3"));
        assertThat(checked.path("row").path("suggestion").path("categoryId").asString())
                .isEqualTo("c4");
        assertThat(checked.path("row").path("suggestion").path("classifier").path("id").asString())
                .isEqualTo("pi31");
        assertThat(checked.path("row").path("suggestion").path("classifier").path("name").asString())
                .isEqualTo("Material type");
    }

    @Test
    void leavesUncheckedRequestsWithoutSuggestions() {
        JsonNode unchecked = get("/api/requests/D21", session("u3"));
        assertThat(unchecked.path("row").path("suggestion").isNull()).isTrue();
    }

    @Test
    void doesNotStoreANonLeafClassifierAnswer() {
        dsl.insertInto(CATEGORIES).set(CATEGORIES.ID, "test-child-c21").set(CATEGORIES.NAME, "test child")
                .set(CATEGORIES.PARENT_ID, "c21").set(CATEGORIES.POSITION, 1000).execute();
        dsl.insertInto(CATEGORIES).set(CATEGORIES.ID, "test-child-c22").set(CATEGORIES.NAME, "test child")
                .set(CATEGORIES.PARENT_ID, "c22").set(CATEGORIES.POSITION, 1001).execute();
        suggestions.suggest(dsl, "R16");
        assertThat(dsl.selectCount().from(REQUEST_SUGGESTIONS)
                .where(REQUEST_SUGGESTIONS.REQUEST_ID.eq("R16")).fetchOne(0, int.class)).isZero();
    }

    @Test
    void bothEndpointsEnforceSessionAndReadPermission() {
        getStatus("/api/requests/D20", null, 401);
        getStatus("/api/request-custodies", null, 401);
        getStatus("/api/requests/D20", session("u10"), 403);
        getStatus("/api/request-custodies", session("u10"), 403);
    }

    private JsonNode get(String path, String cookie) {
        return mapper.readTree(client.get().uri(URI.create(path)).header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
    }

    private void getStatus(String path, String cookie, int status) {
        var request = client.get().uri(URI.create(path));
        if (cookie != null) {
            request.header("Cookie", cookie);
        }
        request.exchange().expectStatus().isEqualTo(status);
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void grant(String roleId, String permission, String scope) {
        dsl.insertInto(ROLES).set(ROLES.ID, roleId).set(ROLES.NAME, roleId)
                .set(ROLES.DESCRIPTION, "test role").set(ROLES.IS_SHIPPED, false)
                .set(ROLES.POSITION, 100).execute();
        dsl.insertInto(ROLE_GRANTS).set(ROLE_GRANTS.ROLE_ID, roleId).set(ROLE_GRANTS.POSITION, 0)
                .set(ROLE_GRANTS.PERMISSION, permission).set(ROLE_GRANTS.SCOPE, scope).execute();
        int position = dsl.selectCount().from(USER_HAND_ROLES).where(USER_HAND_ROLES.USER_ID.eq("u10"))
                .fetchOne(0, int.class);
        dsl.insertInto(USER_HAND_ROLES).set(USER_HAND_ROLES.USER_ID, "u10")
                .set(USER_HAND_ROLES.ROLE_ID, roleId).set(USER_HAND_ROLES.POSITION, position).execute();
    }

    private void addGrant(String roleId, String permission, String scope) {
        int position = dsl.selectCount().from(ROLE_GRANTS).where(ROLE_GRANTS.ROLE_ID.eq(roleId))
                .fetchOne(0, int.class);
        dsl.insertInto(ROLE_GRANTS).set(ROLE_GRANTS.ROLE_ID, roleId).set(ROLE_GRANTS.POSITION, position)
                .set(ROLE_GRANTS.PERMISSION, permission).set(ROLE_GRANTS.SCOPE, scope).execute();
    }

    private boolean hasProperty(JsonNode properties, String key) {
        for (JsonNode property : properties) {
            if (key.equals(property.path("key").asString())) {
                return true;
            }
        }
        return false;
    }

    private void assertSetByNull(JsonNode properties) {
        for (JsonNode property : properties) {
            for (JsonNode source : property.path("sources")) {
                assertThat(source.path("setBy").isNull()).isTrue();
            }
        }
    }

    private void assertSetByPresent(JsonNode properties) {
        for (JsonNode property : properties) {
            for (JsonNode source : property.path("sources")) {
                assertThat(source.has("setBy")).isTrue();
            }
        }
    }

    private JsonNode canonical(JsonNode value) {
        return mapper.readTree(value.toString().replace(".000Z", "Z"));
    }
}

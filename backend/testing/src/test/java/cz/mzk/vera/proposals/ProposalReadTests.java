package cz.mzk.vera.proposals;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.time.OffsetDateTime;
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

// ACT-propose; ACT-ways-in; ROLE-library-day.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ProposalReadTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private DSLContext dsl;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void settingsDescribeCatalogsInputsAndIdentifierTypesForU3() {
        client.get().uri("/api/proposals/settings").header("Cookie", session("u3")).exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.maxAtOnce").isEmpty()
                .jsonPath("$.searchCatalogs.length()").isEqualTo(2)
                .jsonPath("$.linkCatalogs.length()").isEqualTo(3)
                .jsonPath("$.canScanWithCamera").isEqualTo(true)
                .jsonPath("$.canReadPhotos").isEqualTo(true)
                .jsonPath("$.identifierTypes.length()").isEqualTo(6);
    }

    @Test
    void rateLimitIsUnlimitedForU3() {
        client.get().uri("/api/proposals/rate-limit").header("Cookie", session("u3")).exchange()
                .expectStatus().isOk().expectBody().json("{\"perDay\":null}");
    }

    @Test
    void effectiveBatchLimitUsesTheLargestHeldRequestRole() {
        clearRoles("u5");
        createProposalRole("limit-small", 2, 2, 50);
        createProposalRole("limit-large", 7, 7, 51);
        assignRole("u5", "limit-small", 0);
        assignRole("u5", "limit-large", 1);
        client.get().uri("/api/proposals/settings").header("Cookie", session("u5"))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.maxAtOnce").isEqualTo(7);
    }

    @Test
    void anyUnlimitedRequestRoleMakesTheBatchLimitUnlimited() {
        clearRoles("u5");
        createProposalRole("limit-small", 2, 2, 50);
        createProposalRole("limit-unlimited", null, null, 51);
        assignRole("u5", "limit-small", 0);
        assignRole("u5", "limit-unlimited", 1);
        client.get().uri("/api/proposals/settings").header("Cookie", session("u5"))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.maxAtOnce").isEmpty();
    }

    @Test
    void rateLimitCountsThePreviousUtcEveningWithinPragueToday() {
        clearRoles("u5");
        createProposalRole("limit-daily", null, 3, 50);
        assignRole("u5", "limit-daily", 0);
        dsl.update(REQUESTS).set(REQUESTS.AT, OffsetDateTime.parse("2026-06-23T23:30:00Z"))
                .where(REQUESTS.REQUESTER_ID.eq("u5")).execute();
        String requestId = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.REQUESTER_ID.eq("u5")).limit(1).fetchOne(REQUESTS.ID);
        dsl.update(REQUESTS).set(REQUESTS.AT, OffsetDateTime.parse("2026-06-24T23:30:00Z"))
                .where(REQUESTS.ID.eq(requestId)).execute();
        client.get().uri("/api/proposals/rate-limit").header("Cookie", session("u5"))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.perDay").isEqualTo(2);
    }

    @Test
    void catalogSearchUsesMirrorOrderAndHonorsEmptyQuery() {
        assertThat(dsl.fetchCount(CATALOG_MIRROR)).isGreaterThan(0);
        assertThat(dsl.select(CATALOG_MIRROR.TITLE).from(CATALOG_MIRROR)
                .fetch(CATALOG_MIRROR.TITLE)).contains("Moravské kostely");
        assertThat(dsl.fetchCount(CATALOG_MIRROR,
                CATALOG_MIRROR.INSTANCE_ID.eq("pi1").and(CATALOG_MIRROR.TITLE.containsIgnoreCase("Moravské"))))
                .isGreaterThan(0);
        client.get().uri(URI.create("/api/proposals/catalog-search?q=Moravsk%C3%A9"))
                .header("Cookie", session("u3")).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].catalogId").isEqualTo("MZK03-000778120")
                .jsonPath("$[0].catalog.id").isEqualTo("pi1");
        client.get().uri("/api/proposals/catalog-search").header("Cookie", session("u3"))
                .exchange().expectStatus().isOk().expectBody().json("[]");
        client.get().uri(URI.create("/api/proposals/catalog-search?q=Brn%C4%9Bnsk%C3%BD&catalog=pi1"))
                .header("Cookie", session("u3")).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].catalog.id").isEqualTo("pi1");
    }

    @Test
    void lookupReportsAPendingCurrentAskAsMineForU6() {
        client.post().uri("/api/proposals/lookup").header("Cookie", session("u6"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("items", List.of(item("catalogId", "MZK01-001622010", "1889"))))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].kind").isEqualTo("mine")
                .jsonPath("$[0].documentId").isEqualTo("D20");
    }

    @Test
    void lookupResolvesSeededCatalogItemsAndUnitsForU3() {
        assertThat(dsl.fetchCount(CATALOG_MIRROR_KEYS,
                CATALOG_MIRROR_KEYS.KIND.eq("identifier")
                        .and(CATALOG_MIRROR_KEYS.NORMALIZED.eq("9788073254568")))).isEqualTo(1);
        Map<String, Object> body = Map.of("items", List.of(
                item("catalogId", "MZK01-001277001", "1939"),
                item("catalogId", "MZK01-001277001", "1936–1938"),
                item("catalogId", "MZK03-000556300", "1902"),
                item("catalogId", "MZK01-001277001", null),
                item("shelfMark", "ST3-0880", null),
                item("catalogId", "not-in-catalog", null),
                item("isbn", "978-80-7325-456-8", null),
                item("barcode", "MZK-2801-000341", null),
                item("shelfMark", "ST2-0950", null)));
        client.post().uri("/api/proposals/lookup").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].kind").isEqualTo("new")
                .jsonPath("$[0].isAskedBefore").isEqualTo(true)
                .jsonPath("$[1].kind").isEqualTo("inVera")
                .jsonPath("$[1].documentId").isEqualTo("D8")
                .jsonPath("$[1].status").isEqualTo("Ready")
                .jsonPath("$[3].kind").isEqualTo("whichUnit")
                .jsonPath("$[4].kind").isEqualTo("whichRecord")
                .jsonPath("$[5].kind").isEqualTo("notInCatalog")
                .jsonPath("$[6].kind").isEqualTo("new")
                .jsonPath("$[6].catalogId").isEqualTo("MZK03-000778120")
                .jsonPath("$[7].unit").isEqualTo("MZK-2801-000341")
                .jsonPath("$[8].unit").isEqualTo("roč. 1");
    }

    @Test
    void publicLookupUsesTheCurrentIterationStatusForU4() {
        client.post().uri("/api/proposals/lookup").header("Cookie", session("u4"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("items", List.of(item("catalogId", "MZK01-001277001", "1936–1938"))))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].kind").isEqualTo("inVera")
                .jsonPath("$[0].status").isEqualTo("WaitingToBeScheduled");
    }

    @Test
    void disabledCameraInputUpdatesProposalSettings() {
        dsl.update(PLUGIN_INSTANCES)
                .set(PLUGIN_INSTANCES.IS_ENABLED, false)
                .where(PLUGIN_INSTANCES.ID.eq("pi12")).execute();
        client.get().uri("/api/proposals/settings").header("Cookie", session("u3"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.canScanWithCamera").isEqualTo(false);
    }

    @Test
    void recordLinkCallsTheEnabledCatalogPlugin() {
        client.post().uri("/api/proposals/record-link").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("catalogInstanceId", "pi1", "link",
                        "https://vufind.mzk.cz/Record/MZK01-001277001"))
                .exchange().expectStatus().isOk().expectBody()
                .json("{\"catalogId\":\"MZK01-001277001\"}");
    }

    @Test
    void unreadableRecordLinkUsesTheCatalogNameInItsMessage() {
        client.post().uri("/api/proposals/record-link").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("catalogInstanceId", "pi1", "link", "unreadable"))
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.detail").isEqualTo("MZK Aleph reads no record in that")
                .jsonPath("$.code").isEqualTo("proposal.link_unread");
    }

    @Test
    void recordLinkWithoutAnEnabledCatalogRefuses() {
        dsl.update(PLUGIN_INSTANCES).set(PLUGIN_INSTANCES.IS_ENABLED, false)
                .where(PLUGIN_INSTANCES.ID.eq("pi1")).execute();
        client.post().uri("/api/proposals/record-link").header("Cookie", session("u3"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("catalogInstanceId", "pi1", "link", "https://example.test/record"))
                .exchange().expectStatus().isNotFound().expectBody()
                .jsonPath("$.detail").isEqualTo("No such catalog to read a link in");
    }

    @Test
    void photoReadWithoutAReaderRefuses() {
        dsl.update(PLUGIN_INSTANCES).set(PLUGIN_INSTANCES.IS_ENABLED, false)
                .where(PLUGIN_INSTANCES.ID.eq("pi13")).execute();
        String multipart = "--proposal-boundary\r\n"
                + "Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\n"
                + "Content-Type: image/jpeg\r\n\r\nimage\r\n--proposal-boundary--\r\n";
        client.post().uri("/api/proposals/photo").header("Cookie", session("u3"))
                .header("Content-Type", "multipart/form-data; boundary=proposal-boundary")
                .body(multipart).exchange()
                .expectStatus().isNotFound().expectBody()
                .jsonPath("$.code").isEqualTo("proposal.no_photo_reader");
    }

    @Test
    void photoReadWithoutAFileRefuses() {
        String multipart = "--proposal-boundary--\r\n";
        client.post().uri("/api/proposals/photo").header("Cookie", session("u3"))
                .header("Content-Type", "multipart/form-data; boundary=proposal-boundary")
                .body(multipart).exchange()
                .expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.detail").isEqualTo("Take a photo to read")
                .jsonPath("$.code").isEqualTo("proposal.photo_missing");
    }

    @Test
    void barcodeReadWithoutAFileRefuses() {
        String multipart = "--proposal-boundary--\r\n";
        client.post().uri("/api/proposals/barcode").header("Cookie", session("u3"))
                .header("Content-Type", "multipart/form-data; boundary=proposal-boundary")
                .body(multipart).exchange()
                .expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.detail").isEqualTo("Photograph a barcode to read")
                .jsonPath("$.code").isEqualTo("proposal.photo_missing");
    }

    @Test
    void allSevenProposalReadAndWayInRoutesRequireASession() {
        client.get().uri("/api/proposals/settings").exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/proposals/rate-limit").exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/proposals/lookup").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("items", List.of(item("catalogId", "MZK01-001277001", null))))
                .exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/proposals/catalog-search?q=test").exchange()
                .expectStatus().isUnauthorized();
        client.post().uri("/api/proposals/record-link").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("catalogInstanceId", "pi1", "link", "x"))
                .exchange().expectStatus().isUnauthorized();
        String multipart = "--proposal-boundary\r\n"
                + "Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\n"
                + "Content-Type: image/jpeg\r\n\r\n\r\n--proposal-boundary--\r\n";
        client.post().uri("/api/proposals/photo").header("Content-Type",
                "multipart/form-data; boundary=proposal-boundary").body(multipart)
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/proposals/barcode").header("Content-Type",
                "multipart/form-data; boundary=proposal-boundary").body(multipart)
                .exchange().expectStatus().isUnauthorized();
    }

    private Map<String, Object> item(String type, String value, String unit) {
        Map<String, Object> item = new java.util.LinkedHashMap<>();
        item.put("type", type);
        item.put("value", value);
        item.put("unit", unit);
        return item;
    }

    private void createProposalRole(String id, Integer batchLimit, Integer dailyLimit, int position) {
        dsl.insertInto(ROLES)
                .set(ROLES.ID, id)
                .set(ROLES.NAME, id)
                .set(ROLES.DESCRIPTION, "Test proposal limits")
                .set(ROLES.IS_SHIPPED, false)
                .set(ROLES.PROPOSAL_BATCH_LIMIT, batchLimit)
                .set(ROLES.PROPOSAL_DAILY_LIMIT, dailyLimit)
                .set(ROLES.POSITION, position)
                .execute();
        dsl.insertInto(ROLE_GRANTS)
                .set(ROLE_GRANTS.ROLE_ID, id)
                .set(ROLE_GRANTS.POSITION, 0)
                .set(ROLE_GRANTS.PERMISSION, ProposalCodes.REQUEST_CREATE)
                .set(ROLE_GRANTS.SCOPE, (String) null)
                .execute();
    }

    private void assignRole(String userId, String roleId, int position) {
        dsl.insertInto(USER_HAND_ROLES)
                .set(USER_HAND_ROLES.USER_ID, userId)
                .set(USER_HAND_ROLES.ROLE_ID, roleId)
                .set(USER_HAND_ROLES.POSITION, position)
                .execute();
    }

    private void clearRoles(String userId) {
        dsl.deleteFrom(USER_HAND_ROLES).where(USER_HAND_ROLES.USER_ID.eq(userId)).execute();
        dsl.deleteFrom(USER_MAPPED_ROLES).where(USER_MAPPED_ROLES.USER_ID.eq(userId)).execute();
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }
}

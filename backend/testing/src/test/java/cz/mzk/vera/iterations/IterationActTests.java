package cz.mzk.vera.iterations;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_LINKS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_STATES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
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

// ACT-reclassify; ACT-publish; ACT-link-replace; ACT-link-primary; ACT-link-remove; ACT-current-attempt.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class IterationActTests {
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
    void cancellingAndResumingAListedIterationLeavesFormerListNameEmptyAndReturnsItToThePool() throws Exception {
        String cookie = session("u8");
        post("/api/iterations/IT21/cancel", cookie,
                Map.of("publicText", "Not needed", "internalText", "Hold for now"), 200);
        var cancelled = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq("IT21")).fetchOne();
        assertThat(cancelled.getListId()).isNull();
        assertThat(cancelled.getFormerListName()).isNull();
        assertThat(cancelled.getProgress()).isEqualTo("Ready");
        post("/api/iterations/IT21/resume", cookie, Map.of(), 200);
        var resumed = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq("IT21")).fetchOne();
        assertThat(resumed.getListId()).isNull();
        assertThat(resumed.getFormerListName()).isNull();
        assertThat(resumed.getProgress()).isEqualTo("Ready");
    }

    @Test
    void reclassifiesTheRecordedIterationAndRecomputesItsStates() throws Exception {
        JsonNode result = post("/api/iterations/IT3/reclassify", session("u8"),
                Map.of("categoryId", "c22", "priority", "High"), 200);
        assertThat(result.path("categoryId").asString()).isEqualTo("c22");
        assertThat(result.path("priority").asString()).isEqualTo("High");
        assertThat(result.path("isHandedOver").asBoolean()).isFalse();
        var iteration = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq("IT3")).fetchOne();
        assertThat(iteration.getCategoryId()).isEqualTo("c22");
        assertThat(iteration.getPriority()).isEqualTo("High");
        var event = dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT3")
                .and(EVENTS.CODE.eq("iteration.reclassified"))).fetchOne();
        assertThat(event).isNotNull();
        JsonNode data = mapper.readTree(event.getData().data());
        assertThat(data.path("category").path("from").path("id").asString()).isEqualTo("c21");
        assertThat(data.path("category").path("to").path("id").asString()).isEqualTo("c22");
        assertThat(data.path("priority").path("from").asString()).isEqualTo("Urgent");
        assertThat(dsl.fetchExists(dsl.selectOne().from(DOCUMENT_STATES)
                .where(DOCUMENT_STATES.CURRENT_ITERATION_ID.eq("IT3")))).isTrue();
        assertThat(dsl.fetchExists(dsl.selectOne().from(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.eq("IT3")))).isTrue();
        assertThat(dsl.fetchExists(dsl.selectOne().from(REQUEST_STATES)
                .where(REQUEST_STATES.DOCUMENT_ID.eq(iteration.getDocumentId())))).isTrue();
        JsonNode page = get("/api/documents?q=IT3&limit=50", session("u8"));
        assertThat(page.path("items").get(0).path("iterations").get(0).path("categoryId").asString())
                .isEqualTo("c22");
    }

    @Test
    void publishingAddsTheRecordedLinkAndMovesTheStoredProgress() throws Exception {
        JsonNode result = post("/api/iterations/IT34/publish", session("u8"),
                Map.of("link", "https://example.org/recording"), 200);
        assertThat(result.path("links").size()).isEqualTo(2);
        assertThat(result.path("links").get(1).path("url").asString())
                .isEqualTo("https://example.org/recording");
        assertThat(result.path("links").get(1).path("isPrimary").asBoolean()).isFalse();
        assertThat(result.path("progress").asString()).isEqualTo("Published");
        var iteration = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq("IT34")).fetchOne();
        assertThat(iteration.getProgress()).isEqualTo("Published");
        assertThat(dsl.selectCount().from(ITERATION_LINKS).where(ITERATION_LINKS.ITERATION_ID.eq("IT34"))
                .fetchOne(0, int.class)).isEqualTo(2);
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT34")
                .and(EVENTS.CODE.eq("iteration.link_added"))))).isTrue();
        assertThat(dsl.fetchExists(dsl.selectOne().from(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.eq("IT34")))).isTrue();
        JsonNode page = get("/api/documents?q=IT34&limit=50", session("u8"));
        assertThat(page.path("items").get(0).path("iterations").get(0).path("progress").asString())
                .isEqualTo("Published");
        assertThat(page.path("items").get(0).path("iterations").get(0).path("links").size()).isEqualTo(2);
    }

    @Test
    void replacesTheRecordedLinkInPlaceAndWritesItsChangeEvent() throws Exception {
        JsonNode result = post("/api/iterations/IT34/links/IT34-L1/replace", session("u8"),
                Map.of("link", "https://example.org/replaced"), 200);
        assertThat(result.path("links").size()).isEqualTo(1);
        assertThat(result.path("links").get(0).path("id").asString()).isEqualTo("IT34-L1");
        assertThat(result.path("links").get(0).path("url").asString())
                .isEqualTo("https://example.org/replaced");
        var event = dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT34")
                .and(EVENTS.CODE.eq("iteration.link_changed"))).fetchOne();
        assertThat(event).isNotNull();
        JsonNode data = mapper.readTree(event.getData().data());
        assertThat(data.path("url").path("from").asString())
                .isEqualTo("https://kramerius.mzk.cz/view/uuid:demo50");
        assertThat(data.path("url").path("to").asString()).isEqualTo("https://example.org/replaced");
        JsonNode page = get("/api/documents?q=IT34&limit=50", session("u8"));
        assertThat(page.path("items").get(0).path("iterations").get(0).path("links")
                .get(0).path("url").asString()).isEqualTo("https://example.org/replaced");
    }

    @Test
    void makesTheRecordedLinkPrimary() throws Exception {
        JsonNode result = post("/api/iterations/IT1/links/IT1-L2/primary", session("u8"), Map.of(), 200);
        assertThat(result.path("links").get(0).path("isPrimary").asBoolean()).isFalse();
        assertThat(result.path("links").get(1).path("isPrimary").asBoolean()).isTrue();
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT1")
                .and(EVENTS.CODE.eq("iteration.link_made_primary"))))).isTrue();
        JsonNode page = get("/api/documents?q=IT1&limit=50", session("u8"));
        assertThat(page.path("items").get(0).path("iterations").get(0).path("links")
                .get(1).path("isPrimary").asBoolean()).isTrue();
    }

    @Test
    void removesTheRecordedPrimaryAndPromotesTheOldestRemainingLink() throws Exception {
        JsonNode result = delete("/api/iterations/IT1/links/IT1-L1", session("u8"), 200);
        assertThat(result.path("links").size()).isEqualTo(1);
        assertThat(result.path("links").get(0).path("id").asString()).isEqualTo("IT1-L2");
        assertThat(result.path("links").get(0).path("isPrimary").asBoolean()).isTrue();
        var event = dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT1")
                .and(EVENTS.CODE.eq("iteration.link_removed"))).fetchOne();
        assertThat(event).isNotNull();
        JsonNode data = mapper.readTree(event.getData().data());
        assertThat(data.path("primary").path("id").asString()).isEqualTo("IT1-L2");
        JsonNode page = get("/api/documents?q=IT1&limit=50", session("u8"));
        assertThat(page.path("items").get(0).path("iterations").get(0).path("links").size()).isEqualTo(1);
    }

    @Test
    void refusesEveryNonCurrentActWithoutWriting() throws Exception {
        String cookie = session("u8");
        int eventCount = dsl.selectCount().from(EVENTS).fetchOne(0, int.class);
        int linkCount = dsl.selectCount().from(ITERATION_LINKS).fetchOne(0, int.class);
        post("/api/iterations/IT0/reclassify", cookie,
                Map.of("categoryId", "c22", "priority", "High"), 409);
        post("/api/iterations/IT0/publish", cookie, Map.of("link", "https://example.org/new"), 409);
        post("/api/iterations/IT0/links/IT0-L2/replace", cookie,
                Map.of("link", "https://example.org/new"), 409);
        post("/api/iterations/IT0/links/IT0-L2/primary", cookie, Map.of(), 409);
        delete("/api/iterations/IT0/links/IT0-L2", cookie, 409);
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(eventCount);
        assertThat(dsl.selectCount().from(ITERATION_LINKS).fetchOne(0, int.class)).isEqualTo(linkCount);
    }

    @Test
    void refusesReclassificationAndPublicationFailuresWithoutWrites() throws Exception {
        String cookie = session("u8");
        int eventCount = dsl.selectCount().from(EVENTS).fetchOne(0, int.class);
        dsl.update(ITERATIONS).set(ITERATIONS.CATEGORY_ID, "c22").set(ITERATIONS.PRIORITY, "High")
                .where(ITERATIONS.ID.eq("IT3")).execute();
        post("/api/iterations/IT1/reclassify", cookie, Map.of("categoryId", "c21", "priority", "Low"), 409);
        post("/api/iterations/IT26/reclassify", cookie, Map.of("categoryId", "c2", "priority", "Low"), 422);
        post("/api/iterations/IT3/reclassify", cookie, Map.of("categoryId", "c22", "priority", "High"), 422);
        post("/api/iterations/IT28/publish", cookie, Map.of("link", "https://example.org/new"), 409);
        post("/api/iterations/IT34/publish", cookie, Map.of("link", "not-a-link"), 422);
        post("/api/iterations/IT34/publish", cookie,
                Map.of("link", "https://kramerius.mzk.cz/view/uuid:demo50"), 422);
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(eventCount);
    }

    @Test
    void refusesInvalidLinkActsAndLeavesTheirRowsAndEventsUnchanged() throws Exception {
        String cookie = session("u8");
        int eventCount = dsl.selectCount().from(EVENTS).fetchOne(0, int.class);
        int linkCount = dsl.selectCount().from(ITERATION_LINKS).fetchOne(0, int.class);
        post("/api/iterations/IT34/links/missing/replace", cookie,
                Map.of("link", "https://example.org/replaced"), 404);
        post("/api/iterations/IT34/links/IT34-L1/replace", cookie, Map.of("link", "not-a-link"), 422);
        post("/api/iterations/IT1/links/IT1-L1/replace", cookie,
                Map.of("link", "https://www.digitalniknihovna.cz/mzk/uuid/it1"), 422);
        post("/api/iterations/IT1/links/missing/primary", cookie, Map.of(), 404);
        post("/api/iterations/IT1/links/IT1-L1/primary", cookie, Map.of(), 409);
        delete("/api/iterations/IT34/links/missing", cookie, 404);
        delete("/api/iterations/IT34/links/IT34-L1", cookie, 409);
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(eventCount);
        assertThat(dsl.selectCount().from(ITERATION_LINKS).fetchOne(0, int.class)).isEqualTo(linkCount);
    }

    @Test
    void rejectsInvalidActBodiesAsTheContractDoes() throws Exception {
        String cookie = session("u8");
        assertThat(post("/api/iterations/IT3/reclassify", cookie, Map.of(), 422)
                .path("code").asString()).isEqualTo("invalid");
        assertThat(post("/api/iterations/IT34/publish", cookie, Map.of(), 422)
                .path("code").asString()).isEqualTo("invalid");
        assertThat(post("/api/iterations/IT34/links/IT34-L1/replace", cookie, Map.of(), 422)
                .path("code").asString()).isEqualTo("invalid");
    }

    @Test
    void allFiveActsRequireASession() {
        client.post().uri("/api/iterations/IT3/reclassify").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("categoryId", "c22", "priority", "High")).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/iterations/IT34/publish").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("link", "https://example.org/new")).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/iterations/IT34/links/IT34-L1/replace").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("link", "https://example.org/new")).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/iterations/IT1/links/IT1-L2/primary").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of()).exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/iterations/IT1/links/IT1-L1").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void publicAudienceCannotActOnAnIteration() throws Exception {
        JsonNode result = post("/api/iterations/IT3/reclassify", session("u5"),
                Map.of("categoryId", "c22", "priority", "High"), 404);
        assertThat(result.path("detail").asString()).isEqualTo("No such iteration");
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

    private JsonNode delete(String path, String cookie, int status) throws Exception {
        String value = client.delete().uri(path).header("Cookie", cookie).exchange().expectStatus()
                .isEqualTo(status).expectBody(String.class).returnResult().getResponseBody();
        return value == null ? mapper.nullNode() : mapper.readTree(value);
    }

    private JsonNode get(String path, String cookie) throws Exception {
        String value = client.get().uri(path).header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody();
        return mapper.readTree(value);
    }
}

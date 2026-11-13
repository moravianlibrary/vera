package cz.mzk.vera.validations;

import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
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

// VIEW-validations; STAT-validation; SCOPE-custody-category.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ValidationReadTests {
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

    @ParameterizedTest(name = "recorded validation reads {0}")
    @MethodSource("recordedReads")
    void recordedValidationReadsMatch(String callsJson) throws Exception {
        JsonNode calls = mapper.readTree(callsJson);
        Map<String, String> cookies = new HashMap<>();
        Map<String, String> ids = new LinkedHashMap<>();
        for (JsonNode call : calls) {
            String path = call.path("path").asString();
            String userId = call.path("as").asString();
            String cookie = cookies.computeIfAbsent(userId, this::session);
            var response = client.get().uri(URI.create(path)).header("Cookie", cookie).exchange();
            var result = response.returnResult(String.class);
            assertThat(result.getStatus().value()).isEqualTo(call.path("status").asInt());
            String body = result.getResponseBody();
            if (body == null || body.isBlank()) {
                continue;
            }
            JsonNode actual = mapper.readTree(body);
            JsonNode masked = mapper.valueToTree(maskValue(actual, ids));
            if (path.startsWith("/api/validations")) {
                if (call.has("body")) {
                    assertThat(canonical(masked)).isEqualTo(canonical(call.path("body")));
                } else if (call.has("code")) {
                    assertThat(actual.path("code").asString()).isEqualTo(call.path("code").asString());
                }
            }
        }
    }

    static Stream<Arguments> recordedReads() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-records-acts.json")
                .toFile());
        List<Arguments> reads = new ArrayList<>();
        for (JsonNode scenario : recording.path("scenarios")) {
            String name = scenario.path("name").asString();
            if (!"reads".equals(name)) {
                continue;
            }
            reads.add(Arguments.of(scenario.path("calls").toString()));
        }
        return reads.stream();
    }

    @Test
    void listFiltersFacetsGroupingAndCursorAreServed() throws Exception {
        JsonNode page = get("/api/validations?review=Needed&limit=2", session("u3"));
        assertThat(page.path("items").size()).isEqualTo(2);
        assertThat(page.path("facets").path("reviews").isArray()).isTrue();
        assertThat(page.path("outstandingTotal").asInt()).isPositive();
        String cursor = page.path("nextCursor").asString();
        JsonNode next = get("/api/validations?review=Needed&limit=2&cursor=" + cursor, session("u3"));
        assertThat(next.path("items").get(0).path("iteration").path("id").asString())
                .isNotEqualTo(page.path("items").get(0).path("iteration").path("id").asString());
        JsonNode grouped = get("/api/validations?group=category&limit=50", session("u3"));
        assertThat(grouped.path("groups").isArray()).isTrue();
        assertThat(get("/api/validations?forbidden=Yes", session("u3")).path("items").isArray()).isTrue();
        assertThat(get("/api/validations?category=c2", session("u3")).path("items").isArray()).isTrue();
        assertThat(get("/api/validations?defect=pi10", session("u3")).path("items").isArray()).isTrue();
        assertThat(get("/api/validations?priority=Urgent", session("u3")).path("items").isArray()).isTrue();
        assertThat(get("/api/validations?project=p1", session("u3")).path("items").isArray()).isTrue();
        assertThat(get("/api/validations?since=2026-06-01", session("u3")).path("items").isArray()).isTrue();
        assertThat(get("/api/validations?q=IT11", session("u3")).path("items").size()).isEqualTo(1);
        JsonNode withOtherFilters = get("/api/validations?review=Needed&category=c2", session("u3"));
        assertThat(hasFacetValue(withOtherFilters.path("facets").path("reviews"), "Denied")).isTrue();
        assertThat(get("/api/validations?p.size=folio", session("u3")).path("items").isArray()).isTrue();
        assertThat(get("/api/validations", session("u3")).path("propertyFacets").has("material_type")).isTrue();
        assertThat(get("/api/validations?group=defect", session("u3")).path("groups").isArray()).isTrue();
    }

    @Test
    void validationSearchFindsAPluginByItsCzechName() throws Exception {
        dsl.execute("UPDATE plugin_instances SET names=?::jsonb WHERE id='pi10'",
                "{\"cs\":\"Kontrola jazyka\",\"en\":\"Language check\"}");
        assertThat(get("/api/validations?q=Kontrola%20jazyka", session("u3")).path("items").size())
                .isPositive();
    }

    @Test
    void detailRequiresReachAndAnswersTheMockNotWaitingRefusal() throws Exception {
        JsonNode detail = get("/api/validations/IT11", session("u8"));
        assertThat(detail.path("row").path("iteration").path("id").asString()).isEqualTo("IT11");
        assertStatus("/api/validations/IT10", session("u8"), 404);
    }

    @Test
    void requiresSessionAndReviewPermission() {
        assertStatus("/api/validations", null, 401);
        assertStatus("/api/validations/IT11", null, 401);
        assertStatus("/api/validations", session("u10"), 403);
        assertStatus("/api/validations/IT11", session("u10"), 403);
    }

    @Test
    void curatorOutsideCategoryCustodySeesNoRowsAndNoDetail() throws Exception {
        grant("validation-limited", "validation.approve", "custody");
        dsl.insertInto(CATEGORY_MEMBERS).set(CATEGORY_MEMBERS.CATEGORY_ID, "c4")
                .set(CATEGORY_MEMBERS.USER_ID, "u10").set(CATEGORY_MEMBERS.POSITION, 100).execute();
        JsonNode page = get("/api/validations", session("u10"));
        assertThat(page.path("items").size()).isZero();
        assertStatus("/api/validations/IT11", session("u10"), 404);
    }

    private JsonNode get(String path, String cookie) throws Exception {
        return mapper.readTree(client.get().uri(URI.create(path)).header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
    }

    private void assertStatus(String path, String cookie, int status) {
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
                .set(ROLES.NAMES, JSONB.valueOf("{\"en\":\"" + roleId + "\"}"))
                .set(ROLES.DESCRIPTION, "test role").set(ROLES.IS_SHIPPED, false)
                .set(ROLES.POSITION, 100).execute();
        dsl.insertInto(ROLE_GRANTS).set(ROLE_GRANTS.ROLE_ID, roleId).set(ROLE_GRANTS.POSITION, 0)
                .set(ROLE_GRANTS.PERMISSION, permission).set(ROLE_GRANTS.SCOPE, scope).execute();
        int position = dsl.selectCount().from(USER_HAND_ROLES).where(USER_HAND_ROLES.USER_ID.eq("u10"))
                .fetchOne(0, int.class);
        dsl.insertInto(USER_HAND_ROLES).set(USER_HAND_ROLES.USER_ID, "u10")
                .set(USER_HAND_ROLES.ROLE_ID, roleId).set(USER_HAND_ROLES.POSITION, position).execute();
    }

    private Object maskValue(JsonNode value, Map<String, String> ids) {
        if (value.isArray()) {
            List<Object> array = new ArrayList<>();
            value.forEach(item -> array.add(maskValue(item, ids)));
            return array;
        }
        if (value.isObject()) {
            Map<String, Object> object = new LinkedHashMap<>();
            value.properties().forEach(entry -> object.put(entry.getKey(), maskValue(entry.getValue(), ids)));
            return object;
        }
        if (!value.isString()) {
            return value;
        }
        String text = value.asString();
        if (text.matches("\\d{4}-\\d\\d-\\d\\dT.*")) {
            return "<time>";
        }
        String prefix = null;
        if (text.matches("B-[\\w-]+")) {
            prefix = "B";
        } else if (text.matches("IT-[\\da-f-]+")) {
            prefix = "IT";
        } else if (text.matches("E(?:\\d+|-[\\da-f-]+)")) {
            prefix = "E";
        } else if (text.matches("C-[\\da-f-]{36}")) {
            prefix = "C";
        } else if (text.matches("HX-[\\da-f-]{36}")) {
            prefix = "HX";
        } else if (text.matches("H-[\\da-f-]{36}")) {
            prefix = "H";
        } else if (text.matches("D\\d+")) {
            prefix = "D";
        } else if (text.matches("R\\d+")) {
            prefix = "R";
        } else if (text.matches("[\\da-f]{8}-(?:[\\da-f]{4}-){3}[\\da-f]{12}")) {
            prefix = "U";
        }
        if (prefix == null) {
            return text;
        }
        String kind = prefix;
        return ids.computeIfAbsent(text, ignored -> "<" + kind
                + ((int) ids.values().stream().filter(token -> token.startsWith("<" + kind)).count() + 1) + ">");
    }

    private JsonNode canonical(JsonNode value) throws Exception {
        return mapper.readTree(value.toString().replace(".000Z", "Z"));
    }

    private boolean hasFacetValue(JsonNode facets, String value) {
        for (JsonNode facet : facets) {
            if (value.equals(facet.path("value").asString())) {
                return true;
            }
        }
        return false;
    }
}

package cz.mzk.vera.lists;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// VIEW-lists; SCOPE-list; LC-LIST-state; LC-LIST-pool; PLAN-counting.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ListsReadTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void readsRecordedListsIndexAndPoolForTheirSeededUsers() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-lists.json").toFile());
        JsonNode reads = scenario(recording, "reads");
        for (JsonNode call : reads.path("calls")) {
            if (!"GET".equals(call.path("method").asString())) {
                continue;
            }
            String path = call.path("path").asString();
            if (!(path.equals("/api/lists") || path.startsWith("/api/digitization-lists?")
                    || path.startsWith("/api/digitization-lists/pool?"))) {
                continue;
            }
            String userId = call.path("as").asString();
            String cookie = path.equals("/api/lists") ? null : session(userId);
            var response = client.get().uri(URI.create(path)).headers(headers -> {
                if (cookie != null) {
                    headers.add("Cookie", cookie);
                }
            }).exchange();
            response.expectStatus().isEqualTo(call.path("status").asInt());
            if (call.path("status").asInt() == 200) {
                JsonNode actual = mapper.readTree(response.expectBody(String.class).returnResult().getResponseBody());
                assertRecording(call.path("body"), actual);
            }
        }
    }

    @Test
    void readsAllowedDetailAndRefusesUnknownOrUnreachableLists() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-lists.json").toFile());
        JsonNode detail = scenario(recording, "detail-allowed-refused-and-unknown");
        for (JsonNode call : detail.path("calls")) {
            String cookie = session(call.path("as").asString());
            var response = client.get().uri(URI.create(call.path("path").asString()))
                    .header("Cookie", cookie).exchange();
            response.expectStatus().isEqualTo(call.path("status").asInt());
            if (call.path("status").asInt() == 200) {
                JsonNode actual = mapper.readTree(response.expectBody(String.class).returnResult().getResponseBody());
                assertRecording(call.path("body"), actual);
            }
        }
    }

    @Test
    void listStateFollowsTheClockAcrossItsStartDate() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-lists.json").toFile());
        JsonNode expectedDetail = scenario(recording, "detail-allowed-refused-and-unknown")
                .path("calls").get(0).path("body").path("row").path("list");
        String listId = expectedDetail.path("id").asString();
        LocalDate startsOn = LocalDate.parse(expectedDetail.path("startsOn").asString());
        String cookie = session("u2");
        assertState(listId, startsOn.minusDays(1), "Planned", cookie);
        assertState(listId, startsOn, "InProgress", cookie);
        assertState(listId, startsOn.plusDays(1), "InProgress", cookie);
    }

    @Test
    void poolLeavesOutEachIneligibleReason() {
        String notReady = candidate("SELECT id FROM iterations WHERE progress <> 'Ready' "
                + "AND list_id IS NULL AND cancellation_cause IS NULL LIMIT 1");
        String listed = candidate("SELECT id FROM iterations WHERE list_id IS NOT NULL LIMIT 1");
        String gateFails = candidate("SELECT iteration_id FROM iteration_states "
                + "WHERE status IN ('Forbidden', 'ReviewNeeded', 'ValidationDenied') LIMIT 1");
        JsonNode pool = get("/api/digitization-lists/pool?limit=200", session("u3"));
        assertThat(pool.path("items").isArray()).isTrue();
        assertThat(pool.path("items").size()).isGreaterThan(0);
        assertThat(pool.path("items")).noneMatch(item -> item.path("iteration").path("id")
                .asString().equals(notReady));
        assertThat(pool.path("items")).noneMatch(item -> item.path("iteration").path("id")
                .asString().equals(listed));
        assertThat(pool.path("items")).noneMatch(item -> item.path("iteration").path("id")
                .asString().equals(gateFails));
        assertThat(pool.path("items")).allMatch(item -> "Ready".equals(
                item.path("iteration").path("progress").asString())
                && !item.path("iteration").path("listId").isString());
    }

    @Test
    void poolFiltersAndFacetsEachUseTheOtherFilters() {
        JsonNode pool = get("/api/digitization-lists/pool?limit=200&p.material_type=Monograph", session("u3"));
        assertThat(pool.path("total").asInt()).isEqualTo(3);
        assertThat(pool.path("propertyFacets").path("material_type").path("values").size()).isGreaterThan(1);
        int sizeFacetTotal = pool.path("propertyFacets").path("size").path("noValue").asInt();
        for (JsonNode value : pool.path("propertyFacets").path("size").path("values")) {
            sizeFacetTotal += value.path("count").asInt();
        }
        assertThat(sizeFacetTotal).isEqualTo(pool.path("total").asInt());
    }

    @Test
    void poolOrdersByPriorityThenAgeAndSlicesInSql() {
        String cookie = session("u3");
        JsonNode first = get("/api/digitization-lists/pool?limit=2", cookie);
        JsonNode second = get("/api/digitization-lists/pool?limit=2&cursor="
                + first.path("items").get(1).path("iteration").path("id").asString(), cookie);
        assertThat(first.path("items").size()).isEqualTo(2);
        assertThat(second.path("items").size()).isEqualTo(2);
        assertThat(second.path("items").get(0).path("iteration").path("id").asString())
                .isNotEqualTo(first.path("items").get(1).path("iteration").path("id").asString());
        int firstRank = priority(first.path("items").get(0));
        int secondRank = priority(first.path("items").get(1));
        assertThat(firstRank).isGreaterThanOrEqualTo(secondRank);
        if (firstRank == secondRank) {
            assertThat(first.path("items").get(0).path("askedAt").asString())
                    .isLessThanOrEqualTo(first.path("items").get(1).path("askedAt").asString());
        }
    }

    @Test
    void refusesUnauthenticatedAndUnauthorizedReadsAndPool() {
        getStatus("/api/digitization-lists?limit=50", null, 401);
        getStatus("/api/digitization-lists/pool?limit=50", null, 401);
        getStatus("/api/digitization-lists/L-2026-015", null, 401);
        String noRead = session("u8");
        getStatus("/api/digitization-lists?limit=50", noRead, 403);
        getStatus("/api/digitization-lists/pool?limit=50", noRead, 403);
        getStatus("/api/digitization-lists/L-2026-015", noRead, 403);
    }

    private String candidate(String sql) {
        return jdbc.queryForObject(sql, String.class);
    }

    private int priority(JsonNode item) {
        return switch (item.path("iteration").path("priority").asString()) {
            case "Low" -> 0;
            case "Normal" -> 1;
            case "High" -> 2;
            case "Urgent" -> 3;
            default -> -1;
        };
    }

    private void assertState(String listId, LocalDate date, String state, String cookie) throws Exception {
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("at", date + "T12:00:00.000Z"))
                .exchange().expectStatus().isOk();
        JsonNode detail = get("/api/digitization-lists/" + listId, session("u2"));
        assertThat(detail.path("row").path("state").asString()).isEqualTo(state);
    }

    private JsonNode scenario(JsonNode recording, String name) {
        for (JsonNode scenario : recording.path("scenarios")) {
            if (name.equals(scenario.path("name").asString())) {
                return scenario;
            }
        }
        throw new AssertionError("No recorded scenario " + name);
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
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

    private void assertRecording(JsonNode expected, JsonNode actual) {
        assertRecording(expected, actual, "$");
    }

    private void assertRecording(JsonNode expected, JsonNode actual, String pointer) {
        if (expected.isString() && expected.asString().startsWith("<")
                && expected.asString().endsWith(">")) {
            return;
        }
        if (expected.isObject()) {
            assertThat(actual.isObject()).isTrue();
            assertThat(actual.size()).as("object field count at %s", pointer).isEqualTo(expected.size());
            expected.properties().forEach(entry -> assertRecording(entry.getValue(), actual.path(entry.getKey()),
                    pointer + "." + entry.getKey()));
            return;
        }
        if (expected.isArray()) {
            assertThat(actual.size()).as("array length at %s", pointer).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertRecording(expected.get(index), actual.get(index), pointer + "[" + index + "]");
            }
            return;
        }
        if (expected.isNumber() && actual.isNumber()) {
            assertThat(actual.decimalValue().compareTo(expected.decimalValue()))
                    .as("recorded number at %s", pointer).isZero();
            return;
        }
        assertThat(actual).as("recorded value at %s did not match: expected %s, actual %s",
                pointer, expected, actual)
                .isEqualTo(expected);
    }
}

package cz.mzk.vera.lists;

import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.LinkedHashMap;
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
import tools.jackson.databind.ObjectMapper;

// PLAN-generate-*; PLAN-mix-reading; LC-LIST-pool.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ListPlanningTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private DSLContext dsl;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void readsEnabledGeneratorsAndShapesForListBuilders() throws Exception {
        JsonNode generators = get("/api/digitization-lists/generators", session("u2"));
        assertThat(generators.size()).isEqualTo(2);
        assertThat(generators.get(0).path("id").asString()).isEqualTo("pi14");
        assertThat(generators.get(0).path("plugin").asString()).isEqualTo("PriorityThenMix");
        assertThat(generators.get(0).path("generatorClass").asString()).isEqualTo("RuleBased");
        assertThat(generators.get(0).path("description").asString())
                .contains("highest priority first");
        assertThat(generators.get(0).path("tolerance").asDouble()).isEqualTo(0.05);
        assertThat(generators.get(1).path("id").asString()).isEqualTo("pi15");
        assertThat(get("/api/digitization-lists/shapes", session("u2")).get(0).path("id").asString())
                .isEqualTo("i4");
        status("GET", "/api/digitization-lists/generators", null, null, 401);
        status("GET", "/api/digitization-lists/shapes", null, null, 401);
        status("GET", "/api/digitization-lists/generators", session("u8"), null, 403);
        status("GET", "/api/digitization-lists/shapes", session("u8"), null, 403);
    }

    @Test
    void readsRecordedDraftAndCountsTowardsFromOneSnapshot() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-lists.json").toFile());
        replayCalls(scenario(recording, "read-list-draft"), "/api/digitization-lists/reading");
    }

    @Test
    void refusesReadingAnUnknownIntentionAndRequiresListBuildPermission() throws Exception {
        String request = "{\"listId\":null,\"startsOn\":null,\"memberIds\":[],"
                + "\"intentionId\":\"missing\",\"targetPages\":null,\"allocation\":null}";
        JsonNode missing = post("/api/digitization-lists/reading", session("u2"), mapper.readTree(request), 422);
        assertThat(missing.path("code").asString()).isEqualTo("list.intention_not_found");
        status("POST", "/api/digitization-lists/reading", session("u8"),
                mapper.readTree("{\"listId\":null,\"startsOn\":null,\"memberIds\":[],"
                        + "\"intentionId\":null,\"targetPages\":null,\"allocation\":null}"), 403);
        status("POST", "/api/digitization-lists/reading", null,
                mapper.readTree("{\"listId\":null,\"startsOn\":null,\"memberIds\":[],"
                        + "\"intentionId\":null,\"targetPages\":null,\"allocation\":null}"), 401);
    }

    @Test
    void generatesTheRecordedRuleBasedMixDraftAndRefusals() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-lists.json").toFile());
        replayCalls(scenario(recording, "generate-list-draft"), "/api/digitization-lists/generate");
    }

    @Test
    void generatesForTheAdvisorAndKeepsCurrentMembers() throws Exception {
        String cookie = session("u2");
        JsonNode advisor = post("/api/digitization-lists/generate", cookie, mapper.readTree(
                "{\"generatorId\":\"pi15\",\"pages\":1000,\"categoryIds\":[],"
                        + "\"memberIds\":[\"IT30\"],\"intentionId\":\"i4\",\"allocation\":null}"), 200);
        assertThat(advisor.path("picks").isArray()).isTrue();
        assertThat(advisor.path("picks")).noneMatch(pick -> "IT30".equals(
                pick.path("item").path("iteration").path("id").asString()));
        assertThat(advisor.path("totalPages").asInt())
                .isGreaterThanOrEqualTo(advisor.path("picks").size());
        JsonNode noMix = post("/api/digitization-lists/generate", cookie, mapper.readTree(
                "{\"generatorId\":\"pi14\",\"pages\":500,\"categoryIds\":[],"
                        + "\"memberIds\":[],\"intentionId\":\"i2\",\"allocation\":null}"), 200);
        assertThat(noMix.path("generator").path("id").asString()).isEqualTo("pi14");
        assertThat(noMix.path("picks").size()).isGreaterThan(0);
    }

    @Test
    void generatesWithACorrectingAllocation() throws Exception {
        JsonNode draft = post("/api/digitization-lists/generate", session("u2"), mapper.readTree(
                "{\"generatorId\":\"pi14\",\"pages\":1000,\"categoryIds\":[],"
                        + "\"memberIds\":[],\"intentionId\":\"i4\","
                        + "\"allocation\":{\"c1\":500,\"c2\":500}}"), 200);
        assertThat(draft.path("generator").path("id").asString()).isEqualTo("pi14");
        assertThat(draft.path("provenance").path("allocation").path("c1").asInt()).isEqualTo(500);
    }

    @Test
    void refusesEachGenerationCaseAndUnauthenticatedCalls() throws Exception {
        String cookie = session("u2");
        post("/api/digitization-lists/generate", cookie, generation("missing", null, null), 404);
        assertProblemCode(post("/api/digitization-lists/generate", cookie,
                generation("pi14", "i10", null), 422), "list.intention_ended");
        assertProblemCode(post("/api/digitization-lists/generate", cookie,
                generation("pi14", "i3", Map.of("c1", 1)), 422), "list.allocation_outside_mix");
        assertProblemCode(post("/api/digitization-lists/generate", cookie,
                generation("pi14", "i2", Map.of("c1", 1)), 422), "list.correction_needs_mix");
        status("POST", "/api/digitization-lists/generate", session("u8"),
                generation("pi14", null, null), 403);
        status("POST", "/api/digitization-lists/generate", null,
                generation("pi14", null, null), 401);
    }

    @Test
    void generatorUnavailableAndMalformedAnswersAre503WithoutWrites() throws Exception {
        for (String seed : List.of("bk6i-listgenerator-unavailable", "bk6i-listgenerator-malformed")) {
            reset.reset(seed, true);
            String cookie = session("u2");
            String listsBefore = dsl.selectFrom(DIGITIZATION_LISTS).fetch().toString();
            String iterationsBefore = dsl.selectFrom(ITERATIONS).fetch().toString();
            int eventsBefore = dsl.selectCount().from(EVENTS).fetchOne(0, int.class);
            JsonNode problem = post("/api/digitization-lists/generate", cookie,
                    generation("pi14", "i4", null), 503);
            assertThat(problem.path("detail").asString()).isEqualTo("The list generator did not answer.");
            assertThat(dsl.selectFrom(DIGITIZATION_LISTS).fetch().toString()).isEqualTo(listsBefore);
            assertThat(dsl.selectFrom(ITERATIONS).fetch().toString()).isEqualTo(iterationsBefore);
            assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(eventsBefore);
        }
    }

    private JsonNode generation(String generatorId, String intentionId, Map<String, Integer> allocation) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("generatorId", generatorId);
        body.put("pages", 1000);
        body.put("categoryIds", List.of());
        body.put("memberIds", List.of());
        body.put("intentionId", intentionId);
        body.put("allocation", allocation);
        return mapper.valueToTree(body);
    }

    private void replayCalls(JsonNode scenario, String path) throws Exception {
        for (JsonNode call : scenario.path("calls")) {
            if (!path.equals(call.path("path").asString())) {
                continue;
            }
            String cookie = session(call.path("as").asString());
            JsonNode actual = post(path, cookie, call.path("requestBody"), call.path("status").asInt());
            if (call.has("body")) {
                assertRecording(call.path("body"), actual);
            } else if (call.has("code")) {
                assertThat(actual.path("code").asString()).isEqualTo(call.path("code").asString());
            }
        }
    }

    private JsonNode scenario(JsonNode recording, String name) {
        for (JsonNode candidate : recording.path("scenarios")) {
            if (name.equals(candidate.path("name").asString())) {
                return candidate;
            }
        }
        throw new AssertionError("No recorded scenario " + name);
    }

    private JsonNode get(String path, String cookie) throws Exception {
        return mapper.readTree(client.get().uri(URI.create(path)).header("Cookie", cookie).exchange()
                .expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
    }

    private JsonNode post(String path, String cookie, JsonNode body, int status) throws Exception {
        var request = client.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(body);
        if (cookie != null) {
            request.header("Cookie", cookie);
        }
        String response = request.exchange().expectStatus().isEqualTo(status).expectBody(String.class)
                .returnResult().getResponseBody();
        return response == null || response.isBlank() ? mapper.createObjectNode() : mapper.readTree(response);
    }

    private void status(String method, String path, String cookie, JsonNode body, int expected) {
        if ("GET".equals(method)) {
            var request = client.get().uri(path);
            if (cookie != null) {
                request.header("Cookie", cookie);
            }
            request.exchange().expectStatus().isEqualTo(expected);
            return;
        }
        var request = client.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(body);
        if (cookie != null) {
            request.header("Cookie", cookie);
        }
        request.exchange().expectStatus().isEqualTo(expected);
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void assertProblemCode(JsonNode problem, String code) {
        assertThat(problem.path("code").asString()).isEqualTo(code);
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
            assertThat(actual.isObject()).as("object at %s", pointer).isTrue();
            assertThat(actual.size()).as("fields at %s", pointer).isEqualTo(expected.size());
            expected.properties().forEach(entry -> assertRecording(entry.getValue(), actual.path(entry.getKey()),
                    pointer + "." + entry.getKey()));
        } else if (expected.isArray()) {
            assertThat(actual.size()).as("array at %s", pointer).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertRecording(expected.get(index), actual.get(index), pointer + "[" + index + "]");
            }
        } else if (expected.isNumber() && actual.isNumber()) {
            assertThat(actual.decimalValue().compareTo(expected.decimalValue()))
                    .as("number at %s", pointer).isZero();
        } else {
            assertThat(actual).as("value at %s", pointer).isEqualTo(expected);
        }
    }
}

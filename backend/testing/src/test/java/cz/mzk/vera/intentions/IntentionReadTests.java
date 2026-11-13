package cz.mzk.vera.intentions;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// VIEW-intentions; PLAN-counting; PLAN-mix-reading; LC-INT-archive; ACT-refusal-code.
@SpringBootTest(
    classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class IntentionReadTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired private RestTestClient client;
    @Autowired private TemplateResetService reset;
    @Autowired private ObjectMapper mapper;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void recordedReadsMatchBeforeScenarioActs() throws Exception {
        JsonNode recording =
            mapper.readTree(Path.of("../../replay/recordings/base-intentions.json").toFile());
        for (JsonNode scenario : recording.path("scenarios")) {
            boolean sawAct = false;
            for (JsonNode call : scenario.path("calls")) {
                String method = call.path("method").asString();
                String path = call.path("path").asString();
                boolean preview = "POST".equals(method) && "/api/intentions/preview".equals(path);
                boolean read = "GET".equals(method) && isIntentionRead(path);
                if (!preview && !read) {
                    sawAct = true;
                }
                if (sawAct || (!preview && !read)) {
                    break;
                }
                assertRecorded(call, path, method, scenario.path("name").asString());
            }
        }
    }

    @Test
    void archivedIntentionUsesItsSnapshotAfterLiveMixAndCategoriesChange() {
        reset.reset("bk6c-archived-intention", true);
        jdbc.update("UPDATE categories SET name='Changed today' WHERE id='c1'");
        jdbc.update("UPDATE mixes SET name='Changed today' WHERE id='d1'");
        String cookie = session("u3");
        JsonNode mix = mapper.readTree(client.get()
                .uri("/api/intentions/i10/mix")
                .header("Cookie", cookie)
                .header("Accept-Language", "en")
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody());
        assertThat(mix.path("mix").path("mixName").asString()).isEqualTo("House mix");
        JsonNode archivedCategory = null;
        for (JsonNode category : mix.path("archivedCategories")) {
            if ("c1".equals(category.path("id").asString())) {
                archivedCategory = category;
                break;
            }
        }
        assertThat(archivedCategory).isNotNull();
        assertThat(archivedCategory.path("name").asString()).isEqualTo("Periodicals");
        JsonNode index = mapper.readTree(client.get()
                .uri("/api/intentions/overview")
                .header("Cookie", cookie)
                .header("Accept-Language", "en")
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody());
        JsonNode archivedRow = null;
        for (JsonNode row : index.path("rows")) {
            if ("i10".equals(row.path("intention").path("id").asString())) {
                archivedRow = row;
                break;
            }
        }
        assertThat(archivedRow).isNotNull();
        assertThat(archivedRow.path("intention").path("name").asString())
            .isEqualTo("Monthly output — May 2026");
    }

    @Test
    void callerWithoutAnySeesNoRepeatRowsAndPreviewIsUnauthenticatedWithoutSession() {
        String cookie = session("u9");
        JsonNode index = mapper.readTree(client.get()
                .uri("/api/intentions/overview")
                .header("Cookie", cookie)
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody());
        assertThat(index.path("templates").size()).isZero();
        client.get().uri("/api/intentions/overview").exchange().expectStatus().isUnauthorized();
        client.post()
            .uri("/api/intentions/preview")
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"funding\":{\"kind\":\"any\"},\"scopeCategoryId\":null,"
                + "\"countsFrom\":\"2026-01-01\",\"endsOn\":null,\"intentionId\":null,"
                + "\"mix\":{\"kind\":\"none\"}}")
            .exchange()
            .expectStatus()
            .isUnauthorized();
    }

    @Test
    void readRefusalsAndDeletionPreviewMatchTheContract() {
        client.get()
            .uri("/api/intentions/overview")
            .header("Cookie", session("u4"))
            .exchange()
            .expectStatus()
            .isForbidden()
            .expectBody()
            .jsonPath("$.detail")
            .isEqualTo("You may not read intentions");
        client.get()
            .uri("/api/intentions/unknown/mix")
            .header("Cookie", session("u3"))
            .exchange()
            .expectStatus()
            .isNotFound();
        client.get()
            .uri("/api/intentions/i8/correction")
            .header("Cookie", session("u2"))
            .exchange()
            .expectStatus()
            .isEqualTo(422)
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("list.page_count_required");
        client.get()
            .uri("/api/intentions/i8/correction?pages=3000")
            .header("Cookie", session("u8"))
            .exchange()
            .expectStatus()
            .isForbidden()
            .expectBody()
            .jsonPath("$.detail")
            .isEqualTo("You may not build lists");
        client.get()
            .uri("/api/intentions/i3/deletion")
            .header("Cookie", session("u3"))
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody()
            .jsonPath("$.generatedLists[0].id")
            .isEqualTo("L-2026-015");
        client.get()
            .uri("/api/intentions/i10/deletion")
            .header("Cookie", session("u3"))
            .exchange()
            .expectStatus()
            .isEqualTo(409)
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("intention.is_archived");
        client.get()
            .uri("/api/intentions/i4/deletion")
            .header("Cookie", session("u3"))
            .exchange()
            .expectStatus()
            .isEqualTo(409)
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("intention.overall");
        client.get()
            .uri("/api/intentions/i2/deletion")
            .header("Cookie", session("u3"))
            .exchange()
            .expectStatus()
            .isEqualTo(409)
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("intention.project");
    }

    @Test
    void correctionWithoutMixIsRefusedAsRecorded() {
        jdbc.update(
            "INSERT INTO intentions (id,name,description,funding_kind,counts_from,ends_on,target_pages,"
            + "is_overall,position) VALUES ('i20','Correction without a mix','', 'any',"
            + "'2026-07-01','2026-12-31',1000,false,20)");
        client.get()
            .uri("/api/intentions/i20/correction?pages=1000")
            .header("Cookie", session("u2"))
            .exchange()
            .expectStatus()
            .isEqualTo(422)
            .expectBody()
            .jsonPath("$.code")
            .isEqualTo("list.correction_needs_mix");
    }

    private boolean isIntentionRead(String path) {
        return path.equals("/api/intentions/overview")
            || path.matches("/api/intentions/[^/]+/(mix|correction|deletion)(\\?.*)?");
    }

    private void assertRecorded(JsonNode call, String path, String method, String scenario) throws Exception {
        String cookie = session(call.path("as").asString());
        var request = client.method(org.springframework.http.HttpMethod.valueOf(method))
                          .uri(URI.create(path))
                          .header("Cookie", cookie)
                          .header("Accept-Language", "en");
        if ("POST".equals(method)) {
            request.contentType(MediaType.APPLICATION_JSON).body(call.path("requestBody").toString());
        }
        var result = request.exchange().expectBody(String.class).returnResult();
        assertThat(result.getStatus().value())
            .as(scenario + " " + path)
            .isEqualTo(call.path("status").asInt());
        if (call.path("status").asInt() == 200) {
            assertMatches(call.path("body"), mapper.readTree(result.getResponseBody()), path);
        } else if (call.has("code")) {
            assertThat(mapper.readTree(result.getResponseBody()).path("code").asString())
                .as(path)
                .isEqualTo(call.path("code").asString());
        }
    }

    private void assertMatches(JsonNode expected, JsonNode actual, String path) {
        if (expected.isString() && expected.asString().startsWith("<") && expected.asString().endsWith(">")) {
            assertThat(actual.isString()).as(path).isTrue();
            return;
        }
        if (expected.isObject()) {
            assertThat(actual.isObject()).as(path).isTrue();
            assertThat(actual.size()).as(path).isEqualTo(expected.size());
            expected.properties().forEach(entry -> {
                assertThat(actual.has(entry.getKey())).as(path + "." + entry.getKey()).isTrue();
                assertMatches(entry.getValue(), actual.path(entry.getKey()), path + "." + entry.getKey());
            });
            return;
        }
        if (expected.isArray()) {
            assertThat(actual.isArray()).as(path).isTrue();
            assertThat(actual.size()).as(path).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertMatches(expected.get(index), actual.get(index), path + "[" + index + "]");
            }
            return;
        }
        if (expected.isNumber() && actual.isNumber()) {
            assertThat(actual.asDouble()).as(path).isEqualTo(expected.asDouble());
            return;
        }
        assertThat(actual).as(path).isEqualTo(expected);
    }

    private String session(String userId) {
        return client.post()
            .uri("/_engine/sessions")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("userId", userId))
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody()
            .returnResult()
            .getResponseHeaders()
            .getFirst("Set-Cookie")
            .split(";", 2)[0];
    }
}

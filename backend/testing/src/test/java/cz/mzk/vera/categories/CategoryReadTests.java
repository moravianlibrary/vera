package cz.mzk.vera.categories;

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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// PLAN-tree; PLAN-counting; PLAN-house-mix; ACCESS-category-custody.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class CategoryReadTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private ObjectMapper mapper;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void recordedCategoryReadsMatchBeforeEachScenarioActs() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-categories.json").toFile());
        for (JsonNode scenario : recording.path("scenarios")) {
            for (JsonNode call : scenario.path("calls")) {
                if (!"GET".equals(call.path("method").asString())) {
                    break;
                }
                String path = call.path("path").asString();
                if (!isRead(path)) {
                    continue;
                }
                String cookie = session(call.path("as").asString());
                String language = "reads-czech-name".equals(scenario.path("name").asString()) ? "cs" : "en";
                var response = client.get().uri(URI.create(path)).header("Cookie", cookie)
                        .header("Accept-Language", language)
                        .exchange().expectBody(String.class).returnResult();
                assertThat(response.getStatus().value())
                        .as(scenario.path("name").asString() + " " + path)
                        .isEqualTo(call.path("status").asInt());
                if (call.path("status").asInt() == 200) {
                    assertMatches(call.path("body"), mapper.readTree(response.getResponseBody()), path);
                } else {
                    assertThat(mapper.readTree(response.getResponseBody()).path("detail").asString())
                            .as(path).isEqualTo(call.path("body").path("detail").asString());
                }
            }
        }
    }

    @Test
    void custodianReadsTheirCategoryReach() throws Exception {
        JsonNode overview = get("/api/categories/overview", "u8");
        JsonNode periodicals = node(overview, "c2");
        JsonNode maps = node(overview, "c4");
        assertThat(periodicals.path("reach").get(0).path("userId").asString()).isEqualTo("u1");
        assertThat(periodicals.path("reach").get(0).path("group").path("id").asString()).isEqualTo("g1");
        assertThat(maps.path("reach").get(0).path("userId").asString()).isEqualTo("u8");
        assertThat(maps.path("reach").get(0).path("group").isNull()).isTrue();
    }

    @Test
    void categoryReadRefusalsIncludeUnauthorizedForbiddenAndOutOfReach() {
        client.get().uri("/api/categories/overview").exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/categories/overview").header("Cookie", session("u5"))
                .exchange().expectStatus().isForbidden().expectBody().jsonPath("$.detail")
                .isEqualTo("You may not read categories");
        client.get().uri("/api/categories/c22/impact").header("Cookie", session("u10"))
                .exchange().expectStatus().isNotFound();
        client.get().uri("/api/categories/c404/impact").header("Cookie", session("u3"))
                .exchange().expectStatus().isNotFound();
        client.get().uri("/api/categories/c22/impact").exchange().expectStatus().isUnauthorized();
    }

    private boolean isRead(String path) {
        return path.equals("/api/categories") || path.equals("/api/categories/overview")
                || path.matches("/api/categories/[^/]+/impact");
    }

    private JsonNode get(String path, String userId) throws Exception {
        var response = client.get().uri(path).header("Cookie", session(userId)).exchange()
                .expectStatus().isOk().expectBody(String.class).returnResult();
        return mapper.readTree(response.getResponseBody());
    }

    private JsonNode node(JsonNode overview, String categoryId) {
        for (JsonNode item : overview.path("nodes")) {
            if (categoryId.equals(item.path("categoryId").asString())) {
                return item;
            }
        }
        throw new AssertionError("No node " + categoryId);
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void assertMatches(JsonNode expected, JsonNode actual, String path) {
        if (expected.isString() && expected.asString().startsWith("<")
                && expected.asString().endsWith(">")) {
            assertThat(actual.isString()).as(path).isTrue();
            assertThat(actual.asString()).as(path).isNotBlank();
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
}

package cz.mzk.vera.projects;

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

// VIEW-projects; ACCESS-membership-not-capability; LC-PROJ-period.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ProjectReadTests {
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
    void recordedReadsMatchBeforeEachScenarioActs() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-projects.json").toFile());
        for (JsonNode scenario : recording.path("scenarios")) {
            for (JsonNode call : scenario.path("calls")) {
                if (!"GET".equals(call.path("method").asString())) {
                    break;
                }
                String path = call.path("path").asString();
                if (!isRead(path)) {
                    continue;
                }
                String userId = call.path("as").asString();
                var response = client.get().uri(URI.create(path)).header("Cookie", session(userId))
                        .exchange().expectBody(String.class).returnResult();
                assertThat(response.getStatus().value()).as(scenario.path("name").asString() + " " + path)
                        .isEqualTo(call.path("status").asInt());
                if (call.path("status").asInt() == 200) {
                    assertMatches(call.path("body"), mapper.readTree(response.getResponseBody()), path);
                } else {
                    assertThat(mapper.readTree(response.getResponseBody()).path("detail").asString())
                            .isEqualTo(call.path("body").path("detail").asString());
                }
            }
        }
    }

    @Test
    void projectPeriodsAndPaceUseTheControlledClock() throws Exception {
        setClock("2026-08-31T00:00:00.000Z");
        String cookie = session("u3");
        JsonNode before = overview(cookie).path("rows").get(3);
        assertThat(before.path("period").asString()).isEqualTo("Upcoming");
        assertThat(before.path("daysToStart").asInt()).isEqualTo(1);
        assertThat(before.path("daysLeft").asInt()).isEqualTo(732);
        setClock("2026-09-01T00:00:00.000Z");
        cookie = session("u3");
        JsonNode during = overview(cookie).path("rows").get(3);
        assertThat(during.path("period").asString()).isEqualTo("Active");
        assertThat(during.path("daysToStart").asInt()).isZero();
        assertThat(during.path("evenPace").isNull()).isTrue();
        setClock("2028-09-01T00:00:00.000Z");
        cookie = session("u3");
        JsonNode after = overview(cookie).path("rows").get(3);
        assertThat(after.path("period").asString()).isEqualTo("Ended");
        assertThat(after.path("daysLeft").asInt()).isZero();
    }

    @Test
    void groupMemberSeesProjectAndNonMemberDoesNotWhileManagerSeesTheirProject() {
        String groupMember = session("u9");
        client.get().uri("/api/projects/p1").header("Cookie", groupMember).exchange().expectStatus().isOk();
        client.get().uri("/api/projects/p3").header("Cookie", groupMember).exchange().expectStatus().isNotFound();
        client.get().uri("/api/projects/p7").header("Cookie", session("u3")).exchange().expectStatus().isOk();
    }

    @Test
    void projectReadRefusalsAreStable() {
        client.get().uri("/api/projects/overview").exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/projects/overview").header("Cookie", session("u4"))
                .exchange().expectStatus().isForbidden().expectBody()
                .jsonPath("$.detail").isEqualTo("You may not read projects");
        client.get().uri("/api/projects/p404").header("Cookie", session("u8"))
                .exchange().expectStatus().isNotFound();
        client.get().uri("/api/projects/p1").header("Cookie", session("u5"))
                .exchange().expectStatus().isForbidden();
    }

    private boolean isRead(String path) {
        return path.equals("/api/projects") || path.equals("/api/projects/overview")
                || path.matches("/api/projects/[^/]+$");
    }

    private JsonNode overview(String cookie) throws Exception {
        var response = client.get().uri("/api/projects/overview").header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult();
        return mapper.readTree(response.getResponseBody());
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private void setClock(String at) {
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("at", at)).exchange().expectStatus().isOk();
    }

    private void assertMatches(JsonNode expected, JsonNode actual, String path) {
        if (expected.isString() && expected.asString().startsWith("<")
                && expected.asString().endsWith(">")) {
            assertThat(actual.isString()).as(path).isTrue();
            if ("<time>".equals(expected.asString())) {
                assertThat(actual.asString()).as(path).contains("T");
            } else {
                assertThat(actual.asString()).as(path).isNotBlank();
            }
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

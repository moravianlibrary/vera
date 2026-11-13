package cz.mzk.vera.access;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
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

// ACCESS-read; the index and shared reference reads require access.read.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class AccessIndexTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void resetBase() {
        client.post().uri("/_engine/reset").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("seed", "base", "frozen", true)).exchange().expectStatus().isOk();
    }

    @Test
    void administratorReadsAccessIndexAndReferenceCollections() throws Exception {
        String cookie = session("u3");
        JsonNode expected = accessIndexFromRecording();
        var response = client.get().uri("/api/access").header("Cookie", cookie)
                .header("Accept-Language", "en").exchange()
                .expectStatus().isOk().expectBody(String.class).returnResult();
        assertMatches(expected, mapper.readTree(response.getResponseBody()), "access");
        client.get().uri("/api/users").header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].id").isEqualTo("u1");
        client.get().uri("/api/groups").header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].id").isEqualTo("g1");
        client.get().uri("/api/roles").header("Cookie", cookie).header("Accept-Language", "en")
                .exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].id").isEqualTo("reader");
    }

    private JsonNode accessIndexFromRecording() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-people.json").toFile());
        for (JsonNode scenario : recording.path("scenarios")) {
            if (!"reads".equals(scenario.path("name").asString())) {
                continue;
            }
            for (JsonNode call : scenario.path("calls")) {
                if ("GET".equals(call.path("method").asString())
                        && "/api/access".equals(call.path("path").asString())
                        && "u3".equals(call.path("as").asString())) {
                    return call.path("body");
                }
            }
        }
        throw new AssertionError("The administrator access index is missing from base-people");
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
        assertThat(actual).as(path).isEqualTo(expected);
    }

    @Test
    void personWithoutAccessReadIsForbiddenFromIndexButReadsReferenceCollections() {
        String cookie = session("u5");
        assertThat(client.get().uri("/api/access").header("Cookie", cookie).exchange()
                .returnResult(String.class).getStatus().value()).isEqualTo(403);
        client.get().uri("/api/users").header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].id").isEqualTo("u1");
        client.get().uri("/api/groups").header("Cookie", cookie).exchange().expectStatus().isOk();
        client.get().uri("/api/roles").header("Cookie", cookie).header("Accept-Language", "en")
                .exchange().expectStatus().isOk();
    }

    @Test
    void accessNamesFollowTheRequestedLanguage() throws Exception {
        JsonNode access = mapper.readTree(client.get().uri("/api/access").header("Cookie", session("u3"))
                .header("Accept-Language", "cs").exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody());
        assertThat(access.path("roles").get(0).path("name").asString()).isEqualTo("Čtenář");
        assertThat(access.path("roles").get(0).path("names").path("en").asString()).isEqualTo("reader");
        assertThat(access.path("custodies").get(0).path("names").path("cs").asString()).isEqualTo("Výchozí");
    }

    private String session(String userId) {
        String cookie = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk()
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie");
        return cookie.substring(0, cookie.indexOf(';'));
    }
}

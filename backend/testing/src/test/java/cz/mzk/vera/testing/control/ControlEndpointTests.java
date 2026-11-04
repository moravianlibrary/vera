package cz.mzk.vera.testing.control;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.SeedReader;
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

@SpringBootTest(
        classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ControlEndpointTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private SeedReader seeds;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void resetBuildsAndReusesTemplatesAndReadsSeedUsers() {
        reset("base", false);
        assertUserCount("base");
        assertThat(clockResponse().path("now").asString()).startsWith("2026-06-25T08:40:00");
        assertThat(clockResponse().path("frozen").asBoolean()).isFalse();
        Long baseTemplateOid = templateOid("base");

        reset("minimal", true);
        assertUserCount("minimal");
        assertThat(clockResponse().path("now").asString()).isEqualTo("2026-06-25T08:40:00Z");
        assertThat(clockResponse().path("frozen").asBoolean()).isTrue();

        reset("base", true);
        assertUserCount("base");
        assertThat(templateOid("base")).isEqualTo(baseTemplateOid);
        assertThat(clockResponse().path("now").asString()).isEqualTo("2026-06-25T08:40:00Z");
        assertThat(clockResponse().path("frozen").asBoolean()).isTrue();
    }

    @Test
    void returnsEngineShapedNotFoundAndClockBackwardsProblems() {
        client.post().uri("/_engine/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"seed\":\"missing-seed\"}")
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.detail").isEqualTo("There is no seed named missing-seed.");
        client.post().uri("/_engine/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"seed\":\"\"}")
                .exchange()
                .expectStatus().isEqualTo(422)
                .expectBody()
                .jsonPath("$.detail").isEqualTo("Too small: expected string to have >=1 characters")
                .jsonPath("$.errors[0].pointer").isEqualTo("/seed");

        reset("base", true);
        String clockResult = client.post().uri("/_engine/clock")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"days\":1}}")
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        JsonNode advancedClock = mapper.readTree(clockResult);
        assertThat(advancedClock.path("now").asString()).startsWith("2026-06-26T08:40:00");
        assertThat(advancedClock.path("frozen").asBoolean()).isTrue();
        client.post().uri("/_engine/clock")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"at\":\"2026-06-25T08:40:00Z\"}")
                .exchange()
                .expectStatus().isEqualTo(409)
                .expectBody()
                .jsonPath("$.code").isEqualTo("clock.backwards");
    }

    @Test
    void rejectsMalformedControlInputs() {
        client.post().uri("/_engine/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"frozen\":\"yes\"}")
                .exchange()
                .expectStatus().isEqualTo(422)
                .expectBody()
                .jsonPath("$.detail").isEqualTo("Invalid input: expected boolean, received string")
                .jsonPath("$.errors[0].pointer").isEqualTo("/frozen");
        client.post().uri("/_engine/clock")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"at\":\"2026-06-25T08:40:00Z\",\"advance\":{}}")
                .exchange()
                .expectStatus().isEqualTo(422);
    }

    private void reset(String seed, boolean frozen) {
        String body = client.post().uri("/_engine/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"seed\":\"" + seed + "\",\"frozen\":" + frozen + "}")
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        JsonNode response = mapper.readTree(body);
        assertThat(response.path("seed").asString()).isEqualTo(seed);
        assertThat(response.path("now").isString()).isTrue();
    }

    private void assertUserCount(String seedName) {
        Long count = jdbc.queryForObject("SELECT count(*) FROM users", Long.class);
        int expected = seeds.read(seedName).path("collections").path("users").size();
        assertThat(count).isEqualTo((long) expected);
    }

    private Long templateOid(String seed) {
        return jdbc.queryForObject(
                "SELECT oid::bigint FROM pg_database WHERE datname = ?",
                Long.class,
                "vera_tpl_" + seed);
    }

    private JsonNode clockResponse() {
        String response = client.post().uri("/_engine/clock")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{}")
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        return mapper.readTree(response);
    }
}

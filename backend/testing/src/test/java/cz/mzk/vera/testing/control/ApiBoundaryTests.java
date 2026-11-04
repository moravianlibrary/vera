package cz.mzk.vera.testing.control;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.session.SessionFilter;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import cz.mzk.vera.web.ContractFilter;
import cz.mzk.vera.web.RouteCheck;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ApiBoundaryTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping mappings;

    @Autowired
    private ContractFilter contract;

    @Autowired
    private RouteCheck routes;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void resetBase() {
        client.post().uri("/_engine/reset").contentType(MediaType.APPLICATION_JSON)
                .body("{\"seed\":\"base\",\"frozen\":true}")
                .exchange().expectStatus().isOk();
    }

    @Test
    void checksUnknownWrongMethodMalformedAndInvalidRequests() {
        client.get().uri("/api/not-an-operation").exchange().expectStatus().isNotFound()
                .expectBody().jsonPath("$.detail").isEqualTo("No endpoint answers /not-an-operation.");
        client.post().uri("/api/login").exchange().expectStatus().isEqualTo(405)
                .expectBody().jsonPath("$.detail").isEqualTo("/login does not answer POST.");
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON).body("not json")
                .exchange().expectStatus().isBadRequest().expectBody()
                .jsonPath("$.detail").isEqualTo("The body is not JSON.");
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON).body("{}")
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.detail").exists().jsonPath("$.errors[0].pointer").isEqualTo("/username");
        client.get().uri("/api/login?unexpected=yes").exchange().expectStatus().isEqualTo(422)
                .expectBody().jsonPath("$.errors[0].pointer").isEqualTo("");
    }

    @Test
    void servesRecordedLoginSessionAndOperationNames() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-sign-in.json").toFile());
        JsonNode expectedLogin = recording.path("scenarios").get(0).path("calls").get(0).path("body");
        JsonNode login = mapper.readTree(client.get().uri("/api/login").exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody());
        assertThat(login).isEqualTo(expectedLogin);

        String cookie = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body("{\"userId\":\"u3\"}").exchange().expectStatus().isOk()
                .expectHeader().value("Set-Cookie", value -> assertThat(value).contains("vera_session=")
                        .contains("HttpOnly").contains("SameSite=Lax").contains("Path=/"))
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie");
        String sessionCookie = cookie.substring(0, cookie.indexOf(';'));
        JsonNode expectedSession = recording.path("scenarios").get(0).path("calls").get(1).path("body");
        var sessionResult = client.get().uri("/api/session").header("Cookie", sessionCookie).exchange()
                .expectStatus().isOk().expectHeader().value("Set-Cookie", value -> {
                    assertThat(value).startsWith(sessionCookie).contains("Max-Age=1800").doesNotContain("Secure");
                }).expectBody(String.class).returnResult();
        JsonNode session = mapper.readTree(sessionResult.getResponseBody());
        assertThat(session).isEqualTo(expectedSession);
        JsonNode endpoints = mapper.readTree(client.get().uri("/_engine/endpoints").exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody());
        assertThat(endpoints.toString()).isEqualTo("[\"loginEntries\",\"session\"]");
    }

    @Test
    void expiresIdleAndSuspendedSessions() {
        String cookie = openU3Session();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"minutes\":31}}")
                .exchange().expectStatus().isOk();
        client.get().uri("/api/session").header("Cookie", cookie).exchange().expectStatus().isUnauthorized();

        String liveCookie = openU3Session();
        jdbc.update("UPDATE users SET suspended_at=?::timestamptz WHERE id='u3'", "2026-06-25T08:40:00Z");
        client.get().uri("/api/session").header("Cookie", liveCookie).exchange().expectStatus().isUnauthorized();
    }

    @Test
    void expiresSessionAtAbsoluteLimit() {
        String cookie = openU3Session();
        String token = cookie.substring((SessionFilter.COOKIE + "=").length());
        jdbc.update("UPDATE sessions SET started_at=? WHERE token_hash=?",
                OffsetDateTime.parse("2026-06-24T20:39:59Z"), SessionFilter.hashOf(token));
        client.get().uri("/api/session").header("Cookie", cookie).exchange().expectStatus().isUnauthorized();
    }

    @Test
    void startupRouteCheckRejectsAMappingOutsideOpenApi() throws Exception {
        var mapping = RequestMappingInfo.paths("/api/unlisted-test-route")
                .methods(RequestMethod.GET).build();
        mappings.registerMapping(mapping, this, ApiBoundaryTests.class.getMethod("unlistedTestRoute"));
        assertThatThrownBy(() -> routes.verifyApiRoutes(mappings, contract).afterSingletonsInstantiated())
                .hasMessageContaining("Uncontracted route").hasMessageContaining("/api/unlisted-test-route");
    }

    public void unlistedTestRoute() { }

    private String openU3Session() {
        var response = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body("{\"userId\":\"u3\"}")
                .exchange().expectStatus().isOk().expectBody().returnResult();
        String value = response.getResponseHeaders().getFirst("Set-Cookie");
        assertThat(value).contains("HttpOnly").contains("SameSite=Lax").contains("Path=/");
        return value.substring(0, value.indexOf(';'));
    }
}

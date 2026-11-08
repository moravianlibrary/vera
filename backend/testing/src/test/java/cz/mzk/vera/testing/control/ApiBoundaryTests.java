package cz.mzk.vera.testing.control;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.session.SessionFilter;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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

// ACCESS-login-page; ACCESS-login-return; E14.
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
        jdbc.update("UPDATE plugin_instances SET is_enabled=false WHERE id='pi41'");
        assertThat(client.get().uri("/api/login").exchange().expectStatus().isOk().expectBody(String.class)
                .returnResult().getResponseBody()).doesNotContain("pi41");
        jdbc.update("UPDATE plugin_instances SET is_enabled=true WHERE id='pi41'");

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
        String expectedEndpoints = "[\"account\",\"batchApprove\",\"batchRetry\",\"batches\",\"confirmEmail\","
                + "\"digitizationListPool\",\"digitizationLists\",\"documentDetail\","
                + "\"documents\",\"groupCreate\",\"groupMembers\",\"groupSave\","
                + "\"identityDefaultRole\",\"identityLink\",\"identityUnlink\","
                + "\"iterationCancel\",\"iterationOverrule\",\"iterationPageCount\","
                + "\"iterationPrimaryLink\",\"iterationPublish\",\"iterationRecheck\","
                + "\"iterationReclassify\",\"iterationRemoveLink\",\"iterationReplaceLink\","
                + "\"iterationResume\",\"listDetail\",\"lists\","
                + "\"localAccount\","
                + "\"loginCallback\",\"loginEntries\",\"loginForm\",\"loginStart\",\"logout\","
                + "\"projectDetail\",\"projectIndex\",\"projects\","
                + "\"properties\",\"propertyCreate\",\"propertyDelete\",\"propertyImpact\","
                + "\"propertySave\",\"proposalBarcode\",\"proposalCatalogSearch\",\"proposalLookup\","
                + "\"proposalPhoto\",\"proposalRateLimit\",\"proposalRecordLink\",\"proposalSettings\","
                + "\"proposals\",\"requestApprove\",\"requestCustodies\","
                + "\"requestDecline\",\"requestDetail\",\"requestPasswordReset\","
                + "\"requestWithdraw\",\"requests\",\"resetPassword\",\"roleCreate\",\"roleDelete\","
                + "\"roleSave\",\"sendVerificationAgain\",\"session\",\"settingsGet\","
                + "\"settingsPatch\",\"signUp\",\"userGroups\",\"userRestore\",\"userRoles\","
                + "\"userSuspend\",\"validationAccept\",\"validationDeny\",\"validationDetail\","
                + "\"validationRevoke\",\"validations\"]";
        assertThat(endpoints.toString()).isEqualTo(expectedEndpoints);
    }

    @Test
    void logsInThroughLocalFormAndLogsOut() {
        var identity = jdbc.queryForMap("SELECT external_id,user_id FROM user_identities WHERE instance_id='pi24' ORDER BY position LIMIT 1");
        String username = (String) identity.get("external_id");
        String userId = (String) identity.get("user_id");
        var login = client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("username", username, "password", "seed-password"))
                .exchange().expectStatus().isNoContent().expectHeader().value("Set-Cookie", value ->
                        assertThat(value).contains("vera_session=").contains("HttpOnly").contains("SameSite=Lax"))
                .expectBody().returnResult();
        String cookie = login.getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
        client.get().uri("/api/session").header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.user.id").isEqualTo(userId);
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("username", username, "password", "wrong"))
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("username", username, "password", "seed-password"))
                .exchange().expectStatus().isNoContent();
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("username", "missing", "password", "wrong"))
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/login/pi22").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("username", username, "password", "pass"))
                .exchange().expectStatus().isNotFound();
        client.delete().uri("/api/session/logout").header("Cookie", cookie).exchange()
                .expectStatus().isNoContent().expectHeader().value("Set-Cookie", value ->
                        assertThat(value).contains("vera_session=").contains("Max-Age=0").contains("HttpOnly"));
        client.get().uri("/api/session").header("Cookie", cookie).exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/session/logout").exchange().expectStatus().isNoContent();
        jdbc.update("UPDATE users SET suspended_at=now() WHERE id=?", userId);
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("username", username, "password", "seed-password"))
                .exchange().expectStatus().isForbidden().expectBody().jsonPath("$.code").isEqualTo("access.suspended");
    }

    @Test
    void completesRedirectLoginAndExpiresAConsumedFlow() {
        var start = client.get().uri("/api/login/pi22?returnTo=/requests").exchange()
                .expectStatus().isFound().expectBody().returnResult();
        String providerPath = start.getResponseHeaders().getLocation().toString();
        assertThat(jdbc.queryForObject("SELECT return_to FROM login_flows", String.class)).isEqualTo("/requests");
        var provider = client.get().uri(providerPath).exchange().expectStatus().isOk().expectBody(String.class)
                .returnResult().getResponseBody();
        assertThat(provider).contains("Jana Nováková").contains("href=");
        assertThat(provider.split("<li>").length - 1).isEqualTo(7);
        Matcher link = Pattern.compile("href=\\\"([^\\\"]*jnovakova[^\\\"]*)\\\"")
                .matcher(provider);
        assertThat(link.find()).isTrue();
        String href = java.net.URLDecoder.decode(link.group(1).replace("&amp;", "&"), java.nio.charset.StandardCharsets.UTF_8);
        var callback = client.get().uri(href).exchange().expectStatus().isFound()
                .expectHeader().value("Location", value -> assertThat(value).isEqualTo("/requests"))
                .expectHeader().value("Set-Cookie", value -> assertThat(value).contains("vera_session="))
                .expectBody().returnResult();
        String cookie = callback.getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
        client.get().uri("/api/session").header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.user.id").isEqualTo("u1");
        String flow = java.net.URLDecoder.decode(href.substring(href.indexOf("flow=") + 5,
                href.indexOf("&code=")), java.nio.charset.StandardCharsets.UTF_8);
        client.get().uri("/api/login/pi22/callback?flow=" + flow + "&code=jnovakova").exchange()
                .expectStatus().isFound().expectHeader().value("Location", value ->
                        assertThat(value).isEqualTo("/login?error=login.expired"));
    }

    @Test
    void redirectsWhenTheIdentityProviderRefusesAnUnknownAccount() {
        client.get().uri("/api/login/pi22").exchange().expectStatus().isFound();
        String flow = jdbc.queryForObject("SELECT id FROM login_flows ORDER BY created_at DESC LIMIT 1", String.class);
        client.get().uri("/api/login/pi22/callback?flow=" + flow + "&code=missing")
                .exchange().expectStatus().isFound()
                .expectHeader().value("Location", value -> assertThat(value).isEqualTo("/login?error=login.unknown"));
    }

    @Test
    void rejectsUnsafeAndExpiredRedirectFlowsAndUnknownProviderCodes() {
        for (String returnTo : new String[] {"//evil.example", "https://evil.example/path", "/login"}) {
            var started = client.get().uri("/api/login/pi22?returnTo=" + returnTo)
                    .exchange().expectStatus().isFound().expectBody().returnResult();
            String provider = started.getResponseHeaders().getLocation().toString();
            String flow = java.net.URLDecoder.decode(provider.substring(provider.indexOf("return=") + 7),
                    java.nio.charset.StandardCharsets.UTF_8);
            Matcher flowMatch = Pattern.compile("flow=([^&]+)").matcher(flow);
            assertThat(flowMatch.find()).isTrue();
            assertThat(jdbc.queryForObject("SELECT return_to FROM login_flows WHERE id=?", String.class,
                    flowMatch.group(1))).isEqualTo("/");
        }
        var started = client.get().uri("/api/login/pi22").exchange().expectStatus().isFound()
                .expectBody().returnResult();
        String provider = started.getResponseHeaders().getLocation().toString();
        String callbackUrl = java.net.URLDecoder.decode(provider.substring(provider.indexOf("return=") + 7),
                java.nio.charset.StandardCharsets.UTF_8);
        Matcher flowMatch = Pattern.compile("flow=([^&]+)").matcher(callbackUrl);
        assertThat(flowMatch.find()).isTrue();
        String flow = flowMatch.group(1);
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON).body("{\"advance\":{\"minutes\":11}}")
                .exchange().expectStatus().isOk();
        client.get().uri("/api/login/pi22/callback?flow=" + flow + "&code=jnovakova").exchange()
                .expectStatus().isFound().expectHeader().value("Location", value ->
                        assertThat(value).isEqualTo("/login?error=login.expired"));
        client.get().uri("/api/login/pi22/callback?flow=missing&code=jnovakova").exchange()
                .expectStatus().isFound().expectHeader().value("Location", value ->
                        assertThat(value).isEqualTo("/login?error=login.expired"));
        client.get().uri("/api/login/pi22/callback?flow=" + flow + "&code=unknown").exchange()
                .expectStatus().isFound().expectHeader().value("Location", value ->
                        assertThat(value).isEqualTo("/login?error=login.expired"));
        var crossStart = client.get().uri("/api/login/pi22").exchange().expectStatus().isFound()
                .expectBody().returnResult();
        String crossCallback = java.net.URLDecoder.decode(crossStart.getResponseHeaders().getLocation().toString()
                .split("return=", 2)[1], java.nio.charset.StandardCharsets.UTF_8);
        String crossFlow = Pattern.compile("flow=([^&]+)").matcher(crossCallback).results()
                .findFirst().orElseThrow().group(1);
        client.get().uri("/api/login/pi41/callback?flow=" + crossFlow + "&code=google-u1").exchange()
                .expectStatus().isFound().expectHeader().value("Location", value ->
                        assertThat(value).isEqualTo("/login?error=login.expired"));
        var unknownStart = client.get().uri("/api/login/pi22").exchange().expectStatus().isFound()
                .expectBody().returnResult();
        String unknownCallback = java.net.URLDecoder.decode(unknownStart.getResponseHeaders().getLocation().toString()
                .split("return=", 2)[1], java.nio.charset.StandardCharsets.UTF_8);
        String unknownFlow = Pattern.compile("flow=([^&]+)").matcher(unknownCallback).results()
                .findFirst().orElseThrow().group(1);
        client.get().uri("/api/login/pi22/callback?flow=" + unknownFlow + "&code=unknown").exchange()
                .expectStatus().isFound().expectHeader().value("Location", value ->
                        assertThat(value).isEqualTo("/login?error=login.unknown"));
    }

    @Test
    void createsFirstLoginWithDefaultRoleAndLinksMatchingVerifiedEmail() {
        var start = client.get().uri("/api/login/pi41").exchange().expectStatus().isFound()
                .expectBody().returnResult();
        String provider = start.getResponseHeaders().getLocation().toString();
        String callbackUrl = java.net.URLDecoder.decode(provider.substring(provider.indexOf("return=") + 7),
                java.nio.charset.StandardCharsets.UTF_8);
        String flow = Pattern.compile("flow=([^&]+)").matcher(callbackUrl).results()
                .findFirst().orElseThrow().group(1);
        client.get().uri("/api/login/pi41/callback?flow=" + flow + "&code=nova.ctenarka@muni.cz").exchange()
                .expectStatus().isFound().expectHeader().value("Location", value -> assertThat(value).isEqualTo("/"));
        String newUser = jdbc.queryForObject("SELECT id FROM users WHERE email='nova.ctenarka@muni.cz'", String.class);
        assertThat(jdbc.queryForObject("SELECT role_id FROM user_mapped_roles WHERE user_id=? AND claim='default role'",
                String.class, newUser)).isEqualTo("reader");
        assertThat(client.get().uri("/_engine/audit").exchange().expectStatus().isOk().expectBody(String.class)
                .returnResult().getResponseBody()).contains("user.created").contains(newUser);

        int before = jdbc.queryForObject("SELECT count(*) FROM users", Integer.class);
        var emailStart = client.get().uri("/api/login/pi41").exchange().expectStatus().isFound()
                .expectBody().returnResult();
        String emailCallback = java.net.URLDecoder.decode(emailStart.getResponseHeaders().getLocation().toString()
                .split("return=", 2)[1], java.nio.charset.StandardCharsets.UTF_8);
        String emailFlow = Pattern.compile("flow=([^&]+)").matcher(emailCallback).results()
                .findFirst().orElseThrow().group(1);
        client.get().uri("/api/login/pi41/callback?flow=" + emailFlow + "&code=google-u1").exchange()
                .expectStatus().isFound();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT user_id FROM user_identities WHERE instance_id='pi41' AND external_id='google-u1'",
                String.class)).isEqualTo("u1");
    }

    @Test
    void replacesMappedRolesWhenTheIdentityMappingChanges() {
        var start = client.get().uri("/api/login/pi22").exchange().expectStatus().isFound()
                .expectBody().returnResult();
        String callback = java.net.URLDecoder.decode(start.getResponseHeaders().getLocation().toString()
                .split("return=", 2)[1], java.nio.charset.StandardCharsets.UTF_8);
        String flow = Pattern.compile("flow=([^&]+)").matcher(callback).results()
                .findFirst().orElseThrow().group(1);
        client.get().uri("/api/login/pi22/callback?flow=" + flow + "&code=jnovakova").exchange()
                .expectStatus().isFound();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_mapped_roles WHERE user_id='u1' AND instance_id='pi22' AND role_id='curator'",
                Integer.class)).isEqualTo(1);
        jdbc.update("UPDATE plugin_instances SET settings=jsonb_set(settings,'{mappings}','[]'::jsonb) WHERE id='pi22'");
        var second = client.get().uri("/api/login/pi22").exchange().expectStatus().isFound()
                .expectBody().returnResult();
        String secondCallback = java.net.URLDecoder.decode(second.getResponseHeaders().getLocation().toString()
                .split("return=", 2)[1], java.nio.charset.StandardCharsets.UTF_8);
        String secondFlow = Pattern.compile("flow=([^&]+)").matcher(secondCallback).results()
                .findFirst().orElseThrow().group(1);
        client.get().uri("/api/login/pi22/callback?flow=" + secondFlow + "&code=jnovakova").exchange()
                .expectStatus().isFound();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_mapped_roles WHERE user_id='u1' AND instance_id='pi22' AND role_id='curator'",
                Integer.class)).isZero();
        assertThat(client.get().uri("/_engine/audit").exchange().expectStatus().isOk().expectBody(String.class)
                .returnResult().getResponseBody()).contains("user.roles_changed").contains("mappedRoleIds");
    }

    @Test
    void firstLoginWithoutADefaultRoleHasNoRolesInItsSession() {
        var start = client.get().uri("/api/login/pi22").exchange().expectStatus().isFound()
                .expectBody().returnResult();
        String callback = java.net.URLDecoder.decode(start.getResponseHeaders().getLocation().toString()
                .split("return=", 2)[1], java.nio.charset.StandardCharsets.UTF_8);
        String flow = Pattern.compile("flow=([^&]+)").matcher(callback).results()
                .findFirst().orElseThrow().group(1);
        var login = client.get().uri("/api/login/pi22/callback?flow=" + flow + "&code=bez.skupiny")
                .exchange().expectStatus().isFound().expectBody().returnResult();
        String cookie = login.getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
        client.get().uri("/api/session").header("Cookie", cookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.roleIds.length()").isEqualTo(0);
    }

    @Test
    void refusesSuspendedPeopleOnRedirectCallback() {
        jdbc.update("UPDATE users SET suspended_at=now() WHERE id='u1'");
        var start = client.get().uri("/api/login/pi22").exchange().expectStatus().isFound()
                .expectBody().returnResult();
        String callback = java.net.URLDecoder.decode(start.getResponseHeaders().getLocation().toString()
                .split("return=", 2)[1], java.nio.charset.StandardCharsets.UTF_8);
        String flow = Pattern.compile("flow=([^&]+)").matcher(callback).results()
                .findFirst().orElseThrow().group(1);
        client.get().uri("/api/login/pi22/callback?flow=" + flow + "&code=jnovakova").exchange()
                .expectStatus().isFound().expectHeader().value("Location", value ->
                        assertThat(value).isEqualTo("/login?error=access.suspended"));
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

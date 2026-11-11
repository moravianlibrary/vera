package cz.mzk.vera.account;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import cz.mzk.vera.session.SessionFilter;
import java.util.Map;
import java.time.OffsetDateTime;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

// B9. Settings belong to the signed-in person and follow them between devices.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class AccountTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService resetService;
    @Autowired
    private AccountCommands commands;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void reset() {
        resetService.reset("base", true);
    }

    @Test
    void accountRequiresSignIn() {
        client.get().uri("/api/session/account").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void settingsGetRequiresSignIn() {
        client.get().uri("/api/session/settings").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void settingsPatchRequiresSignIn() {
        patch("", "{\"appearance\":\"dark\"}").expectStatus().isUnauthorized();
    }

    @Test
    void signedInPersonGetsTheirAccount() {
        client.get().uri("/api/session/account").header(HttpHeaders.COOKIE, session("u3"))
            .exchange().expectStatus().isOk().expectBody().jsonPath("$.id").isEqualTo("u3")
            .jsonPath("$.handRoleIds[0]").isEqualTo("admin");
    }

    @Test
    void settingsStartWithDefault() {
        client.get().uri("/api/session/settings").header(HttpHeaders.COOKIE, session("u3"))
            .exchange().expectStatus().isOk().expectBody().json("{\"lastOpenedWatchlists\":{}}");
    }

    @Test
    void lastOpenedWatchlistsPatchKeepsOtherViews() {
        String cookie = session("u3");
        patch(cookie, "{\"lastOpenedWatchlists\":{\"documents\":\"w1\",\"requests\":\"w2\"}}")
            .expectStatus().isOk();
        patch(cookie, "{\"lastOpenedWatchlists\":{\"documents\":null}}")
            .expectStatus().isOk();
        client.get().uri("/api/session/settings").header(HttpHeaders.COOKIE, cookie).exchange()
            .expectStatus().isOk().expectBody()
            .jsonPath("$.lastOpenedWatchlists.documents").isEqualTo(null)
            .jsonPath("$.lastOpenedWatchlists.requests").isEqualTo("w2");
    }

    @Test
    void fixedOpeningWatchlistsPatchMergesNamedViews() {
        String cookie = session("u3");
        patch(cookie, "{\"fixedOpeningWatchlists\":{\"documents\":\"w1\",\"requests\":\"w2\"}}")
            .expectStatus().isOk();
        patch(cookie, "{\"fixedOpeningWatchlists\":{\"documents\":null}}")
            .expectStatus().isOk();
        client.get().uri("/api/session/settings").header(HttpHeaders.COOKIE, cookie).exchange()
            .expectStatus().isOk().expectBody()
            .jsonPath("$.fixedOpeningWatchlists.documents").isEqualTo(null)
            .jsonPath("$.fixedOpeningWatchlists.requests").isEqualTo("w2");
    }

    @Test
    void notificationDoNotSendDefaultsToFalseWhenNeverSent() {
        var current = json.createObjectNode();
        current.set("lastOpenedWatchlists", json.createObjectNode());
        var change = json.createObjectNode();
        var notificationChange = change.putObject("notifications");
        notificationChange.putObject("hooks");
        var updated = commands.settingsAfter(current, change);
        assertThat(updated.path("notifications").path("doNotSend").booleanValue()).isFalse();
    }

    @Test
    void notificationsHooksPatchKeepsDoNotSendAndOtherHooks() {
        String cookie = session("u3");
        patch(cookie, "{\"notifications\":{\"doNotSend\":true,\"hooks\":{\"h1\":true}}}")
            .expectStatus().isOk();
        patch(cookie, "{\"notifications\":{\"doNotSend\":true,\"hooks\":{\"h2\":false}}}")
            .expectStatus().isOk();
        client.get().uri("/api/session/settings").header(HttpHeaders.COOKIE, cookie).exchange()
            .expectStatus().isOk().expectBody().jsonPath("$.notifications.doNotSend").isEqualTo(true)
            .jsonPath("$.notifications.hooks.h1").isEqualTo(true)
            .jsonPath("$.notifications.hooks.h2").isEqualTo(false);
    }

    @Test
    void notificationChannelOptionsStayWhenLaterPatchOmitsThem() {
        String cookie = session("u3");
        patch(cookie, "{\"notifications\":{\"doNotSend\":false,\"hooks\":{},"
            + "\"channelsOff\":[\"pi22\",\"push\"],\"noHookEmail\":true}}")
            .expectStatus().isOk();
        patch(cookie, "{\"notifications\":{\"doNotSend\":false,"
            + "\"hooks\":{\"h1\":true}}}")
            .expectStatus().isOk();
        client.get().uri("/api/session/settings").header(HttpHeaders.COOKIE, cookie).exchange()
            .expectStatus().isOk().expectBody().jsonPath("$.notifications.channelsOff[0]")
            .isEqualTo("pi22").jsonPath("$.notifications.channelsOff[1]").isEqualTo("push")
            .jsonPath("$.notifications.noHookEmail").isEqualTo(true);
    }

    @Test
    void openSectionsMergeWithinEachBoard() {
        String cookie = session("u3");
        patch(cookie, "{\"openSections\":{\"projects\":{\"p1\":true,\"p2\":false}}}")
            .expectStatus().isOk();
        patch(cookie, "{\"openSections\":{\"projects\":{\"p1\":false},"
            + "\"intentions\":{\"i1\":true}}}")
            .expectStatus().isOk();
        client.get().uri("/api/session/settings").header(HttpHeaders.COOKIE, cookie).exchange()
            .expectStatus().isOk().expectBody().jsonPath("$.openSections.projects.p1").isEqualTo(false)
            .jsonPath("$.openSections.projects.p2").isEqualTo(false)
            .jsonPath("$.openSections.intentions.i1").isEqualTo(true);
    }

    @Test
    void emptyMergedBoardIsDropped() {
        var current = json.createObjectNode();
        current.putObject("openSections").putObject("projects");
        var change = json.createObjectNode();
        change.putObject("openSections").putObject("unknown").put("x", true);
        var updated = commands.settingsAfter(current, change);
        assertThat(updated.path("openSections").has("projects")).isFalse();
        assertThat(updated.path("openSections").has("unknown")).isFalse();
    }

    @Test
    void settingsFollowPersonIntoNewSession() {
        String cookie = session("u3");
        patch(cookie, "{\"appearance\":\"dark\"}").expectStatus().isOk();
        client.get().uri("/api/session/settings").header(HttpHeaders.COOKIE, session("u3"))
            .exchange().expectStatus().isOk().expectBody().jsonPath("$.appearance").isEqualTo("dark");
    }

    @Test
    void publicNotificationTokenChangesPreference() {
        insertHook("h-pref");
        String token = "valid-notification-token";
        jdbc.update("INSERT INTO notification_tokens(token_hash,user_id,hook_id,created_at,expires_at) VALUES (?,?,?,?,?)",
                SessionFilter.hashOf(token), "u3", "h-pref", OffsetDateTime.parse("2026-01-01T00:00:00Z"), OffsetDateTime.parse("2099-01-01T00:00:00Z"));
        client.patch().uri("/api/notification-preferences/{token}", token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"notifications\":{\"doNotSend\":true,\"hooks\":{\"h-pref\":false}}}")
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.notifications.doNotSend").isEqualTo(true)
                .jsonPath("$.notifications.hooks.h-pref").isEqualTo(false);
        client.get().uri("/api/notification-preferences/{token}", token).exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.notifications.hooks.h-pref").isEqualTo(false);
    }

    @Test
    void expiredNotificationTokenIsRefused() {
        insertHook("h-expired");
        String token = "expired-notification-token";
        jdbc.update("INSERT INTO notification_tokens(token_hash,user_id,hook_id,created_at,expires_at) VALUES (?,?,?,?,?)",
                SessionFilter.hashOf(token), "u3", "h-expired", OffsetDateTime.parse("2020-01-01T00:00:00Z"), OffsetDateTime.parse("2020-01-02T00:00:00Z"));
        client.get().uri("/api/notification-preferences/{token}", token).exchange()
                .expectStatus().isNotFound().expectBody().jsonPath("$.code").isEqualTo("notification.link_expired");
    }

    private void insertHook(String id) {
        jdbc.update("INSERT INTO hooks(id,name,events,filter,channel_id,recipient,message,retry,recipient_preference,state,created_by,created_at,position) "
                + "VALUES (?, ?, '[\"request.declined\"]'::jsonb, '', 'pi22', 'u3', '', '{}'::jsonb, '{\"label\":\"Requests\",\"defaultEnabled\":true}'::jsonb, 'active', 'u3', now(), 0)", id, id);
    }

    @Test
    void contractRejectsInvalidSettingsBody() {
        patch(session("u3"), "{\"appearance\":\"sepia\"}").expectStatus().isEqualTo(422);
    }

    private RestTestClient.ResponseSpec patch(String cookie, String body) {
        var request = client.patch().uri("/api/session/settings");
        if (!cookie.isEmpty()) {
            request.header(HttpHeaders.COOKIE, cookie);
        }
        return request.contentType(MediaType.APPLICATION_JSON).body(body).exchange();
    }

    private String session(String userId) {
        String setCookie = client.post().uri("/_engine/sessions")
            .contentType(MediaType.APPLICATION_JSON).body(Map.of("userId", userId))
            .exchange().expectStatus().isOk().expectBody(String.class).returnResult()
            .getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE);
        return setCookie.split(";", 2)[0];
    }
}

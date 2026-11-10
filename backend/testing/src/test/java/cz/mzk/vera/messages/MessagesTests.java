package cz.mzk.vera.messages;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.util.UriComponentsBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

// MSG-handoff; MSG-recipients; MSG-keeps-nothing; MSG-order.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class MessagesTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;

    @Autowired
    private TemplateResetService reset;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void listsEnabledMessageInstancesInConfiguredOrder() {
        client.get().uri("/api/message-channels").header("Cookie", session("u3"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo("pi26")
                .jsonPath("$[0].description").isEqualTo("opens your mail, pre-filled")
                .jsonPath("$[1].id").isEqualTo("pi27")
                .jsonPath("$[1].result").isEqualTo("redirect")
                .jsonPath("$[2].id").isEqualTo("pi44")
                .jsonPath("$[2].result").isEqualTo("sent");
    }

    @Test
    void proposalHandOffResolvesAskersAndInstanceReach() {
        client.get().uri("/api/messages/hand-off?subject=proposal&id=D20")
                .header("Cookie", session("u3")).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.recipients.length()").isEqualTo(4)
                .jsonPath("$.recipients[0].userId").isEqualTo("u6")
                .jsonPath("$.handOffs[0].reachableIds").isEqualTo(List.of("u6", "u5", "u7", "u4"))
                .jsonPath("$.handOffs[1].reachableIds").isEqualTo(List.of("u4"))
                .jsonPath("$.handOffs[2].href").isEmpty();
    }

    @Test
    void slackReachabilityUsesTheConfiguredIdentityClaimAndUpdatesAtLogin() {
        // The seed gives u3 a Slack handle; without its claims u3 cannot be reached on Slack.
        jdbc.update("UPDATE user_identities SET claims = '{}' WHERE user_id = 'u3'");
        String cookie = session("u2");
        client.get().uri("/api/messages/hand-off?subject=project&id=p7").header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.handOffs[1].reachableIds").isEmpty()
                .jsonPath("$.handOffs[2].reachableIds").isEmpty();

        String redirect = client.get().uri("/api/login/pi22?returnTo=/requests")
                .exchange().expectStatus().is3xxRedirection().expectBody(String.class).returnResult()
                .getResponseHeaders().getLocation().toString();
        String callback = UriComponentsBuilder.fromUriString(redirect).build()
                .getQueryParams().getFirst("return");
        callback = URLDecoder.decode(callback, StandardCharsets.UTF_8);
        String flow = UriComponentsBuilder.fromUriString(callback).build()
                .getQueryParams().getFirst("flow");
        assertThat(flow).isNotBlank();
        client.get().uri("/api/login/pi22/callback?flow=" + flow + "&code=pdvorak")
                .exchange().expectStatus().is3xxRedirection()
                .expectHeader().valueEquals(HttpHeaders.LOCATION, "/requests")
                .expectHeader().exists(HttpHeaders.SET_COOKIE);

        assertThat(jdbc.queryForObject("SELECT claims->'slack_id'->>0 FROM user_identities "
                + "WHERE user_id='u3' AND instance_id='pi22'", String.class)).isEqualTo("pdvorak");
        client.get().uri("/api/messages/hand-off?subject=project&id=p7").header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.handOffs[1].reachableIds").isEqualTo(List.of("u3"))
                .jsonPath("$.handOffs[2].reachableIds").isEqualTo(List.of("u3"));
    }

    @Test
    void forbiddenAskersProjectManagerAndListAuthorAreResolved() {
        client.get().uri("/api/messages/hand-off?subject=forbiddenAskers&id=IT6")
                .header("Cookie", session("u3")).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.recipients[0].userId").isEqualTo("u1");
        client.get().uri("/api/messages/hand-off?subject=project&id=p1")
                .header("Cookie", session("u3")).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.recipients[0].userId").isEqualTo("u2");
        client.get().uri("/api/messages/hand-off?subject=listedItem&id=IT1")
                .header("Cookie", session("u8")).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.recipients[0].userId").isEqualTo("u2");
    }

    @Test
    void sendingMessageCallsSlackBotAndWritesItsOutboxRow() {
        client.post().uri("/api/messages/send?subject=proposal&id=D20")
                .header("Cookie", session("u3")).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("channelId", "pi44", "text", "Please help"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.reachedIds").isEqualTo(List.of("u4"));
        client.get().uri("/_engine/outbox?channel=chat").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].recipient").isEqualTo("u4")
                .jsonPath("$[0].payload.text").isEqualTo("Please help");
    }

    @Test
    void unavailableSendingPluginAnswersWithTheGenericServerProblem() {
        jdbc.update("UPDATE plugin_implementations SET versions=jsonb_set(versions, '{0,version}', '"
                + "\"99.0.0\"') WHERE descriptor_id='cz.mzk.vera.slack-bot-message'");
        client.post().uri("/api/messages/send?subject=proposal&id=D20")
                .header("Cookie", session("u3")).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("channelId", "pi44", "text", "Please help"))
                .exchange().expectStatus().isEqualTo(503).expectBody()
                .jsonPath("$.detail").isEqualTo("Message plugin unavailable");
    }

    @Test
    void refusesRedirectsEmptyTextAndUnreachableRecipients() {
        client.post().uri("/api/messages/send?subject=proposal&id=D20")
                .header("Cookie", session("u3")).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("channelId", "pi26", "text", "Please help"))
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.code").isEqualTo("message.not_sending");
        client.post().uri("/api/messages/send?subject=proposal&id=D20")
                .header("Cookie", session("u3")).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("channelId", "pi44", "text", ""))
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.code").isEqualTo("message.text_missing");
        client.post().uri("/api/messages/send?subject=proposal&id=D22")
                .header("Cookie", session("u3")).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("channelId", "pi44", "text", "Please help"))
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.code").isEqualTo("message.unreachable");
    }

    @Test
    void refusesMissingAndUnreachableSubjects() {
        client.get().uri("/api/messages/hand-off")
                .header("Cookie", session("u3")).exchange().expectStatus().isEqualTo(422)
                .expectBody().jsonPath("$.code").isEqualTo("message.subject_missing");
        client.get().uri("/api/messages/hand-off?subject=proposal&id=D31")
                .header("Cookie", session("u4")).exchange().expectStatus().isNotFound()
                .expectBody().jsonPath("$.code").isEqualTo("message.subject_not_found");
        client.post().uri("/api/messages/send?subject=proposal&id=D999")
                .header("Cookie", session("u3")).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("channelId", "pi44", "text", "Please help"))
                .exchange().expectStatus().isNotFound().expectBody()
                .jsonPath("$.code").isEqualTo("message.subject_not_found");
        client.post().uri("/api/messages/send?subject=proposal&id=D20")
                .header("Cookie", session("u3")).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("channelId", "unknown", "text", "Please help"))
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.code").isEqualTo("message.not_sending");
        client.get().uri("/api/messages/hand-off?subject=overrule&id=IT14")
                .header("Cookie", session("u3")).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.recipients").isEmpty();
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }
}

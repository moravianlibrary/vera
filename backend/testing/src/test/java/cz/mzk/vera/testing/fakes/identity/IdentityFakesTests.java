package cz.mzk.vera.testing.fakes.identity;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.plugin.identity.BeginAnswer;
import cz.mzk.vera.plugin.identity.BeginInput;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import cz.mzk.vera.testing.control.FakeProviderPage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
class IdentityFakesTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private PluginCalls calls;

    @Autowired
    private TemplateResetService resetService;

    @Autowired
    private FakeWorld fakeWorld;

    @Autowired
    private FakeProviderPage providerPage;

    @BeforeEach
    void resetSeedAndFakeWorld() {
        resetService.reset("base", true);
    }

    // The provider's page names each account's roles in VERA and redirects back like a provider.
    @Test
    void providerPageShowsRolesAndRedirectsToTheCallback() {
        String callback = "http://localhost/api/login/pi22/callback";
        String page = (String) providerPage.page("pi22", "vera", callback, "openid", "s1").getBody();
        assertThat(page).contains("Jana Nováková", "Petr Dvořák", "VERA: Petr Dvořák", "mzk-curators",
                "Kurátor", "Správce", "action=\"/_engine/identity/pi22/auth\"");

        ResponseEntity<?> chosen = providerPage.choose("pi22", callback, "s1", "jnovakova", null);
        assertThat(chosen.getStatusCode().value()).isEqualTo(302);
        assertThat(chosen.getHeaders().getFirst(HttpHeaders.LOCATION))
                .isEqualTo("/api/login/pi22/callback?code=jnovakova&state=s1");
        assertThat(providerPage.choose("pi22", callback, "s1", null, "access_denied").getHeaders()
                .getFirst(HttpHeaders.LOCATION)).isEqualTo("/api/login/pi22/callback?error=access_denied&state=s1");

        assertThat(providerPage.page("pi22", "vera", "https://elsewhere.example/steal", "openid", "s1")
                .getStatusCode().value()).isEqualTo(400);
        assertThat(providerPage.choose("pi24", callback, "s1", "admin", null).getStatusCode().value())
                .isEqualTo(404);
    }

    @Test
    void oidcFakeStartsCompletesAndRefusesUnknownAccountsAndForms() {
        PluginOutcome<BeginAnswer> begin = calls.call("pi22", Identity.class, "begin",
                (identity, context) -> identity.begin(context, new BeginInput("http://localhost/callback", "state")));
        assertThat(answer(begin).redirect()).isEqualTo("/_engine/identity/pi22/auth?response_type=code"
                + "&client_id=vera&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&scope=openid+email+profile"
                + "&state=state");
        assertThat(answer(begin).flowData()).isEmpty();

        PluginOutcome<CompleteAnswer> completed = calls.call("pi22", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Callback(Map.of("code", "jnovakova"), Map.of(),
                                "http://localhost/callback", "sub")));
        CompleteAnswer account = answer(completed);
        assertThat(account.externalId()).isEqualTo("jnovakova");
        assertThat(account.name()).isEqualTo("Jana Nováková");
        assertThat(account.emailVerified()).isTrue();
        assertThat(account.claims()).containsExactly("group mzk-curators");

        PluginOutcome<CompleteAnswer> slackAccount = calls.call("pi22", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Callback(Map.of("code", "pdvorak"), Map.of(),
                                "http://localhost/callback", "sub")));
        assertThat(answer(slackAccount).claims())
                .containsExactly("group mzk-staff", "slack_id pdvorak");

        PluginOutcome<CompleteAnswer> unknown = calls.call("pi22", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Callback(Map.of("code", "unknown"), Map.of(),
                                "http://localhost/callback", "sub")));
        assertThat(unknown).isEqualTo(new PluginOutcome.Refused<>("wrong_credentials", "wrong_credentials"));

        PluginOutcome<CompleteAnswer> form = calls.call("pi22", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Form("user", "password", "sub")));
        assertThat(form).isEqualTo(new PluginOutcome.Refused<>("not_allowed", "not_allowed"));
    }

    @Test
    void googleFakePreservesEmailCaseAndLocalFakeUsesAFormEntry() {
        PluginOutcome<CompleteAnswer> google = calls.call("pi41", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Callback(Map.of("code", "google-u1"), Map.of(),
                                "http://localhost/callback", "sub")));
        assertThat(answer(google).email()).isEqualTo("JANA.NOVAKOVA@MZK.CZ");

        PluginOutcome<BeginAnswer> localBegin = calls.call("pi24", Identity.class, "begin",
                (identity, context) -> identity.begin(context, new BeginInput(null, null)));
        assertThat(answer(localBegin).redirect()).isNull();
    }

    @Test
    void localFakeRemembersFirstPasswordUntilReset() {
        assertThat(localLogin("first")).isInstanceOf(PluginOutcome.Answered.class);
        assertThat(localLogin("first")).isInstanceOf(PluginOutcome.Answered.class);
        assertThat(localLogin("other"))
                .isEqualTo(new PluginOutcome.Refused<>("wrong_credentials", "wrong_credentials"));

        resetService.reset("base", true);
        assertThat(localLogin("after-reset")).isInstanceOf(PluginOutcome.Answered.class);
    }

    @Test
    void localPasswordsAreScopedByInstanceAndUsername() {
        assertThat(fakeWorld.checkPassword("pi24", "shared-user", "first")).isTrue();
        assertThat(fakeWorld.checkPassword("another-instance", "shared-user", "second")).isTrue();
        assertThat(fakeWorld.checkPassword("pi24", "shared-user", "first")).isTrue();
        assertThat(fakeWorld.checkPassword("pi24", "shared-user", "second")).isFalse();
    }

    private PluginOutcome<CompleteAnswer> localLogin(String password) {
        return calls.call("pi24", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Form("local-test-user", password, null)));
    }

    @SuppressWarnings("unchecked")
    private <A> A answer(PluginOutcome<A> outcome) {
        assertThat(outcome).isInstanceOf(PluginOutcome.Answered.class);
        return (A) ((PluginOutcome.Answered<?>) outcome).answer();
    }
}

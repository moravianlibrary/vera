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

    @BeforeEach
    void resetSeedAndFakeWorld() {
        resetService.reset("base", true);
    }

    @Test
    void oidcFakeStartsCompletesAndRefusesUnknownAccountsAndForms() {
        PluginOutcome<BeginAnswer> begin = calls.call("pi22", Identity.class, "begin",
                (identity, context) -> identity.begin(context, new BeginInput("/requests")));
        assertThat(answer(begin).redirect()).isEqualTo("/_engine/identity/pi22?return=%2Frequests");

        PluginOutcome<CompleteAnswer> completed = calls.call("pi22", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Callback(Map.of("code", "jnovakova"))));
        CompleteAnswer account = answer(completed);
        assertThat(account.externalId()).isEqualTo("jnovakova");
        assertThat(account.name()).isEqualTo("Jana Nováková");
        assertThat(account.emailVerified()).isTrue();
        assertThat(account.claims()).containsExactly("group mzk-curators");

        PluginOutcome<CompleteAnswer> unknown = calls.call("pi22", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Callback(Map.of("code", "unknown"))));
        assertThat(unknown).isEqualTo(new PluginOutcome.Refused<>("wrong_credentials", "wrong_credentials"));

        PluginOutcome<CompleteAnswer> form = calls.call("pi22", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Form("user", "password")));
        assertThat(form).isEqualTo(new PluginOutcome.Refused<>("not_allowed", "not_allowed"));
    }

    @Test
    void googleFakePreservesEmailCaseAndLocalFakeUsesAFormEntry() {
        PluginOutcome<CompleteAnswer> google = calls.call("pi41", Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Callback(Map.of("code", "google-u1"))));
        assertThat(answer(google).email()).isEqualTo("JANA.NOVAKOVA@MZK.CZ");

        PluginOutcome<BeginAnswer> localBegin = calls.call("pi24", Identity.class, "begin",
                (identity, context) -> identity.begin(context, new BeginInput(null)));
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
                        new CompleteInput.Form("local-test-user", password)));
    }

    @SuppressWarnings("unchecked")
    private <A> A answer(PluginOutcome<A> outcome) {
        assertThat(outcome).isInstanceOf(PluginOutcome.Answered.class);
        return (A) ((PluginOutcome.Answered<?>) outcome).answer();
    }
}

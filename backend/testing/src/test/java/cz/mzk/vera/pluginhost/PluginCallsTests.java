package cz.mzk.vera.pluginhost;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginRefused;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import io.micrometer.observation.ObservationRegistry;

@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
class PluginCallsTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private PluginCalls calls;

    @Autowired
    private InstalledPlugins installed;

    @Autowired
    private TemplateResetService resetService;

    @Autowired
    private DSLContext dsl;

    @Autowired
    private PluginHttp http;

    @Autowired
    private Clock clock;

    @Autowired
    private ObservationRegistry observations;

    @BeforeEach
    void resetSeed() {
        resetService.reset("base", true);
    }

    @Test
    void mapsAnswersRefusalsUnavailableFaultsNullsAndTimeouts(CapturedOutput output) {
        assertThat(call("pi22", (kind, context) -> "answer"))
                .isEqualTo(new PluginOutcome.Answered<>("answer"));
        assertThat(call("pi24", (kind, context) -> "answer"))
                .isEqualTo(new PluginOutcome.Answered<>("answer"));

        assertThat(call("pi22", (kind, context) -> {
            throw new TestRefused("denied");
        })).isEqualTo(new PluginOutcome.Refused<>("test_refused", "denied"));
        assertThat(call("pi24", (kind, context) -> {
            throw new TestRefused("denied");
        })).isEqualTo(new PluginOutcome.Refused<>("test_refused", "denied"));

        assertThat(call("pi22", (kind, context) -> {
            throw new PluginUnavailable("offline");
        })).isInstanceOf(PluginOutcome.Unavailable.class);
        assertThat(call("pi24", (kind, context) -> {
            throw new PluginUnavailable("offline");
        })).isInstanceOf(PluginOutcome.Unavailable.class);

        assertThat(call("pi22", (kind, context) -> {
            throw new IllegalStateException("plugin fault");
        })).isInstanceOf(PluginOutcome.Unavailable.class);
        assertThat(call("pi24", (kind, context) -> {
            throw new IllegalStateException("plugin fault");
        })).isInstanceOf(PluginOutcome.Unavailable.class);
        assertThat(output.getOut() + output.getErr())
                .contains("instance=pi22")
                .doesNotContain("kc-3f1d9a7e")
                .doesNotContain("sso.mzk.cz");

        assertThat(call("pi22", (kind, context) -> null))
                .isInstanceOf(PluginOutcome.Unavailable.class);
        assertThat(call("pi24", (kind, context) -> null))
                .isInstanceOf(PluginOutcome.Unavailable.class);

        PluginCalls shortTimeout = new PluginCalls(
                dsl, installed, http, clock, observations, Duration.ofMillis(100));
        assertThat(shortTimeout.call("pi22", Identity.class, "slow", (kind, context) -> {
            try {
                Thread.sleep(1000);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
            return "late";
        })).isInstanceOf(PluginOutcome.Unavailable.class);
        assertThat(shortTimeout.call("pi24", Identity.class, "slow", (kind, context) -> {
            try {
                Thread.sleep(1000);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
            return "late";
        })).isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void refusesUnknownAndDisabledInstances() {
        assertThat(calls.call("missing-instance", Identity.class, "begin", (kind, context) -> "answer"))
                .isInstanceOf(PluginOutcome.Unavailable.class);
        dsl.update(PLUGIN_INSTANCES)
                .set(PLUGIN_INSTANCES.IS_ENABLED, false)
                .where(PLUGIN_INSTANCES.ID.eq("pi22"))
                .execute();
        assertThat(calls.call("pi22", Identity.class, "begin", (kind, context) -> "answer"))
                .isInstanceOf(PluginOutcome.Unavailable.class);
    }

    @Test
    void separatesPi22SecretAndNonSecretConfiguration() {
        PluginOutcome<List<Map<String, String>>> outcome = calls.call("pi22", Identity.class, "inspect",
                (kind, context) -> {
                    assertThat(context.secrets()).containsOnlyKeys("client_secret");
                    assertThat(context.configuration()).containsOnlyKeys("issuer", "client");
                    return List.of(context.secrets(), context.configuration());
                });
        assertThat(outcome).isInstanceOf(PluginOutcome.Answered.class);
    }

    private PluginOutcome<String> call(String instanceId,
            BiFunction<Identity, PluginContext, String> body) {
        return calls.call(instanceId, Identity.class, "test", body);
    }

    private static final class TestRefused extends PluginRefused {
        private static final long serialVersionUID = 1L;

        private TestRefused(String message) {
            super(message);
        }

        @Override
        public String code() {
            return "test_refused";
        }
    }
}

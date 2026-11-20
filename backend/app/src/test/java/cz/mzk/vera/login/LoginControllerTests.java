package cz.mzk.vera.login;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import cz.mzk.vera.login.IdentityInstances.Instance;
import cz.mzk.vera.login.IdentityInstances.Settings;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.identity.BeginAnswer;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.session.SessionCommands;
import cz.mzk.vera.web.PublicUrl;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class LoginControllerTests {
    @Test
    void carriesBeginFlowDataIntoTheProviderCallbackCompletion() {
        LoginQueries queries = mock(LoginQueries.class);
        IdentityInstances instances = mock(IdentityInstances.class);
        LoginCommands commands = mock(LoginCommands.class);
        SessionCommands sessions = mock(SessionCommands.class);
        PluginCalls plugins = mock(PluginCalls.class);
        Instance instance = new Instance("pi22", "MZK", true, "pt20", "redirect",
                JsonMapper.builder().build().nullNode(), new Settings("MZK", 1, "preferred_username",
                        null, false, List.of()));
        Map<String, String> flowData = Map.of("verifier", "pkce-verifier", "nonce", "login-nonce");
        AtomicReference<Map<String, String>> storedFlowData = new AtomicReference<>();
        AtomicReference<CompleteInput> completedInput = new AtomicReference<>();
        Identity identity = new Identity() {
            @Override
            public BeginAnswer begin(PluginContext context, cz.mzk.vera.plugin.identity.BeginInput input) {
                assertThat(input.callback()).isEqualTo(
                        "https://vera.example/api/login/pi22/callback");
                assertThat(input.state()).isEqualTo("state-id");
                return new BeginAnswer("https://provider.example/authorize", flowData);
            }

            @Override
            public CompleteAnswer complete(PluginContext context, CompleteInput input) {
                completedInput.set(input);
                return new CompleteAnswer("person", null, false, "Person", List.of());
            }
        };
        when(instances.find("pi22")).thenReturn(instance);
        when(commands.startFlow("pi22", "/requests")).thenReturn("state-id");
        when(commands.saveFlowData("state-id", flowData)).thenAnswer(invocation -> {
            storedFlowData.set(invocation.getArgument(1));
            return true;
        });
        when(commands.takeFlow("state-id")).thenAnswer(invocation -> Optional.of(new LoginCommands.LoginFlow(
                "state-id", "pi22", "/requests", OffsetDateTime.now(ZoneOffset.UTC), storedFlowData.get())));
        when(commands.expired(any())).thenReturn(false);
        when(commands.logIn(eq(instance), any())).thenReturn(new LoginCommands.Result("u1", null));
        when(sessions.open("u1", "pi22")).thenReturn("session-token");
        when(sessions.cookie("session-token")).thenReturn("vera_session=session-token; Path=/");
        when(plugins.call(eq("pi22"), eq(Identity.class), eq("begin"), any()))
                .thenAnswer(invocation -> new PluginOutcome.Answered<>(invocation.<java.util.function.BiFunction<Identity,
                        PluginContext, BeginAnswer>>getArgument(3).apply(identity, mock(PluginContext.class))));
        when(plugins.call(eq("pi22"), eq(Identity.class), eq("complete"), any()))
                .thenAnswer(invocation -> new PluginOutcome.Answered<>(invocation.<java.util.function.BiFunction<Identity,
                        PluginContext, CompleteAnswer>>getArgument(3).apply(identity, mock(PluginContext.class))));

        LoginController controller = new LoginController(queries, instances, commands, sessions, plugins,
                new PublicUrl("https://vera.example/"));
        var started = controller.loginStart("pi22", "/requests");
        assertThat(started.getHeaders().getLocation().toString()).isEqualTo("https://provider.example/authorize");

        var completed = controller.loginCallback("pi22", Map.of("state", "state-id", "code", "provider-code",
                "iss", "https://provider.example"));
        assertThat(completed.getHeaders().getLocation().toString()).isEqualTo("/requests");
        assertThat(completedInput.get()).isInstanceOf(CompleteInput.Callback.class);
        CompleteInput.Callback callback = (CompleteInput.Callback) completedInput.get();
        assertThat(callback.flowData()).isEqualTo(flowData);
        assertThat(callback.callback()).isEqualTo("https://vera.example/api/login/pi22/callback");
        assertThat(callback.userIdClaim()).isEqualTo("preferred_username");
        assertThat(callback.parameters()).containsEntry("iss", "https://provider.example");
    }
}

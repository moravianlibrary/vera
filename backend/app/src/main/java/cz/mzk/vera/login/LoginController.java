package cz.mzk.vera.login;

import cz.mzk.vera.plugin.identity.BeginAnswer;
import cz.mzk.vera.plugin.identity.BeginInput;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.session.SessionCommands;
import cz.mzk.vera.web.Problems;
import cz.mzk.vera.web.PublicUrl;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// ACCESS-login-page; ACCESS-login-return; E15.
@RestController
@RequestMapping("/api/login")
final class LoginController {
    private final LoginQueries queries;
    private final IdentityInstances instances;
    private final LoginCommands commands;
    private final SessionCommands sessions;
    private final PluginCalls plugins;
    private final PublicUrl publicUrl;

    LoginController(LoginQueries queries, IdentityInstances instances, LoginCommands commands,
            SessionCommands sessions, PluginCalls plugins, PublicUrl publicUrl) {
        this.queries = queries;
        this.instances = instances;
        this.commands = commands;
        this.sessions = sessions;
        this.plugins = plugins;
        this.publicUrl = publicUrl;
    }

    @GetMapping
    List<LoginQueries.LoginEntry> loginEntries() {
        return queries.loginEntries();
    }

    @PostMapping("/{instanceId}")
    ResponseEntity<?> loginForm(@PathVariable String instanceId, @RequestBody FormRequest body) {
        IdentityInstances.Instance instance = instances.find(instanceId);
        if (instance == null || !instance.entry().equals("form")) {
            return Problems.response(404, "There is no local login for this instance.");
        }
        var person = queries.localPerson(instanceId, body.username());
        if (person.isEmpty()) {
            return Problems.response(401, "The username or password is not accepted.");
        }
        PluginOutcome<CompleteAnswer> outcome = plugins.call(instanceId, Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Form(body.username(), body.password(), instance.settings().userIdClaim())));
        if (outcome instanceof PluginOutcome.Refused<CompleteAnswer> refused) {
            if ("wrong_credentials".equals(refused.code())) {
                return Problems.response(401, "The username or password is not accepted.");
            }
            return Problems.response(503, "The login service did not answer.");
        }
        if (!(outcome instanceof PluginOutcome.Answered<CompleteAnswer> answered)) {
            return Problems.response(503, "The login service did not answer.");
        }
        CompleteAnswer pluginAnswer = answered.answer();
        CompleteAnswer answer = new CompleteAnswer(pluginAnswer.externalId(), person.get().email(), false,
                person.get().name(), pluginAnswer.claims());
        LoginCommands.Result result = commands.logIn(instance, answer);
        if (result.refusal() != null) {
            return Problems.response(403, "This person is suspended.", "access.suspended", null);
        }
        String token = sessions.open(result.userId(), instanceId);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, sessions.cookie(token)).build();
    }

    @GetMapping("/{instanceId}")
    ResponseEntity<?> loginStart(@PathVariable String instanceId,
            @RequestParam(name = "returnTo", required = false) String returnTo) {
        IdentityInstances.Instance instance = instances.find(instanceId);
        if (instance == null || !instance.entry().equals("redirect")) {
            return Problems.response(404, "There is no redirect login for this instance.");
        }
        String flowId = commands.startFlow(instanceId, returnTo);
        String callback = publicUrl.value().replaceAll("/$", "") + "/api/login/" + instanceId + "/callback";
        PluginOutcome<BeginAnswer> outcome = plugins.call(instanceId, Identity.class, "begin",
                (identity, context) -> identity.begin(context, new BeginInput(callback, flowId)));
        if (!(outcome instanceof PluginOutcome.Answered<BeginAnswer> answer)
                || answer.answer().redirect() == null) {
            return ResponseEntity.status(302).header(HttpHeaders.LOCATION, "/login?error=login.unknown").build();
        }
        Map<String, String> flowData = answer.answer().flowData() == null ? Map.of() : answer.answer().flowData();
        if (!commands.saveFlowData(flowId, flowData)) {
            return ResponseEntity.status(302).header(HttpHeaders.LOCATION, "/login?error=login.unknown").build();
        }
        return ResponseEntity.status(302).header(HttpHeaders.LOCATION, answer.answer().redirect()).build();
    }

    @GetMapping("/{instanceId}/callback")
    ResponseEntity<Void> loginCallback(@PathVariable String instanceId, @RequestParam Map<String, String> parameters) {
        String state = parameters.get("state");
        var flowRow = commands.takeFlow(state);
        if (flowRow.isEmpty() || !instanceId.equals(flowRow.get().instanceId()) || commands.expired(flowRow.get())) {
            return redirect("/login?error=login.expired", null);
        }
        IdentityInstances.Instance instance = instances.find(instanceId);
        if (instance == null || !instance.entry().equals("redirect")) {
            return redirect("/login?error=login.expired", null);
        }
        if (parameters.containsKey("error")) {
            return redirect("/login?error=login.refused", null);
        }
        String callback = publicUrl.value().replaceAll("/$", "") + "/api/login/" + instanceId + "/callback";
        PluginOutcome<CompleteAnswer> outcome = plugins.call(instanceId, Identity.class, "complete",
                (identity, context) -> identity.complete(context,
                        new CompleteInput.Callback(parameters, flowRow.get().flowData(), callback,
                                instance.settings().userIdClaim())));
        if (!(outcome instanceof PluginOutcome.Answered<CompleteAnswer> answered)) {
            return redirect("/login?error=login.unknown", null);
        }
        LoginCommands.Result result = commands.logIn(instance, answered.answer());
        if (result.refusal() != null) {
            return redirect("/login?error=access.suspended", null);
        }
        String token = sessions.open(result.userId(), instanceId);
        return redirect(flowRow.get().returnTo(), sessions.cookie(token));
    }

    private ResponseEntity<Void> redirect(String location, String cookie) {
        ResponseEntity.BodyBuilder response = ResponseEntity.status(302).header(HttpHeaders.LOCATION, location);
        if (cookie != null) {
            response.header(HttpHeaders.SET_COOKIE, cookie);
        }
        return response.build();
    }

    public record FormRequest(String username, String password) {}
}

package cz.mzk.vera.testing.fakes.identity;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PasswordCheck;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.identity.BeginAnswer;
import cz.mzk.vera.plugin.identity.BeginInput;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.plugin.identity.IdentityRefusal;
import cz.mzk.vera.plugin.identity.IdentityRefused;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

// E15; fakes.md Identity.
public final class FakeLocalAccounts implements Identity {
    @Override
    public BeginAnswer begin(PluginContext context, BeginInput input) {
        return new BeginAnswer(null);
    }

    @Override
    public CompleteAnswer complete(PluginContext context, CompleteInput input) {
        if (!(input instanceof CompleteInput.Form form)) {
            throw new IdentityRefused(IdentityRefusal.NOT_ALLOWED);
        }
        PasswordCheck check = context.localPasswords().check(form.username(), form.password());
        if (check == PasswordCheck.MATCHES) {
            return new CompleteAnswer(form.username(), null, false, form.username(), List.of());
        }
        if (check == PasswordCheck.DIFFERS) {
            throw new IdentityRefused(IdentityRefusal.WRONG_CREDENTIALS);
        }
        String body = "username=" + encode(form.username()) + "&password=" + encode(form.password());
        URI uri = URI.create("https://local-accounts.fake/" + context.instanceId() + "/check");
        PluginHttp.Request request = new PluginHttp.Request("POST", uri,
                Map.of("content-type", List.of("application/x-www-form-urlencoded")),
                body.getBytes(StandardCharsets.UTF_8));
        PluginHttp.Response response = context.http().send(request);
        if (response.status() == 401) {
            throw new IdentityRefused(IdentityRefusal.WRONG_CREDENTIALS);
        }
        if (response.status() != 204) {
            throw new PluginUnavailable("Local account check did not answer.");
        }
        return new CompleteAnswer(form.username(), null, false, form.username(), List.of());
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}

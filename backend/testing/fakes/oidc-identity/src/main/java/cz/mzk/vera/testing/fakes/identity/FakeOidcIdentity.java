package cz.mzk.vera.testing.fakes.identity;

import cz.mzk.vera.plugin.PluginContext;
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
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// E15; fakes.md Identity.
public final class FakeOidcIdentity implements Identity {
    @Override
    public BeginAnswer begin(PluginContext context, BeginInput input) {
        String callback = URLEncoder.encode(input.callback(), StandardCharsets.UTF_8);
        String state = URLEncoder.encode(input.state(), StandardCharsets.UTF_8);
        return new BeginAnswer("/_engine/identity/" + context.instanceId() + "?callback=" + callback
                + "&state=" + state, Map.of());
    }

    @Override
    public CompleteAnswer complete(PluginContext context, CompleteInput input) {
        if (!(input instanceof CompleteInput.Callback callback)) {
            throw new IdentityRefused(IdentityRefusal.NOT_ALLOWED);
        }
        String code = callback.parameters().get("code");
        String issuer = context.configuration().get("issuer");
        String normalized = issuer.startsWith("https://") ? issuer : "https://" + issuer;
        URI uri = URI.create(normalized.replaceAll("/$", "") + "/token");
        String form = "code=" + URLEncoder.encode(code == null ? "" : code, StandardCharsets.UTF_8);
        PluginHttp.Request request = new PluginHttp.Request("POST", uri,
                Map.of("content-type", List.of("application/x-www-form-urlencoded")),
                form.getBytes(StandardCharsets.UTF_8));
        PluginHttp.Response response = context.http().send(request);
        if (response.status() == 400) {
            throw new IdentityRefused(IdentityRefusal.WRONG_CREDENTIALS);
        }
        if (response.status() < 200 || response.status() >= 300) {
            throw new PluginUnavailable("Provider did not answer.");
        }

        Map<String, List<String>> values = parseForm(new String(response.body(), StandardCharsets.UTF_8));
        String email = values.containsKey("email") ? first(values, "email") : null;
        return new CompleteAnswer(first(values, "external_id"), email,
                Boolean.parseBoolean(first(values, "email_verified")), first(values, "name"),
                values.getOrDefault("claim", List.of()));
    }

    private Map<String, List<String>> parseForm(String input) {
        Map<String, List<String>> values = new HashMap<>();
        for (String pair : input.split("&")) {
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            String value = parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
            values.computeIfAbsent(key, unused -> new ArrayList<>()).add(value);
        }
        return values;
    }

    private String first(Map<String, List<String>> values, String key) {
        List<String> found = values.get(key);
        if (found == null || found.isEmpty()) {
            throw new PluginUnavailable("Provider answer was invalid.");
        }
        return found.getFirst();
    }
}

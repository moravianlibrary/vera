package cz.mzk.vera.testing.fakes.identity;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

// BK2a; PLG-api-call. Seed-backed outside identity providers for the test profile.
@Component
@Profile("test")
public class FakeWorld {
    private volatile Map<String, JsonNode> accounts = Map.of();
    private volatile Map<String, String> issuerInstances = Map.of();
    private final Map<String, String> passwords = new ConcurrentHashMap<>();

    public synchronized void reset(JsonNode seed) {
        Map<String, JsonNode> nextAccounts = new java.util.LinkedHashMap<>();
        seed.path("fakes").path("identityAccounts").properties().forEach(entry -> {
            for (JsonNode account : entry.getValue()) {
                String key = accountKey(entry.getKey(), account.path("externalId").asString());
                nextAccounts.put(key, account.deepCopy());
            }
        });

        Map<String, String> nextIssuers = new HashMap<>();
        for (JsonNode instance : seed.path("collections").path("pluginInstances")) {
            JsonNode issuer = instance.path("configuration").get("issuer");
            if (issuer == null || issuer.isNull()) {
                continue;
            }
            try {
                String configured = issuer.asString();
                URI uri = URI.create(configured.contains("://") ? configured : "https://" + configured);
                nextIssuers.put(uri.getHost(), instance.path("id").asString());
            } catch (IllegalArgumentException ignored) {
                // Malformed seed values have no provider route.
            }
        }

        accounts = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(nextAccounts));
        issuerInstances = Map.copyOf(nextIssuers);
        passwords.clear();
    }

    public JsonNode accountForIssuer(String host, String code) {
        String instance = issuerInstances.get(host);
        if (instance == null) {
            return null;
        }
        return accounts.get(accountKey(instance, code));
    }

    public Map<String, JsonNode> accountsForInstance(String instanceId) {
        String prefix = instanceId + "\u0000";
        Map<String, JsonNode> result = new java.util.LinkedHashMap<>();
        accounts.forEach((key, account) -> {
            if (key.startsWith(prefix)) result.put(key.substring(prefix.length()), account.deepCopy());
        });
        return java.util.Collections.unmodifiableMap(result);
    }

    public boolean checkPassword(String instanceId, String username, String password) {
        String accepted = passwords.putIfAbsent(accountKey(instanceId, username), password);
        return accepted == null || accepted.equals(password);
    }

    private String accountKey(String instanceId, String id) {
        return instanceId + "\u0000" + id;
    }
}

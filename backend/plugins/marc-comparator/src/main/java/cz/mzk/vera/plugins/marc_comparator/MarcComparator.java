package cz.mzk.vera.plugins.marc_comparator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.validation.Validation;
import cz.mzk.vera.plugin.validation.ValidationCheckAnswer;
import cz.mzk.vera.plugin.validation.ValidationCheckInput;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// PLG-api-kinds: Validation.
public final class MarcComparator implements Validation {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String DEFAULT_CATALOG_ID = "MZK01-000067431";
    private static final String DEFAULT_BASE = "MZK01";
    private static final String DEFAULT_SYSTEM_NUMBER = "000067431";
    private final ThreadLocal<String> loginCookie = new ThreadLocal<>();

    @Override
    public ValidationCheckAnswer check(PluginContext context, ValidationCheckInput input) {
        try {
            String token = login(context);
            CatalogKey key = catalogKey(input.record(), context);
            JsonNode fetched = post(context, "/catalog-records/fetch",
                    Map.of("base", key.base(), "system_number", key.systemNumber()), token);
            await(context, taskId(fetched), token);
            String recordId = key.base() + "-" + key.systemNumber();
            JsonNode processed = post(context, "/catalog-records/process",
                    Map.of("record_ids", List.of(recordId)), token);
            await(context, taskId(processed), token);
            JsonNode comparisons = get(context, "/catalog-records/" + path(key.base()) + "/"
                    + path(key.systemNumber()) + "/comparisons", token);
            JsonNode validations = get(context, "/catalog-records/" + path(key.base()) + "/"
                    + path(key.systemNumber()) + "/validations", token);
            List<ValidationCheckAnswer.Defect> defects = new ArrayList<>();
            String poorBelow = context.configuration().getOrDefault("poor_below", "Poor");
            if (comparisons.isArray()) for (JsonNode comparison : comparisons) {
                JsonNode result = comparison.path("result");
                if (atOrBelowPoorBand(result.path("quality").asText(), poorBelow)) {
                    String base = comparison.path("base").asText("unknown");
                    defects.add(new ValidationCheckAnswer.Defect("match-poor", base, comparisonDetail(result)));
                }
            }
            if (validations.isArray()) for (JsonNode validation : validations) {
                JsonNode result = validation.path("result");
                if (!"Valid".equals(result.path("status").asText())) {
                    String name = validation.path("validator").asText();
                    // Unknown service validators still map to defects; the service can add validators independently of VERA releases.
                    defects.add(new ValidationCheckAnswer.Defect("validator:" + name,
                            target(result.path("target")), validationDetail(result)));
                }
            }
            return new ValidationCheckAnswer(List.copyOf(defects));
        } catch (PluginUnavailable unavailable) {
            throw unavailable;
        } catch (RuntimeException failure) {
            throw new PluginUnavailable("marc-comparator request failed.", failure);
        }
    }

    private String login(PluginContext context) {
        JsonNode response = send(context, "POST", "/auth/login", Map.of(
                "email", required(context.configuration().get("email"), "email"),
                "password", required(context.secrets().get("password"), "password")), null);
        String token = responseHeader(response, "set-cookie");
        loginCookie.remove();
        // Login's access_token is an HttpOnly cookie; no bearer token appears in its JSON body.
        if (token == null) throw new PluginUnavailable("marc-comparator login did not return an access cookie.");
        String access = token.split(";", 2)[0];
        if (!access.startsWith("access_token=")) throw new PluginUnavailable("marc-comparator login was refused.");
        return access;
    }

    private String responseHeader(JsonNode ignored, String name) {
        return loginCookie.get();
    }

    private void await(PluginContext context, String id, String token) {
        Duration wait = duration(context.configuration().getOrDefault("wait", "10m"));
        Duration poll = duration(context.configuration().getOrDefault("poll", "5s"));
        Instant deadline = context.clock().instant().plus(wait);
        while (context.clock().instant().isBefore(deadline)) {
            JsonNode result = post(context, "/tasks/search-own", Map.of("filters", Map.of("task_id", List.of(id))), token);
            JsonNode items = result.path("items");
            if (items.isArray() && !items.isEmpty()) {
                String status = items.get(0).path("status").asText();
                if ("Success".equals(status)) return;
                if ("Failure".equals(status) || "Revoked".equals(status)) {
                    throw new PluginUnavailable("marc-comparator task failed.");
                }
            }
            try {
                Thread.sleep(Math.min(poll.toMillis(), Math.max(1, Duration.between(context.clock().instant(), deadline).toMillis())));
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new PluginUnavailable("marc-comparator task wait interrupted.", interrupted);
            }
        }
        throw new PluginUnavailable("marc-comparator task timed out.");
    }

    private String taskId(JsonNode task) {
        String id = task.path("task_id").asText();
        if (id.isBlank()) throw new PluginUnavailable("marc-comparator did not return a task id.");
        return id;
    }

    private JsonNode post(PluginContext context, String path, Object body, String token) {
        return send(context, "POST", path, body, token);
    }

    private JsonNode get(PluginContext context, String path, String token) {
        return send(context, "GET", path, null, token);
    }

    private JsonNode send(PluginContext context, String method, String path, Object body, String token) {
        String base = required(context.configuration().get("api_url"), "api_url").replaceAll("/+$", "");
        Map<String, List<String>> headers = new HashMap<>();
        headers.put("Accept", List.of("application/json"));
        if (body != null) headers.put("Content-Type", List.of("application/json"));
        if (token != null) headers.put("Cookie", List.of(token));
        byte[] bytes;
        try { bytes = body == null ? new byte[0] : JSON.writeValueAsBytes(body); }
        catch (IOException error) { throw new PluginUnavailable("Could not encode marc-comparator request.", error); }
        PluginHttp.Response response = context.http().send(new PluginHttp.Request(method,
                URI.create(base + path), headers, bytes));
        if (response.status() < 200 || response.status() >= 300) {
            throw new PluginUnavailable("marc-comparator returned HTTP " + response.status() + ".");
        }
        if (method.equals("POST") && path.equals("/auth/login")) {
            loginCookie.set(response.headers().entrySet().stream().filter(e -> e.getKey().equalsIgnoreCase("set-cookie"))
                    .flatMap(e -> e.getValue().stream()).filter(v -> v.startsWith("access_token=")).findFirst().orElse(null));
        }
        try { return response.body().length == 0 ? JSON.createObjectNode() : JSON.readTree(response.body()); }
        catch (IOException error) { throw new PluginUnavailable("marc-comparator returned malformed JSON.", error); }
    }

    private CatalogKey catalogKey(Document record, PluginContext context) {
        String catalogId = record.catalogId();
        String mappings = context.configuration().get("base_map");
        if (mappings != null) for (String entry : mappings.split(";")) {
            String[] pair = entry.trim().split("=", 2);
            if (pair.length == 2 && pair[0].equals(catalogId)) {
                String[] parts = pair[1].split("[:,/]", 2);
                if (parts.length == 2) return new CatalogKey(parts[0], parts[1]);
            }
        }
        if (DEFAULT_CATALOG_ID.equals(catalogId)) return new CatalogKey(DEFAULT_BASE, DEFAULT_SYSTEM_NUMBER);
        if (catalogId != null && catalogId.contains("-")) {
            int split = catalogId.indexOf('-');
            return new CatalogKey(catalogId.substring(0, split), catalogId.substring(split + 1));
        }
        throw new PluginUnavailable("No marc-comparator base mapping for this catalog record.");
    }

    private String comparisonDetail(JsonNode result) {
        String score = result.path("overall_score").asText("?") + "/" + result.path("scale").asText("match15");
        List<JsonNode> fields = new ArrayList<>();
        JsonNode values = result.path("field_results");
        if (values.isArray()) values.forEach(fields::add);
        fields.sort(Comparator.comparingDouble(value -> value.path("score").asDouble()));
        StringBuilder detail = new StringBuilder("Score ").append(score).append("; ");
        for (JsonNode field : fields.stream().limit(3).toList()) {
            String entry = field.path("tag").asText() + ": \"" + field.path("value_a").asText("")
                    + "\" ≠ \"" + field.path("value_b").asText("") + "\"; ";
            if (detail.length() + entry.length() > 397) break;
            detail.append(entry);
        }
        return detail.substring(0, Math.min(400, detail.length())).trim();
    }

    private boolean atOrBelowPoorBand(String quality, String threshold) {
        int qualityRank = qualityRank(quality);
        int thresholdRank = qualityRank(threshold);
        return qualityRank >= 0 && thresholdRank >= 0 && qualityRank <= thresholdRank;
    }

    private int qualityRank(String quality) {
        return switch (quality) {
            case "Poor" -> 0;
            case "Moderate" -> 1;
            case "Excellent" -> 2;
            default -> -1;
        };
    }

    private String target(JsonNode target) {
        String tag = target.path("tag").asText("");
        JsonNode codes = target.path("codes");
        if (codes.isArray() && !codes.isEmpty()) tag += "$" + codes.get(0).asText();
        return tag;
    }

    private String validationDetail(JsonNode result) {
        StringBuilder detail = new StringBuilder(result.path("reason").asText("Validation failed"));
        JsonNode params = result.path("params");
        if (params.isObject() && params.size() > 0) detail.append(" ").append(params);
        return detail.toString();
    }

    private String path(String value) { return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private String required(String value, String key) {
        if (value == null || value.isBlank()) throw new PluginUnavailable("Missing marc-comparator configuration: " + key);
        return value;
    }
    private Duration duration(String value) {
        try { return value.endsWith("ms") ? Duration.ofMillis(Long.parseLong(value.substring(0, value.length() - 2)))
                : value.endsWith("m") ? Duration.ofMinutes(Long.parseLong(value.substring(0, value.length() - 1)))
                : value.endsWith("s") ? Duration.ofSeconds(Long.parseLong(value.substring(0, value.length() - 1)))
                : Duration.ofMillis(Long.parseLong(value.substring(0, value.length() - 2))); }
        catch (RuntimeException invalid) { throw new PluginUnavailable("Invalid marc-comparator duration.", invalid); }
    }
    private record CatalogKey(String base, String systemNumber) {}
}

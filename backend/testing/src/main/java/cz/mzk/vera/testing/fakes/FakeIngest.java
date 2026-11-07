package cz.mzk.vera.testing.fakes;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

// PLG-api-kinds; PLG-api-outcome; fakes.md Registry, Property source, Validation, Restriction.
@Component
@Profile("test")
public class FakeIngest {
    private volatile Map<String, JsonNode> documents = Map.of();
    private volatile Map<String, JsonNode> iterations = Map.of();
    private volatile Map<String, JsonNode> ingest = Map.of();
    private volatile Map<String, List<String>> repairs = Map.of();
    private volatile Map<String, String> registryImplementations = Map.of();
    private volatile Map<String, Long> instanceTimeouts = Map.of();

    public synchronized void reset(JsonNode seed) {
        Map<String, JsonNode> nextDocuments = new LinkedHashMap<>();
        for (JsonNode document : seed.path("collections").path("documents")) {
            nextDocuments.put(document.path("catalogId").asString(), document.deepCopy());
        }
        documents = Map.copyOf(nextDocuments);

        Map<String, String> nextRegistryImplementations = new LinkedHashMap<>();
        for (JsonNode implementation : seed.path("collections").path("pluginImplementations")) {
            if ("Registry".equals(implementation.path("kind").asString())) {
                nextRegistryImplementations.put(implementation.path("id").asString(),
                        implementation.path("name").asString());
            }
        }
        Map<String, String> nextRegistries = new LinkedHashMap<>();
        for (JsonNode instance : seed.path("collections").path("pluginInstances")) {
            String implementationName = nextRegistryImplementations.get(instance.path("implementationId").asString());
            if (implementationName != null) {
                nextRegistries.put(instance.path("id").asString(), implementationName);
            }
        }
        registryImplementations = Map.copyOf(nextRegistries);

        Map<String, Long> nextTimeouts = new LinkedHashMap<>();
        for (JsonNode instance : seed.path("collections").path("pluginInstances")) {
            JsonNode timeout = instance.path("configuration").path("timeout");
            if (timeout.isMissingNode() || timeout.isNull()) {
                timeout = instance.path("settings").path("timeout");
            }
            if (!timeout.isMissingNode() && !timeout.isNull()) {
                nextTimeouts.put(instance.path("id").asString(), timeoutMillis(timeout.asString()));
            }
        }
        instanceTimeouts = Map.copyOf(nextTimeouts);

        Map<String, JsonNode> nextIterations = new LinkedHashMap<>();
        for (JsonNode iteration : seed.path("collections").path("iterations")) {
            String documentId = iteration.path("documentId").asString();
            JsonNode previous = nextIterations.get(documentId);
            if (previous == null || iteration.path("attempt").asInt() > previous.path("attempt").asInt()) {
                nextIterations.put(documentId, iteration.deepCopy());
            }
        }
        iterations = Map.copyOf(nextIterations);

        Map<String, JsonNode> nextIngest = new LinkedHashMap<>();
        seed.path("fakes").path("ingest").properties().forEach(entry -> {
            nextIngest.put(entry.getKey(), entry.getValue().deepCopy());
        });
        ingest = Map.copyOf(nextIngest);
        Map<String, List<String>> nextRepairs = new LinkedHashMap<>();
        seed.path("fakes").path("catalogRepairs").properties().forEach(entry -> {
            nextRepairs.put(entry.getKey(), strings(entry.getValue()));
        });
        repairs = Map.copyOf(nextRepairs);
    }

    public Map<String, List<String>> answer(String kind, String catalogId, String instanceId,
            List<String> identifiers) {
        JsonNode document = documents.get(catalogId);
        JsonNode iteration = document == null ? null : iterations.get(document.path("id").asString());
        JsonNode custom = ingest.get(catalogId);
        String fault = custom == null ? null : custom.path("faults").path(faultKey(kind)).asString(null);
        if ("unavailable".equals(fault)) {
            return response("httpStatus", "503");
        }
        if ("timeout".equals(fault)) {
            try {
                Thread.sleep(instanceTimeouts.getOrDefault(instanceId, Duration.ofSeconds(10).toMillis()) + 25);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                return response("interrupted", "true");
            }
        }
        if ("malformed".equals(fault)) {
            return response("malformed", "true");
        }
        if ("Registry".equals(kind)) {
            return registry(document, custom, instanceId, identifiers, document == null);
        }
        if ("PropertySource".equals(kind)) {
            return properties(iteration, custom, instanceId);
        }
        if ("Validation".equals(kind)) {
            return validation(iteration, custom, instanceId, catalogId);
        }
        return restriction(iteration, custom);
    }

    private Map<String, List<String>> registry(JsonNode document, JsonNode custom, String instanceId,
            List<String> identifiers, boolean ingestRecord) {
        Map<String, List<String>> result = fields();
        JsonNode records = document == null ? custom == null ? null : custom.path("registryRecords")
                : document.path("registryRecords");
        if (records != null && records.isArray()) {
            for (JsonNode record : records) {
                String instance = record.path("instanceId").asString(null);
                String registry = record.path("registry").asString(null);
                boolean identifierMatches = !ingestRecord || !record.has("identifiers")
                        || record.path("identifiers").valueStream().map(JsonNode::asString)
                                .anyMatch(identifiers::contains);
                if (identifierMatches
                        && (instanceId.equals(instance) || registryMatches(instanceId, registry))) {
                    String linkField = ingestRecord ? "link" : "url";
                    add(result, "recordRawState", record.path("rawState").asString(""));
                    add(result, "recordLink", nullable(record.path(linkField)));
                }
            }
        }
        return result;
    }

    private Map<String, List<String>> properties(JsonNode iteration, JsonNode custom, String instanceId) {
        Map<String, List<String>> result = fields();
        JsonNode values = iteration == null ? custom == null ? null : custom.path("properties")
                : iteration.path("properties");
        if (values == null || !values.isArray()) {
            return result;
        }
        for (JsonNode property : values) {
            JsonNode sources = property.has("sources") ? property.path("sources") : null;
            if (sources != null && sources.isArray()) {
                for (JsonNode source : sources) {
                    if (instanceId.equals(source.path("source").path("instanceId").asString())) {
                        add(result, "propertyKey", property.path("key").asString());
                        add(result, "propertyTier", source.path("tier").asString());
                        add(result, "propertyValue", source.path("value").toString());
                    }
                }
            } else if (instanceId.equals(property.path("instanceId").asString())) {
                add(result, "propertyKey", property.path("key").asString());
                add(result, "propertyTier", property.path("tier").asString());
                add(result, "propertyValue", property.path("value").toString());
            }
        }
        return result;
    }

    private Map<String, List<String>> validation(JsonNode iteration, JsonNode custom, String instanceId,
            String catalogId) {
        Map<String, List<String>> result = fields();
        JsonNode defects = iteration == null ? custom == null ? null : custom.path("defects")
                : iteration.path("defects");
        List<String> repaired = repairs.getOrDefault(catalogId, List.of());
        if (defects != null && defects.isArray()) {
            for (JsonNode defect : defects) {
                if (instanceId.equals(defect.path("instanceId").asString())
                        && !repaired.contains(defect.path("subject").asString())) {
                    String rule = defect.path("rule").asString(defect.path("ruleCode").asString());
                    String field = defect.path("field").asString(defect.path("subject").asString());
                    String detail = defect.path("detail").asString(defect.path("internalText").asString());
                    add(result, "defectRule", rule);
                    add(result, "defectField", field);
                    add(result, "defectDetail", detail);
                }
            }
        }
        return result;
    }

    private Map<String, List<String>> restriction(JsonNode iteration, JsonNode custom) {
        Map<String, List<String>> result = fields();
        JsonNode restriction = iteration == null ? custom == null ? null : custom.path("restriction")
                : iteration.path("restriction");
        if (restriction != null && !restriction.isNull()) {
            add(result, "findingRule", restriction.path("rule").asString());
            add(result, "findingForbidden", "true");
            add(result, "findingUntil", nullable(restriction.path("until")));
            add(result, "findingWhy",
                    restriction.path("why").asString(restriction.path("internalText").asString()));
        }
        return result;
    }

    private String faultKey(String kind) {
        return switch (kind) {
            case "Registry" -> "registry";
            case "PropertySource" -> "propertySource";
            case "Validation" -> "validation";
            default -> "restriction";
        };
    }

    private boolean registryMatches(String instanceId, String registry) {
        String implementation = registryImplementations.get(instanceId);
        if (registry == null || implementation == null) {
            return false;
        }
        String name = implementation.endsWith("Registry")
                ? implementation.substring(0, implementation.length() - "Registry".length()) : implementation;
        return name.equalsIgnoreCase(registry);
    }

    private List<String> strings(JsonNode values) {
        List<String> result = new ArrayList<>();
        for (JsonNode value : values) {
            result.add(value.asString());
        }
        return List.copyOf(result);
    }

    private long timeoutMillis(String value) {
        if (value.endsWith("ms")) {
            return Long.parseLong(value.substring(0, value.length() - 2));
        }
        if (value.endsWith("s")) {
            return Duration.ofSeconds(Long.parseLong(value.substring(0, value.length() - 1))).toMillis();
        }
        if (value.endsWith("m")) {
            return Duration.ofMinutes(Long.parseLong(value.substring(0, value.length() - 1))).toMillis();
        }
        return Long.parseLong(value);
    }

    private String nullable(JsonNode value) {
        return value == null || value.isNull() || value.isMissingNode() ? "" : value.asString();
    }

    private Map<String, List<String>> fields() {
        return new LinkedHashMap<>();
    }

    private Map<String, List<String>> response(String key, String value) {
        Map<String, List<String>> result = fields();
        add(result, key, value);
        return result;
    }

    private void add(Map<String, List<String>> result, String key, String value) {
        result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
    }
}

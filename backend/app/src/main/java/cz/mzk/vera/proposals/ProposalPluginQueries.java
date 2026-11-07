package cz.mzk.vera.proposals;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-api-capabilities; ACT-ways-in: read enabled instances and their declared operations.
@Repository
public class ProposalPluginQueries {
    private final DSLContext dsl;
    private final JsonMapper mapper;
    public ProposalPluginQueries(DSLContext dsl, JsonMapper mapper) {
        this.dsl = dsl;
        this.mapper = mapper;
    }

    public boolean hasEnabledInput(String operation) {
        List<Map<String, Object>> implementations = implementations();
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        implementations.forEach(row -> byId.put((String) row.get("id"), row));
        return instances().stream().anyMatch(row -> enabled(row)
                && kindOf(row, byId).equals(ProposalCodes.INPUT) && declares(row, byId, operation));
    }

    public boolean isEnabledCatalog(String instanceId) {
        List<Map<String, Object>> implementations = implementations();
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        implementations.forEach(row -> byId.put((String) row.get("id"), row));
        return instances().stream().anyMatch(row -> enabled(row) && instanceId.equals(row.get("id"))
                && kindOf(row, byId).equals(ProposalCodes.CATALOG_ADAPTER)
                && configuration(row).containsKey("catalog_base"));
    }

    public String catalogName(String instanceId) {
        return instances().stream().filter(row -> instanceId.equals(row.get("id")))
                .map(row -> (String) row.get("name")).findFirst().orElse("The catalog");
    }

    public String firstInput(String operation) {
        List<Map<String, Object>> implementations = implementations();
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        implementations.forEach(row -> byId.put((String) row.get("id"), row));
        return instances().stream().filter(row -> enabled(row)
                && kindOf(row, byId).equals(ProposalCodes.INPUT)
                && declares(row, byId, operation)).map(row -> (String) row.get("id")).findFirst().orElse(null);
    }

    List<Map<String, Object>> instances() {
        return dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME, PLUGIN_INSTANCES.IMPLEMENTATION_ID,
                        PLUGIN_INSTANCES.CONFIGURATION, PLUGIN_INSTANCES.IS_ENABLED, PLUGIN_INSTANCES.IS_DELETED,
                        PLUGIN_INSTANCES.POSITION)
                .from(PLUGIN_INSTANCES).orderBy(PLUGIN_INSTANCES.POSITION).fetch(row -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("id", row.get(PLUGIN_INSTANCES.ID));
                    value.put("name", row.get(PLUGIN_INSTANCES.NAME));
                    value.put("implementationId", row.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID));
                    value.put("configuration", mapper.readTree(row.get(PLUGIN_INSTANCES.CONFIGURATION).data()));
                    value.put("enabled", row.get(PLUGIN_INSTANCES.IS_ENABLED));
                    value.put("deleted", row.get(PLUGIN_INSTANCES.IS_DELETED));
                    return value;
                });
    }

    List<Map<String, Object>> implementations() {
        return dsl.select(PLUGIN_IMPLEMENTATIONS.ID, PLUGIN_IMPLEMENTATIONS.NAME, PLUGIN_IMPLEMENTATIONS.KIND,
                        PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_IMPLEMENTATIONS).orderBy(PLUGIN_IMPLEMENTATIONS.POSITION).fetch(row -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("id", row.get(PLUGIN_IMPLEMENTATIONS.ID));
                    value.put("name", row.get(PLUGIN_IMPLEMENTATIONS.NAME));
                    value.put("kind", row.get(PLUGIN_IMPLEMENTATIONS.KIND));
                    value.put("versions", mapper.readTree(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data()));
                    return value;
                });
    }

    String kindOf(Map<String, Object> instance, Map<String, Map<String, Object>> implementations) {
        return (String) implementations.get(instance.get("implementationId")).get("kind");
    }

    boolean enabled(Map<String, Object> instance) {
        return Boolean.TRUE.equals(instance.get("enabled")) && Boolean.FALSE.equals(instance.get("deleted"));
    }

    Map<String, String> configuration(Map<String, Object> instance) {
        JsonNode value = (JsonNode) instance.get("configuration");
        Map<String, String> result = new LinkedHashMap<>();
        value.properties().forEach(entry -> result.put(entry.getKey(), entry.getValue().isNull()
                ? null : entry.getValue().asString()));
        return result;
    }

    Map<String, String> catalogConfiguration(Map<String, Object> instance) {
        return configuration(instance);
    }

    boolean searchable(Map<String, Object> instance, Map<String, Map<String, Object>> implementations) {
        JsonNode versions = (JsonNode) implementations.get(instance.get("implementationId")).get("versions");
        JsonNode operations = versions.isEmpty() ? null : versions.get(0).path("declares").path("operations");
        for (JsonNode operation : operations == null ? mapper.createArrayNode() : operations) {
            if (operation.asString().equals(ProposalCodes.SEARCH)
                    || operation.asString().equals(ProposalCodes.SYNC)) {
                return true;
            }
        }
        return false;
    }

    boolean declares(Map<String, Object> instance, Map<String, Map<String, Object>> implementations,
            String operation) {
        JsonNode versions = (JsonNode) implementations.get(instance.get("implementationId")).get("versions");
        if (versions.isEmpty()) {
            return false;
        }
        for (JsonNode item : versions.get(0).path("declares").path("operations")) {
            if (operation.equals(item.asString())) {
                return true;
            }
        }
        return false;
    }

    Map<String, Object> named(Map<String, Object> instance, boolean opacUrl) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", instance.get("id"));
        result.put("name", instance.get("name"));
        if (opacUrl) {
            result.put("opacUrl", configuration(instance).get("opac_url"));
        }
        return result;
    }
}

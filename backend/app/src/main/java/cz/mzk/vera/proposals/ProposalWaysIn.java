package cz.mzk.vera.proposals;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static org.jooq.impl.DSL.lower;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

// ACT-ways-in; PLG-api-capabilities: search the mirror and select declared plugin operations.
@Repository
public class ProposalWaysIn {
    private final DSLContext dsl;
    private final JsonMapper mapper;
    private final ProposalPluginQueries plugins;
    public ProposalWaysIn(DSLContext dsl, JsonMapper mapper, ProposalPluginQueries plugins) {
        this.dsl = dsl;
        this.mapper = mapper;
        this.plugins = plugins;
    }

    public List<Map<String, Object>> search(String query, String selectedCatalog) {
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (needle.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> instances = plugins.instances();
        List<Map<String, Object>> implementations = plugins.implementations();
        Map<String, Map<String, Object>> implementationById = new LinkedHashMap<>();
        implementations.forEach(row -> implementationById.put((String) row.get("id"), row));
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> instance : instances) {
            if (!plugins.enabled(instance)
                    || !plugins.kindOf(instance, implementationById).equals(ProposalCodes.CATALOG_ADAPTER)
                    || !plugins.catalogConfiguration(instance).containsKey("catalog_base")
                    || !plugins.searchable(instance, implementationById)
                    || "off".equals(plugins.configuration(instance).get("search"))
                    || (selectedCatalog != null && !selectedCatalog.equals(instance.get("id")))) {
                continue;
            }
            var rows = dsl.select(CATALOG_MIRROR.CATALOG_ID, CATALOG_MIRROR.TITLE,
                            CATALOG_MIRROR.UNITS)
                    .from(CATALOG_MIRROR)
                    .where(CATALOG_MIRROR.INSTANCE_ID.eq((String) instance.get("id")))
                    .and(lower(CATALOG_MIRROR.TITLE).contains(needle)
                            .or(lower(CATALOG_MIRROR.CATALOG_ID).contains(needle)))
                    .orderBy(CATALOG_MIRROR.POSITION)
                    .fetch();
            Set<String> seen = new LinkedHashSet<>();
            for (var row : rows) {
                if (!seen.add(row.get(CATALOG_MIRROR.CATALOG_ID))) {
                    continue;
                }
                Map<String, Object> hit = new LinkedHashMap<>();
                hit.put("catalogId", row.get(CATALOG_MIRROR.CATALOG_ID));
                hit.put("title", row.get(CATALOG_MIRROR.TITLE));
                hit.put("units", row.get(CATALOG_MIRROR.UNITS) == null ? List.of()
                        : mapper.readTree(row.get(CATALOG_MIRROR.UNITS).data()));
                hit.put("catalog", Map.of("id", instance.get("id"), "name", instance.get("name")));
                result.add(hit);
            }
        }
        return result;
    }

    public boolean hasEnabledInput(String operation) {
        return plugins.hasEnabledInput(operation);
    }

    public boolean isEnabledCatalog(String instanceId) {
        return plugins.isEnabledCatalog(instanceId);
    }

    public String catalogName(String instanceId) {
        return plugins.catalogName(instanceId);
    }

    public String firstInput(String operation) {
        return plugins.firstInput(operation);
    }

    public boolean isEnabledEntryLink(String instanceId) { return plugins.isEnabledEntryLink(instanceId); }

    public String allowedReturn(String instanceId, String origin) { return plugins.allowedReturn(instanceId, origin); }
}

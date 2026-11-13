package cz.mzk.vera.pluginhost;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-api-capabilities. Lists enabled, undeleted plugin instances in their configured order.
@Repository
public class PluginInstances {
    private final JsonMapper json;

    public PluginInstances(JsonMapper json) {
        this.json = json;
    }

    public List<Instance> enabled(DSLContext dsl, String kind, String trigger) {
        List<String> matching = dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.TRIGGERS)
                .from(PLUGIN_INSTANCES).fetch().stream()
                .filter(row -> {
                    for (JsonNode value : json.readTree(row.get(PLUGIN_INSTANCES.TRIGGERS).data())) {
                        if (trigger.equals(value.asString())) {
                            return true;
                        }
                    }
                    return false;
                }).map(row -> row.get(PLUGIN_INSTANCES.ID)).toList();
        return enabled(dsl, kind).stream().filter(instance -> matching.contains(instance.id())).toList();
    }

    public List<Instance> enabled(DSLContext dsl, String kind) {
        return dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME)
                .from(PLUGIN_INSTANCES)
                .join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq(kind))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION)
                .fetch(row -> new Instance(row.get(PLUGIN_INSTANCES.ID), row.get(PLUGIN_INSTANCES.NAME)));
    }

    public record Instance(String id, String name) {}
}

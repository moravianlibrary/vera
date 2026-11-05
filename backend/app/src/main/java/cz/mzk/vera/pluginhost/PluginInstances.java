package cz.mzk.vera.pluginhost;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// PLG-api-capabilities. Lists enabled, undeleted plugin instances in their configured order.
@Repository
public class PluginInstances {
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

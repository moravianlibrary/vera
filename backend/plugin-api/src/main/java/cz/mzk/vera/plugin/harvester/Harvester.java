package cz.mzk.vera.plugin.harvester;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Harvester; PLG-api-cursor.
public interface Harvester {
    HarvestAnswer harvest(PluginContext context, HarvestInput input);
}

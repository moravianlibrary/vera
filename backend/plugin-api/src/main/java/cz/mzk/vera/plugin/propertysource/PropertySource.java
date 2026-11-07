package cz.mzk.vera.plugin.propertysource;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Property source.
public interface PropertySource {
    ValuesAnswer values(PluginContext context, ValuesInput input);
}

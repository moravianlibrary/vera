package cz.mzk.vera.plugin.registry;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Registry.
public interface Registry {
    LookupAnswer lookup(PluginContext context, LookupInput input);
}

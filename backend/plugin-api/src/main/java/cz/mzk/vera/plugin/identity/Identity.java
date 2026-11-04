package cz.mzk.vera.plugin.identity;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Identity.
public interface Identity {
    BeginAnswer begin(PluginContext context, BeginInput input);

    CompleteAnswer complete(PluginContext context, CompleteInput input);
}

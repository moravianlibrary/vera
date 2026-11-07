package cz.mzk.vera.plugin.restriction;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Restriction.
public interface Restriction {
    RestrictionCheckAnswer check(PluginContext context, RestrictionCheckInput input);
}

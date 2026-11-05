package cz.mzk.vera.plugin.custody;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Custody.
public interface Custody {
    PlaceAnswer place(PluginContext context, PlaceInput input);
}

package cz.mzk.vera.plugin.catalog;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Catalog adapter.
public interface CatalogAdapter {
    ReadAnswer read(PluginContext context, ReadInput input);
}

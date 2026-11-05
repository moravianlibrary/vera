package cz.mzk.vera.plugin.catalog;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Catalog adapter.
public interface SearchableCatalog {
    SearchAnswer search(PluginContext context, SearchInput input);
}

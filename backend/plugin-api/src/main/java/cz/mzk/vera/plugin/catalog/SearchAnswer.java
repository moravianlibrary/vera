package cz.mzk.vera.plugin.catalog;

import java.util.List;

// PLG-api-kinds: Catalog adapter.
public record SearchAnswer(List<Hit> hits) {
    public record Hit(String catalogId, String title, List<String> units) {}
}

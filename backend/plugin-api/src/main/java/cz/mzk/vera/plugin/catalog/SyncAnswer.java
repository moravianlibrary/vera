package cz.mzk.vera.plugin.catalog;

import java.util.List;
import java.util.Map;

// PLG-api-kinds: Catalog adapter.
public record SyncAnswer(List<Keep> keep, List<String> drop, List<CatalogReplacement> replaced,
        String nextCursor, boolean hasMore) {
    public SyncAnswer(List<Keep> keep, List<String> drop, String nextCursor, boolean hasMore) {
        this(keep, drop, List.of(), nextCursor, hasMore);
    }

    public record Keep(String catalogId, String title, List<String> units,
            List<String> identifiers, String text, Map<String, Object> record) {}
}

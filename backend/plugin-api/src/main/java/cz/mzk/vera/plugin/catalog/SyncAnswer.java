package cz.mzk.vera.plugin.catalog;

import java.util.List;
import java.util.Map;

// PLG-api-kinds: Catalog adapter.
public record SyncAnswer(List<Keep> keep, List<String> drop, String nextCursor, boolean hasMore) {
    public record Keep(String catalogId, String title, List<String> units,
            List<String> identifiers, String text, Map<String, Object> record) {}
}

package cz.mzk.vera.plugin.catalog;

import java.util.List;

// PLG-api-kinds: Catalog adapter.
public record ChangesAnswer(List<String> catalogIds, String nextCursor) {}

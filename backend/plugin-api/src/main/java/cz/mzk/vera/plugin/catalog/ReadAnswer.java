package cz.mzk.vera.plugin.catalog;

import java.time.Instant;
import java.util.List;
import java.util.Map;

// PLG-api-kinds: Catalog adapter.
public record ReadAnswer(String catalogId, Map<String, Object> fields, List<String> units,
        String issuanceType, Instant readAt) {}

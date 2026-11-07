package cz.mzk.vera.plugin.restriction;

import cz.mzk.vera.plugin.records.Document;
import java.util.List;

// PLG-api-kinds: Restriction.
public record RestrictionCheckInput(Document record, List<PropertyValue> properties) {
    public record PropertyValue(String key, Object value) {}
}

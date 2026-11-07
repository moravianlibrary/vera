package cz.mzk.vera.plugin.validation;

import cz.mzk.vera.plugin.records.Document;
import java.util.List;

// PLG-api-kinds: Validation.
public record ValidationCheckInput(Document record, List<PropertyValue> properties) {
    public record PropertyValue(String key, Object value) {}
}

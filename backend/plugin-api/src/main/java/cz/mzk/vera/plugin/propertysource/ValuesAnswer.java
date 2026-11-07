package cz.mzk.vera.plugin.propertysource;

import java.util.List;

// PLG-api-kinds: Property source.
public record ValuesAnswer(List<PropertyValue> values) {
    public record PropertyValue(String key, Object value, int tier) {}
}

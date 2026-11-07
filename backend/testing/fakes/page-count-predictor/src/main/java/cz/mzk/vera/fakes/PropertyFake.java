package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.propertysource.PropertySource;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.propertysource.ValuesInput;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// BK4g; PLG-api-kinds: Property source.
public final class PropertyFake implements PropertySource {
    @Override
    public ValuesAnswer values(PluginContext context, ValuesInput input) {
        Map<String, List<String>> answer = IngestWire.call(context, "PropertySource", "values",
                input.record().id(), input.record().catalogId());
        IngestWire.check(answer);
        List<ValuesAnswer.PropertyValue> values = new ArrayList<>();
        List<String> keys = IngestWire.aligned(answer, "propertyKey", "propertyTier", "propertyValue");
        List<String> tiers = Wire.all(answer, "propertyTier");
        List<String> rawValues = Wire.all(answer, "propertyValue");
        for (int index = 0; index < keys.size(); index++) {
            values.add(new ValuesAnswer.PropertyValue(keys.get(index), IngestWire.jsonValue(rawValues.get(index)),
                    Integer.parseInt(tiers.get(index))));
        }
        return new ValuesAnswer(List.copyOf(values));
    }
}

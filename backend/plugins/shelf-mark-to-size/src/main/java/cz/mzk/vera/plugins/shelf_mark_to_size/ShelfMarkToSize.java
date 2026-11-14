package cz.mzk.vera.plugins.shelf_mark_to_size;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.propertysource.PropertySource;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.propertysource.ValuesInput;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// PLG-api-kinds: Property source.
public final class ShelfMarkToSize implements PropertySource {
    @Override
    public ValuesAnswer values(PluginContext context, ValuesInput input) {
        String shelfMark = input.record().shelfMark();
        if (shelfMark == null) {
            return new ValuesAnswer(List.of());
        }

        Map<String, String> table = tableOf(context.configuration().get("table"));
        String size = table.entrySet().stream()
                .filter(entry -> shelfMark.startsWith(entry.getKey()))
                .max(Map.Entry.comparingByKey((left, right) -> Integer.compare(left.length(), right.length())))
                .map(Map.Entry::getValue)
                .orElse(null);
        if (size == null) {
            return new ValuesAnswer(List.of());
        }

        String configuredTier = context.configuration().get("tier");
        int tier = configuredTier == null || configuredTier.isBlank() ? 50 : Integer.parseInt(configuredTier);
        return new ValuesAnswer(List.of(new ValuesAnswer.PropertyValue("size", size, tier)));
    }

    private Map<String, String> tableOf(String table) {
        Map<String, String> result = new HashMap<>();
        if (table == null) {
            return result;
        }
        for (String entry : table.split(",")) {
            int arrow = entry.indexOf('→');
            int arrowWidth = 1;
            if (arrow < 0) {
                arrow = entry.indexOf("->");
                arrowWidth = 2;
            }
            if (arrow < 0) {
                continue;
            }
            String prefix = entry.substring(0, arrow).trim();
            String size = entry.substring(arrow + arrowWidth).trim();
            if (!prefix.isEmpty() && !size.isEmpty()) {
                result.put(prefix, size);
            }
        }
        return result;
    }
}

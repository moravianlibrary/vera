package cz.mzk.vera.plugins.material_type;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.classifier.Classifier;
import cz.mzk.vera.plugin.classifier.SuggestInput;
import cz.mzk.vera.plugin.classifier.Suggestion;
import cz.mzk.vera.plugin.records.Category;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

// PLG-api-kinds: Classifier.
public final class MaterialType implements Classifier {
    @Override
    public Optional<Suggestion> suggest(PluginContext context, SuggestInput input) {
        String type = input.document().type();
        if (type == null) {
            return Optional.empty();
        }
        String categoryId = tableOf(context.configuration().get("table")).get(type.toLowerCase(Locale.ROOT));
        if (categoryId == null) {
            return Optional.empty();
        }
        Category category = new Category(categoryId, null, null);
        return Optional.of(new Suggestion(category, "Document type: " + type));
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
            String type = entry.substring(0, arrow).trim();
            String categoryId = entry.substring(arrow + arrowWidth).trim();
            if (!type.isEmpty() && !categoryId.isEmpty()) {
                result.put(type.toLowerCase(Locale.ROOT), categoryId);
            }
        }
        return result;
    }
}

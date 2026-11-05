package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.classifier.Classifier;
import cz.mzk.vera.plugin.classifier.SuggestInput;
import cz.mzk.vera.plugin.classifier.Suggestion;
import cz.mzk.vera.plugin.records.Category;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// BK3d; PLG-api-kinds: Classifier.
public final class PlaceOfPublication implements Classifier {
    @Override
    public Optional<Suggestion> suggest(PluginContext context, SuggestInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "strategy", "PlaceOfPublication");
        Wire.put(fields, "title", input.document().title());
        Wire.put(fields, "documentType", input.document().type());
        Map<String, List<String>> answer = Wire.send(context, "suggest", fields);
        return suggestion(answer);
    }

    static Optional<Suggestion> suggestion(Map<String, List<String>> answer) {
        if ("true".equals(Wire.first(answer, "empty"))) {
            return Optional.empty();
        }
        String parent = Wire.first(answer, "categoryParentId");
        Category category = new Category(Wire.first(answer, "categoryId"),
                Wire.first(answer, "categoryName"), parent == null || parent.isEmpty() ? null : parent);
        return Optional.of(new Suggestion(category, Wire.first(answer, "why")));
    }
}

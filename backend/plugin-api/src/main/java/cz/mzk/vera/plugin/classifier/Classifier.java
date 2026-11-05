package cz.mzk.vera.plugin.classifier;

import cz.mzk.vera.plugin.PluginContext;
import java.util.Optional;

// PLG-api-kinds: Classifier.
public interface Classifier {
    Optional<Suggestion> suggest(PluginContext context, SuggestInput input);
}

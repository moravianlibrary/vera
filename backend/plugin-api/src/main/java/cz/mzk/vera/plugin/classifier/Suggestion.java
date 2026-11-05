package cz.mzk.vera.plugin.classifier;

import cz.mzk.vera.plugin.records.Category;

// PLG-api-kinds: Classifier.
public record Suggestion(Category category, String why) {}

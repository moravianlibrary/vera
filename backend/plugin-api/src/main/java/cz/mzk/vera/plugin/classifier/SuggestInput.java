package cz.mzk.vera.plugin.classifier;

import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Request;

// PLG-api-kinds: Classifier.
public record SuggestInput(Request request, Document document) {}

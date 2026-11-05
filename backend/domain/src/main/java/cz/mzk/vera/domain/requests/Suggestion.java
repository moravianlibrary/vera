package cz.mzk.vera.domain.requests;

// plugins.md §4.13: classifier suggestion shown on a request row.
public record Suggestion(String categoryId, String reason, Classifier classifier) {}

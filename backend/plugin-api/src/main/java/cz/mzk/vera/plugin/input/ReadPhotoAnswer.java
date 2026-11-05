package cz.mzk.vera.plugin.input;

import java.util.List;

// PLG-api-kinds: Input.
public record ReadPhotoAnswer(String seen, List<Value> values, List<Candidate> candidates) {
    public record Value(String label, String value, double confidence) {}
    public record Candidate(String catalogId, String title, String why) {}
}

package cz.mzk.vera.plugin.publicationdetector;

import java.util.List;

// PLG-api-kinds: Publication detector.
public record DetectAnswer(List<FoundLink> links) {
    public record FoundLink(String iterationId, String url) {}
}

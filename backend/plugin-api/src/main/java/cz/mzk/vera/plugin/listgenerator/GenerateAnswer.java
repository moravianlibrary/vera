package cz.mzk.vera.plugin.listgenerator;

import java.util.List;

// PLG-api-kinds: List generator.
public record GenerateAnswer(List<Pick> picks, int spreadCount, List<Shortfall> shortfalls) {
    public record Pick(String iterationId, String why) {}

    public record Shortfall(String categoryId, int pages, ShortfallCause cause) {}
}

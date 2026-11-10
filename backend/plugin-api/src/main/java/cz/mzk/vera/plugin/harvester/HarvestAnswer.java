package cz.mzk.vera.plugin.harvester;

import java.util.List;

// PLG-api-kinds: Harvester.
public record HarvestAnswer(List<ProposalItem> items, String nextCursor) {
    public sealed interface ProposalItem permits CatalogId, Identifier {}
    public record CatalogId(String catalogId) implements ProposalItem {}
    public record Identifier(String type, String value) implements ProposalItem {}
}

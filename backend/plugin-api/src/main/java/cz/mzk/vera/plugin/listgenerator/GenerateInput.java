package cz.mzk.vera.plugin.listgenerator;

import cz.mzk.vera.plugin.records.Category;
import cz.mzk.vera.plugin.records.Iteration;
import java.util.List;
import java.util.Map;

// PLG-api-kinds: List generator.
public record GenerateInput(ShapingIntention intention, boolean hasMix, List<Leaf> leaves,
        List<Node> nodes, List<PoolItem> pool, List<Member> members, int pages,
        List<String> topCategoryIds, Map<String, Integer> allocation) {
    public record ShapingIntention(String id, String name) {}

    public record Leaf(Category category, String topCategoryId, Double share, String nodeId) {}

    public record Node(String id, Double share) {}

    public record PoolItem(Iteration iteration, int pages, String askedAt) {}

    public record Member(Iteration iteration, int pages) {}
}

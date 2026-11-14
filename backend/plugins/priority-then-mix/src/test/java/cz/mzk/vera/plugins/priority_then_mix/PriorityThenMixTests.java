package cz.mzk.vera.plugins.priority_then_mix;

import static org.junit.jupiter.api.Assertions.assertEquals;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.LocalPasswords;
import cz.mzk.vera.plugin.listgenerator.GenerateAnswer;
import cz.mzk.vera.plugin.listgenerator.GenerateInput;
import cz.mzk.vera.plugin.records.Category;
import cz.mzk.vera.plugin.records.Iteration;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PriorityThenMixTests {
    @Test
    void noMixUsesTheSuppliedPriorityThenAskedOrder() {
        GenerateInput input = input(false, 500, List.of(
                item("old-high", "c1", "High", 200, "2026-05-02T00:00:00Z"),
                item("new-high", "c1", "High", 200, "2026-05-20T00:00:00Z"),
                item("old-low", "c1", "Low", 200, "2026-05-01T00:00:00Z")));

        GenerateAnswer answer = new PriorityThenMix().generate(context("5%", "priority,asked"), input);

        assertEquals(List.of("old-high", "new-high"), answer.picks().stream()
                .map(GenerateAnswer.Pick::iterationId).toList());
    }

    @Test
    void toleranceAppliesToMixShareAndCorrectingAllocationDoesNotSpread() {
        GenerateInput base = input(true, 1000, List.of(
                item("c1-fit", "c1", "Normal", 550, "2026-05-01T00:00:00Z")));
        GenerateInput input = new GenerateInput(base.intention(), base.hasMix(), base.leaves(),
                base.nodes(), base.pool(), base.members(), base.pages(), base.topCategoryIds(), Map.of("top", 1000));

        GenerateAnswer answer = new PriorityThenMix().generate(context("10%", "priority,asked"), input);

        assertEquals(List.of("c1-fit"), answer.picks().stream()
                .map(GenerateAnswer.Pick::iterationId).toList());
        assertEquals(0, answer.spreadCount());
        assertEquals("c2", answer.shortfalls().getFirst().categoryId());
    }

    private GenerateInput input(boolean hasMix, int pages, List<GenerateInput.PoolItem> pool) {
        List<GenerateInput.Leaf> leaves = List.of(
                new GenerateInput.Leaf(new Category("c1", "North", "top"), "top", 50.0, "top"),
                new GenerateInput.Leaf(new Category("c2", "South", "top"), "top", 50.0, "top"));
        return new GenerateInput(new GenerateInput.ShapingIntention("i4", "Overall output"), hasMix,
                leaves, List.of(new GenerateInput.Node("top", 100.0)), pool, List.of(), pages,
                List.of(), null);
    }

    private GenerateInput.PoolItem item(String id, String category, String priority, int pages, String askedAt) {
        Iteration iteration = new Iteration(id, "d1", 1, "r1", category, priority, null,
                "Ready", null, null);
        return new GenerateInput.PoolItem(iteration, pages, askedAt);
    }

    private PluginContext context(String tolerance, String order) {
        return new PluginContext() {
            @Override
            public String instanceId() { return "pi14"; }
            @Override
            public Map<String, String> configuration() { return Map.of("tolerance", tolerance, "order", order); }
            @Override
            public Map<String, String> secrets() { return Map.of(); }
            @Override
            public PluginHttp http() { throw new AssertionError("PriorityThenMix does not make HTTP calls"); }
            @Override
            public System.Logger logger() { return System.getLogger("test"); }
            @Override
            public Clock clock() { return Clock.systemUTC(); }
            @Override
            public LocalPasswords localPasswords() { throw new AssertionError("No local passwords are used"); }
        };
    }
}

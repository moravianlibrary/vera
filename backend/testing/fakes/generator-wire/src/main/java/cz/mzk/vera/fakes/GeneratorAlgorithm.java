package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.listgenerator.GenerateAnswer;
import cz.mzk.vera.plugin.listgenerator.GenerateInput;
import cz.mzk.vera.plugin.listgenerator.ShortfallCause;
import cz.mzk.vera.plugin.records.Iteration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

// PLAN-generate: the mock's list allocation rules are shared by both generator fakes.
final class GeneratorAlgorithm {
    private static final int PAGE_SLACK = 50;
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM", Locale.US);

    private GeneratorAlgorithm() {}

    static GenerateAnswer generate(PluginContext context, GenerateInput input, boolean advisor) {
        double tolerance = tolerance(context.configuration().get("tolerance"));
        List<GenerateAnswer.Pick> picks = new ArrayList<>();
        Map<String, Integer> got = new HashMap<>();
        Map<String, Double> goals = new HashMap<>();
        Set<String> picked = new HashSet<>();
        int[] total = {input.members().stream().mapToInt(GenerateInput.Member::pages).sum()};
        for (GenerateInput.Leaf leaf : input.leaves()) {
            int current = input.members().stream()
                    .filter(member -> member.iteration().categoryId().equals(leaf.category().id()))
                    .mapToInt(GenerateInput.Member::pages).sum();
            got.put(leaf.category().id(), current);
            goals.put(leaf.category().id(), goal(input, leaf));
        }
        if (!input.hasMix()) {
            for (GenerateInput.PoolItem item : input.pool()) {
                if (total[0] >= input.pages() || total[0] + item.pages() > input.pages() * (1 + tolerance) + PAGE_SLACK
                        || !allowed(input, item.iteration().categoryId())) {
                    continue;
                }
                picks.add(new GenerateAnswer.Pick(item.iteration().id(), reason(item, null)));
                total[0] += item.pages();
            }
            return new GenerateAnswer(List.copyOf(picks), 0, List.of());
        }
        for (GenerateInput.Leaf leaf : input.leaves()) {
            String id = leaf.category().id();
            double goal = goals.get(id);
            if (leaf.share() == null || leaf.share() == 0 || !allowed(input, id)) {
                continue;
            }
            for (GenerateInput.PoolItem item : input.pool()) {
                if (!item.iteration().categoryId().equals(id)) {
                    continue;
                }
                int filled = got.get(id);
                if (filled < goal && filled + item.pages() <= goal * (1 + tolerance) + PAGE_SLACK) {
                    take(item, null, advisor, context, picks, picked, got, total);
                }
            }
        }
        List<GenerateInput.Leaf> shortLeaves = input.allocation() == null ? input.leaves().stream()
                .filter(leaf -> missing(leaf, got, goals, tolerance) > 0)
                .sorted(Comparator.comparingDouble((GenerateInput.Leaf leaf) ->
                        missing(leaf, got, goals, tolerance)).reversed()).toList() : List.of();
        int spreadCount = 0;
        for (GenerateInput.Leaf shortLeaf : shortLeaves) {
            double need = missing(shortLeaf, got, goals, tolerance);
            List<GenerateInput.PoolItem> candidates = input.pool().stream()
                    .filter(item -> !picked.contains(item.iteration().id()))
                    .filter(item -> allowed(input, item.iteration().categoryId()))
                    .filter(item -> input.leaves().stream().anyMatch(leaf ->
                            leaf.category().id().equals(item.iteration().categoryId()) && leaf.share() != null
                                    && leaf.share() > 0))
                    .sorted(Comparator.comparingInt(item -> distance(input, shortLeaf, item.iteration())))
                    .toList();
            for (GenerateInput.PoolItem item : candidates) {
                if (need > 0 && total[0] + item.pages() <= input.pages() * (1 + tolerance)) {
                    take(item, shortLeaf, advisor, context, picks, picked, got, total);
                    need -= item.pages();
                    if (!item.iteration().categoryId().equals(shortLeaf.category().id())) {
                        spreadCount++;
                    }
                }
            }
        }
        List<GenerateAnswer.Shortfall> shortfalls = new ArrayList<>();
        for (GenerateInput.Leaf leaf : input.leaves()) {
            double missing = missing(leaf, got, goals, tolerance);
            boolean supply = input.pool().stream().anyMatch(item ->
                    item.iteration().categoryId().equals(leaf.category().id())
                            && !picked.contains(item.iteration().id()));
            ShortfallCause cause = cause(missing, leaf.share(), allowed(input, leaf.category().id()), supply);
            if (cause != null) {
                shortfalls.add(new GenerateAnswer.Shortfall(leaf.category().id(), (int) Math.round(missing), cause));
            }
        }
        return new GenerateAnswer(List.copyOf(picks), spreadCount, List.copyOf(shortfalls));
    }

    private static double tolerance(String value) {
        try {
            double parsed = Double.parseDouble(value == null ? "" : value.replace("%", ""));
            return (parsed == 0 ? 5 : parsed) / 100;
        } catch (NumberFormatException exception) {
            return 0.05;
        }
    }

    private static double goal(GenerateInput input, GenerateInput.Leaf leaf) {
        double share = leaf.share() == null ? 0 : leaf.share();
        if (input.allocation() == null) {
            return input.pages() * share / 100;
        }
        GenerateInput.Node node = input.nodes().stream().filter(value -> value.id().equals(leaf.nodeId()))
                .findFirst().orElse(null);
        if (node == null || node.share() == null || node.share() == 0) {
            return 0;
        }
        return input.allocation().getOrDefault(node.id(), 0) * share / node.share();
    }

    private static boolean allowed(GenerateInput input, String categoryId) {
        if (input.topCategoryIds().isEmpty()) {
            return true;
        }
        return input.leaves().stream().filter(leaf -> leaf.category().id().equals(categoryId))
                .anyMatch(leaf -> input.topCategoryIds().contains(leaf.topCategoryId()));
    }

    private static double missing(GenerateInput.Leaf leaf, Map<String, Integer> got,
            Map<String, Double> goals, double tolerance) {
        double goal = goals.getOrDefault(leaf.category().id(), 0.0);
        double missing = goal - got.getOrDefault(leaf.category().id(), 0);
        return missing > goal * tolerance ? missing : 0;
    }

    private static int distance(GenerateInput input, GenerateInput.Leaf target, Iteration iteration) {
        GenerateInput.Leaf category = input.leaves().stream()
                .filter(leaf -> leaf.category().id().equals(iteration.categoryId())).findFirst().orElse(null);
        if (category == null) {
            return 2;
        }
        if (java.util.Objects.equals(category.category().parentId(), target.category().parentId())) {
            return 0;
        }
        return category.topCategoryId().equals(target.topCategoryId()) ? 1 : 2;
    }

    private static void take(GenerateInput.PoolItem item, GenerateInput.Leaf covers, boolean advisor,
            PluginContext context, List<GenerateAnswer.Pick> picks, Set<String> picked,
            Map<String, Integer> got, int[] total) {
        String why = reason(item, covers);
        if (advisor) {
            Map<String, List<String>> fields = Wire.fields();
            Wire.put(fields, "iterationId", item.iteration().id());
            why = Wire.first(Wire.send(context, "advisorReasons", fields), "why");
            if (why == null) {
                why = "Fits the mix.";
            }
        }
        picks.add(new GenerateAnswer.Pick(item.iteration().id(), why));
        picked.add(item.iteration().id());
        total[0] += item.pages();
        got.merge(item.iteration().categoryId(), item.pages(), Integer::sum);
    }

    private static String reason(GenerateInput.PoolItem item, GenerateInput.Leaf covers) {
        String day = LocalDate.parse(item.askedAt().substring(0, 10)).format(DAY);
        String reason = item.iteration().priority() + " priority · asked " + day;
        if (covers != null && !covers.category().id().equals(item.iteration().categoryId())) {
            reason += " · covers " + covers.category().name();
        }
        return reason;
    }

    private static ShortfallCause cause(double missing, Double share, boolean allowed, boolean supply) {
        if (share == null) return ShortfallCause.UNALLOCATED;
        if (missing == 0) return null;
        if (!allowed) return ShortfallCause.LEFT_OUT;
        return supply ? ShortfallCause.OVERSHOOT : ShortfallCause.NO_SUPPLY;
    }
}

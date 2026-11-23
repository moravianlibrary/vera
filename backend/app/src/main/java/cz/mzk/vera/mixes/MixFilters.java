package cz.mzk.vera.mixes;

import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import tools.jackson.databind.JsonNode;

// UI-filters on Category mixes, as the page applies them, for a watchlist on it (WATCH-model).
public final class MixFilters {
    private static final List<String> STATES = List.of("Active", "Archived");
    private static final List<String> PRIMARIES = List.of("Primary", "Other");
    private static final List<String> PROPORTIONS = List.of("Complete", "Unallocated");

    private MixFilters() {}

    // mixes as MixQueries.list() answers them; categories as CategoryReads.categories() reads them.
    public static List<Map<String, Object>> matchingMixes(List<Map<String, Object>> mixes,
            List<Map<String, Object>> categories, Map<String, String> parameters) {
        String raw = parameters.get("q");
        String search = raw == null || raw.isBlank() ? null : raw.trim().toLowerCase(Locale.ROOT);
        List<String> states = valuesOf(parameters.get("state"), STATES);
        List<String> primaries = valuesOf(parameters.get("primary"), PRIMARIES);
        List<String> proportions = valuesOf(parameters.get("proportions"), PROPORTIONS);
        Range<Long> intentions = ValueRange.parseRange(parameters.get("intentions"), ValueRange::parseCount);
        return mixes.stream().filter(mix ->
                (search == null || namesOf((JsonNode) mix.get("names")).stream()
                        .anyMatch(name -> name.toLowerCase(Locale.ROOT).contains(search)))
                && (states == null || states.contains(mix.get("archivedAt") == null ? "Active" : "Archived"))
                && (primaries == null || primaries.contains(
                        Boolean.TRUE.equals(mix.get("isPrimary")) ? "Primary" : "Other"))
                && (proportions == null || proportions.contains(
                        hasUnallocatedProportions((JsonNode) mix.get("shares"), categories)
                                ? "Unallocated" : "Complete"))
                && (intentions == null || ValueRange.isWithinRange(
                        ((Number) mix.get("usageCount")).longValue(), intentions)))
                .toList();
    }

    // PLAN-mix-sets: some sibling set short of 100.
    static boolean hasUnallocatedProportions(JsonNode shares, List<Map<String, Object>> categories) {
        Map<String, Double> totals = new HashMap<>();
        for (Map<String, Object> category : categories) {
            JsonNode share = shares.get((String) category.get("id"));
            totals.merge(String.valueOf(category.get("parentId")),
                    share == null || share.isNull() ? 0.0 : share.asDouble(), Double::sum);
        }
        return totals.values().stream().anyMatch(total -> total < 100);
    }

    private static List<String> valuesOf(String raw, List<String> allowed) {
        if (raw == null) {
            return null;
        }
        List<String> values = Arrays.stream(raw.split(",")).map(String::trim).filter(allowed::contains)
                .distinct().toList();
        return values.isEmpty() ? null : values;
    }

    private static List<String> namesOf(JsonNode names) {
        List<String> result = new ArrayList<>();
        names.properties().forEach(entry -> result.add(entry.getValue().asString()));
        return result;
    }
}

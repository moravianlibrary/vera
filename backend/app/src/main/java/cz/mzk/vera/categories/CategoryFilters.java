package cz.mzk.vera.categories;

import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import tools.jackson.databind.JsonNode;

// UI-filters on Categories, as the page applies them, for a watchlist on it (WATCH-model): a match
// counts the category itself, never the ancestors the page shows around it.
public final class CategoryFilters {
    private static final List<String> KINDS = List.of("Branch", "Leaf");
    private static final List<String> CUSTODIES = List.of("Unheld", "Direct", "Inherited");
    private static final List<String> ATTENTIONS = List.of("Unallocated", "NoShare");

    private CategoryFilters() {}

    // categories as CategoryReads.categories() reads them, index as CategoryReads.index() answers.
    public static Set<String> matchingCategoryIds(List<Map<String, Object>> categories,
            Map<String, Object> index, Map<String, String> parameters) {
        String term = trimmed(parameters.get("q"));
        String search = term == null ? null : term.toLowerCase(Locale.ROOT);
        List<String> kinds = valuesOf(parameters.get("kind"), KINDS);
        List<String> custodies = valuesOf(parameters.get("custody"), CUSTODIES);
        List<String> attentions = valuesOf(parameters.get("attention"), ATTENTIONS);
        Range<Long> documents = ValueRange.parseRange(parameters.get("documents"), ValueRange::parseCount);
        Range<Long> readyPages = ValueRange.parseRange(parameters.get("ready"), ValueRange::parseCount);

        Map<String, String> parents = new LinkedHashMap<>();
        categories.forEach(category -> parents.put((String) category.get("id"), (String) category.get("parentId")));
        Map<String, Map<String, Object>> nodes = byCategory(index.get("nodes"));
        Map<String, Object> mix = map(index.get("mix"));
        Map<String, Map<String, Object>> mixNodes = mix == null ? Map.of() : byCategory(mix.get("nodes"));
        String scopeId = mix == null ? null : (String) map(mix.get("intention")).get("scopeCategoryId");

        Set<String> result = new LinkedHashSet<>();
        for (Map<String, Object> category : categories) {
            String id = (String) category.get("id");
            if (search != null && namesOf(category.get("names")).stream()
                    .noneMatch(name -> name.toLowerCase(Locale.ROOT).contains(search))
                    && !id.toLowerCase(Locale.ROOT).contains(search)) {
                continue;
            }
            Map<String, Object> node = nodes.get(id);
            Map<String, Object> mixNode = mixNodes.get(id);
            boolean isLeaf = !parents.containsValue(id);
            List<String> kindValues = List.of(isLeaf ? "Leaf" : "Branch");
            List<String> custodyValues = new ArrayList<>();
            List<?> reach = node == null ? null : (List<?>) node.get("reach");
            if (reach != null && reach.isEmpty()) {
                custodyValues.add("Unheld");
            }
            if (node != null && !((List<?>) node.get("grants")).isEmpty()) {
                custodyValues.add("Direct");
            }
            if (reach != null && reach.stream().anyMatch(item ->
                    !id.equals(map(map(item).get("grantedOn")).get("id")))) {
                custodyValues.add("Inherited");
            }
            boolean isInsideMix = mix != null && (scopeId == null || isInSubtree(parents, id, scopeId));
            List<String> attentionValues = new ArrayList<>();
            if (mixNode != null && ((Number) mixNode.get("unallocated")).doubleValue() > 0) {
                attentionValues.add("Unallocated");
            }
            if (isInsideMix && !id.equals(scopeId) && mixNode != null && mixNode.get("share") == null) {
                attentionValues.add("NoShare");
            }
            if (anyOf(kinds, kindValues) && anyOf(custodies, custodyValues)
                    && anyOf(attentions, attentionValues)
                    && (documents == null || node != null
                            && ValueRange.isWithinRange(count(node, "documentCount"), documents))
                    && (readyPages == null || node != null
                            && ValueRange.isWithinRange(count(node, "readyPages"), readyPages))) {
                result.add(id);
            }
        }
        return result;
    }

    private static boolean isInSubtree(Map<String, String> parents, String categoryId, String topId) {
        for (String current = categoryId; current != null; current = parents.get(current)) {
            if (current.equals(topId)) {
                return true;
            }
        }
        return false;
    }

    private static boolean anyOf(List<String> selected, List<String> values) {
        return selected == null || selected.stream().anyMatch(values::contains);
    }

    private static List<String> valuesOf(String raw, List<String> allowed) {
        if (raw == null) {
            return null;
        }
        List<String> values = Arrays.stream(raw.split(",")).filter(allowed::contains).distinct().toList();
        return values.isEmpty() ? null : values;
    }

    private static String trimmed(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    private static long count(Map<String, Object> node, String key) {
        return ((Number) node.get(key)).longValue();
    }

    private static Map<String, Map<String, Object>> byCategory(Object nodes) {
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        if (nodes instanceof List<?> values) {
            values.forEach(value -> result.put((String) map(value).get("categoryId"), map(value)));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    private static List<String> namesOf(Object names) {
        List<String> result = new ArrayList<>();
        if (names instanceof JsonNode node) {
            node.properties().forEach(entry -> result.add(entry.getValue().asString()));
        } else if (names instanceof Map<?, ?> values) {
            values.values().stream().filter(Objects::nonNull).forEach(value -> result.add(value.toString()));
        }
        return result;
    }
}

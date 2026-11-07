package cz.mzk.vera.validations;

import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.ValueRange;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// VIEW-validations; STAT-validation: parse each validationQueryParams field as the mock does.
record ValidationSearch(String cursor, int limit, String grouping, String search,
        Map<String, List<String>> lists, DayRange waiting, Map<String, String> properties) {
    private static final Set<String> REVIEWS = Set.of("Needed", "Denied", "Approved");
    private static final Set<String> ANSWERS = Set.of("Yes", "No");
    private static final Set<String> PRIORITIES = Set.of("Low", "Normal", "High", "Urgent");

    static ValidationSearch parse(Map<String, String> params, List<String> propertyKeys) {
        int limit = 50;
        try {
            int candidate = Integer.parseInt(params.get("limit"));
            if (candidate >= 1 && candidate <= 200) {
                limit = candidate;
            }
        } catch (NumberFormatException | NullPointerException ignored) {
            // Invalid slice controls use the contract default.
        }
        Map<String, List<String>> lists = Map.of(
                ValidationField.REVIEWS.facet(), values(params.get(ValidationField.REVIEWS.parameter()), REVIEWS),
                ValidationField.FORBIDDEN.facet(),
                        values(params.get(ValidationField.FORBIDDEN.parameter()), ANSWERS),
                ValidationField.CATEGORIES.facet(),
                        values(params.get(ValidationField.CATEGORIES.parameter()), null),
                ValidationField.INSTANCES.facet(),
                        values(params.get(ValidationField.INSTANCES.parameter()), null),
                ValidationField.PRIORITIES.facet(),
                        values(params.get(ValidationField.PRIORITIES.parameter()), PRIORITIES),
                ValidationField.PROJECTS.facet(),
                        values(params.get(ValidationField.PROJECTS.parameter()), null));
        Map<String, String> properties = new java.util.LinkedHashMap<>();
        for (String key : propertyKeys) {
            String prefix = "p." + key;
            for (String name : List.of(prefix, prefix + ".none", prefix + ".starts",
                    prefix + ".ends")) {
                String value = params.get(name);
                if (value != null) {
                    properties.put(name, value);
                }
            }
        }
        String group = params.get("group");
        String rawSearch = params.get("q");
        return new ValidationSearch(trim(params.get("cursor")), limit,
                "category".equals(group) || "defect".equals(group) ? group : null,
                trim(rawSearch), lists, ValueRange.parseDayRange(params.get("since")),
                Map.copyOf(properties));
    }

    private static List<String> values(String raw, Set<String> allowed) {
        if (raw == null) {
            return List.of();
        }
        LinkedHashSet<String> values = new LinkedHashSet<>();
        for (String part : raw.split(",")) {
            String value = part.trim();
            if (!value.isEmpty() && (allowed == null || allowed.contains(value))) {
                values.add(value);
            }
        }
        return List.copyOf(values);
    }

    private static String trim(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}

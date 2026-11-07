package cz.mzk.vera.requests;

import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.ValueRange;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// FILTER-requests; FILTER-range; DOC-property-filter: parse known request query values once.
record RequestSearch(String cursor, int limit, String grouping, String search,
        Map<String, List<String>> lists, DayRange asked, Map<String, String> properties) {
    private static final Set<String> DECISIONS = Set.of("Pending", "Denied", "Withdrawn");
    private static final Set<String> TYPES = Set.of("Periodical", "Monograph", "Manuscript", "Map");
    private static final Set<String> COPIES = Set.of("CheckFailed", "Unmapped", "Planned", "InProgress",
            "Digitized", "Published", "None");
    private static final Set<String> ANSWERS = Set.of("Yes", "No");
    private static final Set<String> ASKERS = Set.of("One", "Several");

    static RequestSearch parse(Map<String, String> params, List<String> propertyKeys) {
        int limit = 50;
        try {
            int candidate = Integer.parseInt(params.get("limit"));
            if (candidate >= 1 && candidate <= 200) {
                limit = candidate;
            }
        } catch (NumberFormatException | NullPointerException ignored) {
            // Invalid slice controls use the contract default.
        }
        Map<String, List<String>> values = Map.of(
                "decisions", list(params.get("decision"), DECISIONS),
                "custodyIds", list(params.get("custody"), null),
                "documentTypes", list(params.get("type"), TYPES),
                "projectIds", list(params.get("project"), null),
                "existingCopies", list(params.get("copy"), COPIES),
                "askerIds", list(params.get("asker"), null),
                "batchIds", list(params.get("batch"), null),
                "sources", list(params.get("source"), null),
                "askerCounts", list(params.get("askers"), ASKERS),
                "afterProjectApproval", list(params.get("after"), ANSWERS));
        Map<String, String> properties = new java.util.LinkedHashMap<>();
        for (String key : propertyKeys) {
            String prefix = "p." + key;
            for (String name : List.of(prefix, prefix + ".none", prefix + ".starts", prefix + ".ends")) {
                String value = params.get(name);
                if (value != null) {
                    properties.put(name, value);
                }
            }
        }
        String query = params.get("q");
        String group = params.get("group");
        return new RequestSearch(trim(params.get("cursor")), limit,
                "batch".equals(group) || "requester".equals(group) ? group : null,
                trim(query), values, ValueRange.parseDayRange(params.get("asked")), Map.copyOf(properties));
    }

    private static List<String> list(String raw, Set<String> allowed) {
        if (raw == null) {
            return List.of();
        }
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String part : raw.split(",")) {
            String value = part.trim();
            if (!value.isEmpty() && (allowed == null || allowed.contains(value))) {
                result.add(value);
            }
        }
        return List.copyOf(result);
    }

    private static String trim(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}

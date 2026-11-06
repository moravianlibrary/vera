package cz.mzk.vera.documents;

import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// FILTER-documents; FILTER-range; DOC-property-filter: parse only known query values once.
public record DocumentSearch(String cursor, int limit, Grouping grouping, String search,
        List<String> statuses, boolean isMine, List<String> decisions, List<String> progress,
        List<String> validations, List<String> forbidden, List<String> cancelled,
        List<String> categoryIds, List<String> projectIds, List<String> priorities,
        List<String> existingCopies, List<String> askerIds, Range<Long> pages, DayRange asked,
        Map<String, PropertyCondition> properties) {
    public enum Grouping { BATCH, PROJECT }

    public record PropertyCondition(boolean noValue, String contains, String starts, String ends,
            Range<BigDecimal> numbers, DayRange days, List<String> values) {
        public PropertyCondition {
            values = List.copyOf(values);
        }
    }

    // The wire names and slice limits are the contract's documentQueryParams and slice constants.
    static final String GROUP = "group";
    static final String CURSOR = "cursor";
    static final String LIMIT = "limit";
    static final int DEFAULT_LIMIT = 50;
    static final int MAXIMUM_LIMIT = 200;
    static final Set<String> ASK_DECISIONS = Set.of("Pending", "Approved", "Denied", "Withdrawn");

    public static DocumentSearch parse(Map<String, String> params,
            List<PropertyDefinitions.Definition> definitions) {
        String rawLimit = params.get(LIMIT);
        int limit = DEFAULT_LIMIT;
        try {
            int candidate = Integer.parseInt(rawLimit);
            if (candidate > 0 && candidate <= MAXIMUM_LIMIT) {
                limit = candidate;
            }
        } catch (NumberFormatException | NullPointerException ignored) {
            // Invalid slice controls use the contract default.
        }
        Grouping grouping = switch (params.getOrDefault(GROUP, "")) {
            case "batch" -> Grouping.BATCH;
            case "project" -> Grouping.PROJECT;
            default -> null;
        };
        return new DocumentSearch(trimmed(params.get(CURSOR)), limit, grouping,
                trimmed(params.get(DocumentField.SEARCH.queryName())),
                list(params.get(DocumentField.STATUSES.queryName()), Set.of("WaitingForReview",
                    "NotAccepted", "Withdrawn", "BeingAdded", "BeingChecked",
                    "WaitingToBeScheduled", "Scheduled", "Available", "OnHold", "NotAvailable")),
                params.get(DocumentField.MINE.queryName()) != null
                    && params.get(DocumentField.MINE.queryName()).equals("1"),
                list(params.get(DocumentField.DECISIONS.queryName()), ASK_DECISIONS),
                list(params.get(DocumentField.PROGRESS.queryName()), Set.of("Enqueued", "IngestFailed",
                    "Ready", "Planned", "InProgress", "Digitized", "Published")),
                list(params.get(DocumentField.VALIDATIONS.queryName()),
                    Set.of("Needed", "Denied", "Approved", "NotRequired")),
                list(params.get(DocumentField.FORBIDDEN.queryName()), Set.of("Yes", "No")),
                list(params.get(DocumentField.CANCELLED.queryName()), Set.of("Yes", "No")),
                identifiers(params.get(DocumentField.CATEGORY_IDS.queryName())),
                identifiers(params.get(DocumentField.PROJECT_IDS.queryName())),
                list(params.get(DocumentField.PRIORITIES.queryName()),
                    Set.of("Low", "Normal", "High", "Urgent")),
                list(params.get(DocumentField.EXISTING_COPIES.queryName()), Set.of("CheckFailed", "Unmapped",
                    "Planned", "InProgress", "Digitized", "Published", "None")),
                identifiers(params.get(DocumentField.ASKER_IDS.queryName())),
                ValueRange.parseRange(params.get(DocumentField.PAGES.queryName()), ValueRange::parseCount),
                ValueRange.parseDayRange(params.get(DocumentField.ASKED.queryName())),
                properties(params, definitions));
    }

    private static String trimmed(String raw) {
        return raw == null || raw.trim().isEmpty() ? null : raw.trim();
    }

    private static List<String> identifiers(String raw) {
        return list(raw, null);
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

    private static Map<String, PropertyCondition> properties(Map<String, String> params,
            List<PropertyDefinitions.Definition> definitions) {
        Map<String, PropertyCondition> result = new LinkedHashMap<>();
        for (PropertyDefinitions.Definition definition : definitions) {
            String base = DocumentField.PROPERTIES.queryName() + definition.key();
            String raw = params.get(base);
            String starts = trimmed(params.get(base + ".starts"));
            String ends = trimmed(params.get(base + ".ends"));
            boolean noValue = "1".equals(params.get(base + ".none"));
            String contains = null;
            Range<BigDecimal> numbers = null;
            DayRange days = null;
            List<String> values = List.of();
            if (raw != null) {
                switch (definition.type()) {
                    case TEXT -> contains = trimmed(raw);
                    case NUMBER -> numbers = ValueRange.parseRange(raw, DocumentSearch::decimal);
                    case DATE -> days = ValueRange.parseDayRange(raw);
                    case ENUM, YES_NO -> values = list(raw, Set.copyOf(definition.values()));
                }
            }
            if (definition.type() != PropertyType.TEXT) {
                starts = null;
                ends = null;
            }
            if (noValue || contains != null || starts != null || ends != null || numbers != null
                    || days != null || !values.isEmpty()) {
                result.put(definition.key(), new PropertyCondition(noValue, contains, starts, ends,
                        numbers, days, values));
            }
        }
        return Map.copyOf(result);
    }

    private static BigDecimal decimal(String value) {
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}

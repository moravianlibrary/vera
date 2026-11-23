package cz.mzk.vera.intentions;

import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// UI-filters on Intentions, as the board applies them, for a watchlist on it (WATCH-model): rows
// are intentions, templates are repeats.
public final class IntentionFilters {
    private static final String NO_MIX = "__no_mix__";
    private static final String ANY_PROJECT_FUNDING = "__project_funding__";
    private static final String NO_PROJECT_FUNDING = "__no_project_funding__";
    private static final List<String> KINDS = List.of("Target", "Output", "Repeat");
    private static final List<String> STATES = List.of("Running", "Upcoming", "Ended", "Archived");
    private static final List<String> PACES = List.of("OutOfBand", "behindPace", "short", "onPace",
            "fullyPlanned", "targetMet", "NoPace");
    private static final List<String> INTERVALS = List.of("week", "month", "quarter");

    private IntentionFilters() {}

    private record Query(String search, List<String> kinds, List<String> states, List<String> paces,
            List<String> intervals, List<String> mixes, List<String> projects, DayRange starts,
            DayRange ends, Range<Long> planned, Range<Long> delivered, Range<Long> timeElapsed) {}

    // index as IntentionReads.overview() answers it; the answer keeps its shape.
    public static Map<String, Object> matchingIntentions(Map<String, Object> index,
            Map<String, String> parameters) {
        Query query = parse(parameters);
        LocalDate today = LocalDate.parse((String) index.get("asOf"));
        List<Map<String, Object>> rows = maps(index.get("rows")).stream()
                .filter(row -> matchesRow(row, query, today)).toList();
        List<Map<String, Object>> templates = maps(index.get("templates")).stream()
                .filter(row -> matchesTemplate(map(row.get("template")), query, today)).toList();
        Map<String, Object> result = new LinkedHashMap<>(index);
        result.put("rows", rows);
        result.put("templates", templates);
        return result;
    }

    private static Query parse(Map<String, String> parameters) {
        String search = parameters.get("q");
        List<String> projects = idsOf(parameters.get("project"));
        if (projects == null) {
            String funding = parameters.get("funding");
            projects = "none".equals(funding) ? List.of(NO_PROJECT_FUNDING)
                    : "project".equals(funding) ? List.of(ANY_PROJECT_FUNDING) : null;
        }
        return new Query(search == null || search.isBlank() ? null : search.trim(),
                valuesOf(parameters.get("type"), KINDS), valuesOf(parameters.get("state"), STATES),
                valuesOf(parameters.get("pace"), PACES), valuesOf(parameters.get("every"), INTERVALS),
                idsOf(parameters.get("mix")), projects,
                ValueRange.parseDayRange(parameters.get("starts")),
                ValueRange.parseDayRange(parameters.get("ends")),
                ValueRange.parseRange(parameters.get("planned"), ValueRange::parseCount),
                ValueRange.parseRange(parameters.get("delivered"), ValueRange::parseCount),
                ValueRange.parseRange(parameters.get("elapsed"), ValueRange::parseCount));
    }

    private static boolean matchesRow(Map<String, Object> row, Query query, LocalDate today) {
        Map<String, Object> intention = map(row.get("intention"));
        Integer target = (Integer) intention.get("targetPages");
        Double elapsed = row.get("timeElapsed") == null ? null : ((Number) row.get("timeElapsed")).doubleValue();
        return picked(query.kinds(), target == null ? "Output" : "Target")
                && matchesSearch(intention.get("name") + " " + intention.get("description"), query.search())
                && picked(query.states(), intention.get("archived") == null ? (String) row.get("state") : "Archived")
                && pickedAny(query.paces(), paceValuesOf(row))
                && query.intervals() == null
                && picked(query.mixes(), orNoMix(intention.get("distributionId")))
                && matchesProject(query.projects(), map(intention.get("funding")), (String) intention.get("projectId"))
                && matchDay((String) intention.get("countsFrom"), query.starts(), today)
                && matchDay((String) intention.get("endsOn"), query.ends(), today)
                && matchPercent(percentOf(row.get("plannedPages"), target), query.planned())
                && matchPercent(percentOf(row.get("deliveredPages"), target), query.delivered())
                && matchPercent(elapsed == null ? null : Math.round(elapsed * 100), query.timeElapsed());
    }

    private static boolean matchesTemplate(Map<String, Object> template, Query query, LocalDate today) {
        return picked(query.kinds(), "Repeat")
                && matchesSearch((String) template.get("namePattern"), query.search())
                && query.states() == null
                && query.paces() == null
                && picked(query.intervals(), (String) template.get("every"))
                && picked(query.mixes(), orNoMix(template.get("distributionId")))
                && matchesProject(query.projects(), map(template.get("funding")), null)
                && matchDay((String) template.get("since"), query.starts(), today)
                && query.ends() == null
                && query.planned() == null
                && query.delivered() == null
                && query.timeElapsed() == null;
    }

    private static List<String> paceValuesOf(Map<String, Object> row) {
        List<String> values = new ArrayList<>();
        if (((Number) row.get("outOfBandCount")).intValue() > 0) {
            values.add("OutOfBand");
        }
        if (row.get("verdict") != null) {
            values.add((String) row.get("verdict"));
        }
        if (values.isEmpty()) {
            values.add("NoPace");
        }
        return values;
    }

    private static boolean matchesProject(List<String> selected, Map<String, Object> funding,
            String ownProjectId) {
        if (selected == null) {
            return true;
        }
        String kind = (String) funding.get("kind");
        String projectId = ownProjectId != null ? ownProjectId
                : "project".equals(kind) ? (String) funding.get("projectId") : null;
        return selected.stream().anyMatch(value -> switch (value) {
            case NO_PROJECT_FUNDING -> "none".equals(kind);
            case ANY_PROJECT_FUNDING -> "project".equals(kind);
            default -> value.equals(projectId);
        });
    }

    private static boolean matchDay(String value, DayRange range, LocalDate today) {
        if (range == null) {
            return true;
        }
        if (value == null) {
            return false;
        }
        Range<String> resolved = ValueRange.resolveDayRange(range, today);
        return !ValueRange.isReversedRange(resolved) && ValueRange.isWithinRange(value, resolved);
    }

    private static boolean matchPercent(Long value, Range<Long> range) {
        return range == null
                || value != null && !ValueRange.isReversedRange(range) && ValueRange.isWithinRange(value, range);
    }

    private static Long percentOf(Object pages, Integer target) {
        return target == null ? null : Math.round(((Number) pages).doubleValue() / target * 100);
    }

    private static boolean matchesSearch(String text, String search) {
        return search == null || text.toLowerCase(Locale.ROOT).contains(search.toLowerCase(Locale.ROOT));
    }

    private static boolean picked(List<String> selected, String value) {
        return selected == null || value != null && selected.contains(value);
    }

    private static boolean pickedAny(List<String> selected, List<String> values) {
        return selected == null || values.stream().anyMatch(selected::contains);
    }

    private static String orNoMix(Object distributionId) {
        return distributionId == null ? NO_MIX : (String) distributionId;
    }

    private static List<String> valuesOf(String raw, List<String> allowed) {
        List<String> values = idsOf(raw);
        if (values == null) {
            return null;
        }
        List<String> picked = values.stream().filter(allowed::contains).toList();
        return picked.isEmpty() ? null : picked;
    }

    private static List<String> idsOf(String raw) {
        if (raw == null) {
            return null;
        }
        List<String> values = Arrays.stream(raw.split(",")).map(String::trim).filter(value -> !value.isEmpty())
                .distinct().toList();
        return values.isEmpty() ? null : values;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> maps(Object value) {
        return (List<Map<String, Object>>) value;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }
}

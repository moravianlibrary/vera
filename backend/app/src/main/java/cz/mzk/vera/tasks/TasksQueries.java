package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.RUN_ERRORS;
import static cz.mzk.vera.db.tables.Tables.RUN_ITEMS;
import static cz.mzk.vera.db.tables.Tables.RUN_LOG;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.SCHEDULES;
import static cz.mzk.vera.db.tables.Tables.TASK_RETENTION;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.trueCondition;
import static cz.mzk.vera.domain.permissions.Permissions.hasPermission;

import cz.mzk.vera.domain.schedules.Schedules;
import cz.mzk.vera.domain.Names;
import cz.mzk.vera.web.RequestLanguage;
import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ENT-run; ENT-schedule; PLG-run-items.
@Repository
public class TasksQueries {
    private static final int LISTED_ITEMS = 6;
    private static final int TILE_DAYS = 7;
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final Clock clock;
    private final JsonMapper json;

    public TasksQueries(DSLContext dsl, HeldAccessQueries access, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.clock = clock;
        this.json = json;
    }

    public boolean canRead(String userId) {
        List<Grant> grants = access.heldBy(userId).grants();
        return hasPermission(grants, "task.read") || hasPermission(grants, "task.read_own");
    }

    public boolean canReadAll(String userId) {
        return hasPermission(access.heldBy(userId).grants(), "task.read");
    }

    public Map<String, Object> index(String userId, Map<String, String> parameters) {
        Instant now = clock.instant();
        List<Record> visible = visibleRows(userId, now);
        List<Record> matching = visible.stream().filter(row -> matches(row, parameters, now)).toList();
        List<Record> running = matching.stream().filter(row -> row.get(RUNS.STATE).equals("Running")).toList();
        List<Record> finished = matching.stream().filter(row -> !row.get(RUNS.STATE).equals("Running")).toList();
        List<Record> recent = visible.stream().filter(row -> !row.get(RUNS.STATE).equals("Running"))
                .filter(row -> row.get(RUNS.STARTED_AT).toInstant().isAfter(now.minus(TILE_DAYS, ChronoUnit.DAYS)))
                .toList();
        Record lastFailure = visible.stream().filter(row -> row.get(RUNS.STATE).equals("Failed"))
                .findFirst().orElse(null);
        List<Map<String, Object>> next = canReadAll(userId) ? nextRuns(now) : List.of();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("asOf", Instants.format(now));
        result.put("running", running.stream().map(row -> run(row, now)).toList());
        result.put("finished", finished.stream().map(row -> run(row, now)).toList());
        result.put("visibleCount", visible.size());
        Map<String, Object> tiles = new LinkedHashMap<>();
        tiles.put("runningCount", visible.stream().filter(row -> row.get(RUNS.STATE).equals("Running")).count());
        tiles.put("failedCount", recent.stream().filter(row -> row.get(RUNS.STATE).equals("Failed")).count());
        tiles.put("withErrorsCount", recent.stream().filter(row -> row.get(RUNS.STATE).equals("DoneWithErrors")).count());
        tiles.put("finishedCount", recent.stream().filter(row -> Set.of("Done", "DoneWithErrors")
                .contains(row.get(RUNS.STATE))).count());
        tiles.put("lastFailureAt", lastFailure == null ? null : Instants.format(lastFailure.get(RUNS.STARTED_AT).toInstant()));
        tiles.put("nextRun", next.isEmpty() ? null : Map.of("at", next.getFirst().get("at"), "name", next.getFirst().get("name")));
        result.put("tiles", tiles);
        result.put("nextRuns", next);
        result.put("facets", facets(visible, parameters, now));
        Record retention = retention();
        result.put("retention", retentionMap(retention));
        if (canReadAll(userId)) {
            Map<String, Object> schedules = new LinkedHashMap<>();
            schedules.put("activeCount", dsl.fetchCount(SCHEDULES, SCHEDULES.PAUSED_BY.isNull()));
            schedules.put("pausedCount", dsl.fetchCount(SCHEDULES, SCHEDULES.PAUSED_BY.isNotNull()));
            result.put("schedules", schedules);
        } else {
            result.put("schedules", null);
        }
        return result;
    }

    public Map<String, Object> running(String userId) {
        Instant now = clock.instant();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("asOf", Instants.format(now));
        result.put("runs", visibleRows(userId, now).stream()
                .filter(row -> row.get(RUNS.STATE).equals("Running"))
                .map(row -> run(row, now)).toList());
        return result;
    }

    public Map<String, Object> detail(String userId, String id) {
        Instant now = clock.instant();
        Record row = visibleRows(userId, now).stream().filter(candidate -> candidate.get(RUNS.ID).equals(id))
                .findFirst().orElse(null);
        if (row == null) {
            return null;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("asOf", Instants.format(now));
        result.put("run", run(row, now));
        List<Map<String, Object>> items = dsl.select(RUN_ITEMS.ITERATION_ID, RUN_ITEMS.ERROR, DOCUMENTS.TITLE)
                .from(RUN_ITEMS).join(ITERATIONS).on(ITERATIONS.ID.eq(RUN_ITEMS.ITERATION_ID))
                .join(DOCUMENTS).on(DOCUMENTS.ID.eq(ITERATIONS.DOCUMENT_ID))
                .where(RUN_ITEMS.RUN_ID.eq(id)).orderBy(RUN_ITEMS.POSITION).fetch(r -> item(
                        r.get(RUN_ITEMS.ITERATION_ID), r.get(DOCUMENTS.TITLE), r.get(RUN_ITEMS.ERROR)));
        List<Map<String, Object>> errors = items.stream().filter(item -> item.get("error") != null).toList();
        result.put("errors", errors);
        result.put("items", items);
        result.put("log", log(row, now));
        return result;
    }

    public String logText(String userId, String id) {
        Instant now = clock.instant();
        Record row = visibleRun(userId, id, now);
        if (row == null) {
            return null;
        }
        return log(row, now).stream().map(line -> "[" + line.get("at") + "] " + line.get("text"))
                .collect(Collectors.joining("\n"));
    }

    public Record visibleRun(String userId, String id, Instant now) {
        return visibleRows(userId, now).stream().filter(row -> row.get(RUNS.ID).equals(id))
                .findFirst().orElse(null);
    }

    public Map<String, Object> run(Record row, Instant now) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.get(RUNS.ID));
        result.put("what", row.get(RUNS.WHAT));
        JsonNode trigger = read(row.get(RUNS.TRIGGER).data());
        String instanceId = row.get(RUNS.INSTANCE_ID);
        if (instanceId == null) {
            Map<String, Object> source = new LinkedHashMap<>();
            source.put("kind", "core");
            source.put("name", row.get(RUNS.CORE_NAME) == null ? "VERA" : row.get(RUNS.CORE_NAME));
            result.put("source", source);
        } else {
            Record instance = dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME, PLUGIN_INSTANCES.NAMES,
                    PLUGIN_IMPLEMENTATIONS.NAME, PLUGIN_IMPLEMENTATIONS.KIND, PLUGIN_INSTANCES.IS_ENABLED)
                    .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                    .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                    .where(PLUGIN_INSTANCES.ID.eq(instanceId)).fetchOne();
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("id", instance.get(PLUGIN_INSTANCES.ID));
            JsonNode localizedNames = read(instance.get(PLUGIN_INSTANCES.NAMES).data());
            Map<String, String> nameMap = new LinkedHashMap<>();
            localizedNames.properties().forEach(entry -> nameMap.put(entry.getKey(), entry.getValue().asString()));
            summary.put("name", Names.nameIn(nameMap, RequestLanguage.current()));
            summary.put("names", localizedNames);
            summary.put("plugin", instance.get(PLUGIN_IMPLEMENTATIONS.NAME));
            summary.put("kind", instance.get(PLUGIN_IMPLEMENTATIONS.KIND));
            summary.put("isEnabled", instance.get(PLUGIN_INSTANCES.IS_ENABLED));
            Map<String, Object> source = new LinkedHashMap<>();
            source.put("kind", "plugin");
            source.put("instance", summary);
            result.put("source", source);
        }
        result.put("trigger", trigger);
        result.put("startedBy", row.get(RUNS.STARTED_BY));
        String state = row.get(RUNS.STATE);
        result.put("state", state);
        result.put("startedAt", Instants.format(row.get(RUNS.STARTED_AT).toInstant()));
        result.put("finishedAt", row.get(RUNS.FINISHED_AT) == null ? null
                : Instants.format(row.get(RUNS.FINISHED_AT).toInstant()));
        int itemCount = row.get(RUNS.ITEM_COUNT);
        int done = row.get(RUNS.DONE_COUNT);
        result.put("itemCount", itemCount);
        result.put("doneCount", done);
        int errors = dsl.fetchCount(RUN_ERRORS, RUN_ERRORS.RUN_ID.eq(row.get(RUNS.ID)));
        result.put("errorCount", errors);
        Double pace = row.get(RUNS.ITEMS_PER_MINUTE);
        result.put("secondsLeft", state.equals("Running") && pace != null
                ? (int) Math.ceil(((itemCount - done) / pace) * 60 - 1e-9) : null);
        result.put("changes", state.equals("Running") ? null
                : Set.of("Done", "DoneWithErrors").contains(state) ? read(row.get(RUNS.CHANGES).data()) : List.of());
        result.put("failure", row.get(RUNS.FAILURE));
        result.put("note", row.get(RUNS.NOTE));
        result.put("cancelledBy", row.get(RUNS.CANCELLED_BY));
        result.put("rerunOf", row.get(RUNS.RERUN_OF));
        result.put("isRerunnable", instanceId != null);
        return result;
    }

    public Record retention() {
        return dsl.selectFrom(TASK_RETENTION).where(TASK_RETENTION.ID.eq(1)).fetchOne();
    }

    public Map<String, Object> retentionMap(Record row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("days", row.get(TASK_RETENTION.DAYS));
        result.put("failedDays", row.get(TASK_RETENTION.FAILED_DAYS));
        return result;
    }

    private List<Record> visibleRows(String userId, Instant now) {
        boolean all = canReadAll(userId);
        Record retention = retention();
        List<Record> result = new ArrayList<>();
        dsl.selectFrom(RUNS)
                .where(all ? trueCondition() : RUNS.STARTED_BY.eq(userId))
                .and(RUNS.STARTED_AT.ge(now.minus(retention.get(TASK_RETENTION.FAILED_DAYS), ChronoUnit.DAYS)
                        .atOffset(ZoneOffset.UTC)))
                .orderBy(RUNS.STARTED_AT.desc(), RUNS.ID.desc())
                .fetch().forEach(row -> {
                    int days = Set.of("Failed", "Cancelled").contains(row.getState())
                            ? retention.get(TASK_RETENTION.FAILED_DAYS) : retention.get(TASK_RETENTION.DAYS);
                    if (!row.getStartedAt().toInstant().isBefore(now.minus(days, ChronoUnit.DAYS))) {
                        result.add(row);
                    }
                });
        return result;
    }

    private boolean matches(Record row, Map<String, String> query, Instant now) {
        String search = query.get("q");
        if (search != null && !search.isBlank() && !row.get(RUNS.WHAT).toLowerCase().contains(search.trim().toLowerCase())
                && !row.get(RUNS.ID).toLowerCase().contains(search.trim().toLowerCase())) {
            return false;
        }
        if (!listMatches(query.get("state"), row.get(RUNS.STATE))) {
            return false;
        }
        JsonNode trigger = read(row.get(RUNS.TRIGGER).data());
        if (!listMatches(query.get("trigger"), trigger.path("kind").asString())) {
            return false;
        }
        if (query.containsKey("plugin") && !listMatches(query.get("plugin"), row.get(RUNS.INSTANCE_ID))) {
            return false;
        }
        if (query.containsKey("by") && !listMatches(query.get("by"), row.get(RUNS.STARTED_BY))) {
            return false;
        }
        String started = query.get("started");
        if (started != null) {
            DayRange range = ValueRange.parseDayRange(started);
            if (range != null) {
                Range<String> resolved = ValueRange.resolveDayRange(range,
                        now.atZone(ZoneId.of("Europe/Prague")).toLocalDate());
                String day = row.get(RUNS.STARTED_AT).toInstant().atZone(ZoneId.of("Europe/Prague"))
                        .toLocalDate().toString();
                if (ValueRange.isReversedRange(resolved) || !ValueRange.isWithinRange(day, resolved)) {
                    return false;
                }
            }
        }
        return true;
    }

    public boolean matchesForHook(Map<String, String> parameters, String runId) {
        Instant now = clock.instant();
        Record row = dsl.selectFrom(RUNS).where(RUNS.ID.eq(runId)).fetchOne();
        return row != null && matches(row, parameters, now);
    }

    private Map<String, Object> facets(List<Record> visible, Map<String, String> query, Instant now) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("states", facet(visible, query, now, "state"));
        result.put("triggers", facet(visible, query, now, "trigger"));
        result.put("instanceIds", facet(visible, query, now, "plugin"));
        result.put("startedBy", facet(visible, query, now, "by"));
        return result;
    }

    private List<Map<String, Object>> facet(List<Record> visible, Map<String, String> query,
            Instant now, String field) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        String param = switch (field) {
            case "state" -> "state";
            case "trigger" -> "trigger";
            case "plugin" -> "plugin";
            default -> "by";
        };
        for (Record row : visible) {
            if (!matchesWithout(query, row, now, param)) {
                continue;
            }
            String value = switch (field) {
                case "state" -> row.get(RUNS.STATE);
                case "trigger" -> read(row.get(RUNS.TRIGGER).data()).path("kind").asString();
                case "plugin" -> row.get(RUNS.INSTANCE_ID);
                default -> row.get(RUNS.STARTED_BY);
            };
            if (value != null) {
                counts.merge(value, 1, Integer::sum);
            }
        }
        return counts.entrySet().stream().map(entry -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("value", entry.getKey());
            item.put("count", entry.getValue());
            return item;
        }).toList();
    }

    private boolean matchesWithout(Map<String, String> query, Record row, Instant now, String skip) {
        Map<String, String> adjusted = new LinkedHashMap<>(query);
        adjusted.remove(skip);
        return matches(row, adjusted, now);
    }

    private List<Map<String, Object>> nextRuns(Instant now) {
        List<Map<String, Object>> result = new ArrayList<>();
        dsl.selectFrom(SCHEDULES).where(SCHEDULES.PAUSED_BY.isNull()).fetch().forEach(row -> {
            Instant at = Schedules.nextOccurrenceOf(map(read(row.getCadence().data())), now,
                    ZoneId.of("Europe/Prague"));
            if (at != null) {
                result.add(next(row.getName(), at, "/schedules?s=" + row.getId()));
            }
        });
        dsl.selectFrom(INTENTION_TEMPLATES).fetch().forEach(row -> {
            String period = switch (row.getEvery()) {
                case "week" -> "next period";
                case "month" -> "next period";
                default -> "next period";
            };
            String name = row.getNamePattern().replace("{period}", period);
            Instant computed = Schedules.nextOccurrenceOf(Schedules.repeatCadenceOf(row.getEvery()), now,
                    ZoneId.of("Europe/Prague"));
            Instant queued = row.getNextOn().atStartOfDay(ZoneId.of("Europe/Prague")).toInstant();
            if (!computed.equals(queued)) {
                throw new IllegalStateException("Queued repeat differs from its cadence for " + row.getId());
            }
            result.add(next(name, queued, "/intentions?t=" + row.getId()));
        });
        result.sort(Comparator.comparing(item -> Instant.parse((String) item.get("at"))));
        return result;
    }

    private Map<String, Object> next(String name, Instant at, String path) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", name);
        result.put("at", Instants.format(at));
        result.put("path", path);
        return result;
    }

    private List<Map<String, Object>> log(Record run, Instant now) {
        String id = run.get(RUNS.ID);
        List<Map<String, Object>> result = dsl.selectFrom(RUN_LOG)
                .where(RUN_LOG.RUN_ID.eq(id))
                .orderBy(RUN_LOG.POSITION)
                .fetch(row -> logLine(row.getAt().toInstant(), row.getText(), row.getIsError()));
        if (run.get(RUNS.STATE).equals("Skipped")) {
            return result;
        }
        Instant ended = run.get(RUNS.FINISHED_AT) == null
                ? now : run.get(RUNS.FINISHED_AT).toInstant();
        String failure = run.get(RUNS.FAILURE);
        if (failure != null) {
            result.add(logLine(ended, failure, true));
        }
        int done = run.get(RUNS.DONE_COUNT);
        result.add(logLine(ended, done + " of " + run.get(RUNS.ITEM_COUNT) + " processed", false));
        String state = run.get(RUNS.STATE);
        if (Set.of("Done", "DoneWithErrors").contains(state)) {
            JsonNode changes = read(run.get(RUNS.CHANGES).data());
            for (JsonNode change : changes) {
                result.add(logLine(ended, "changed: " + change.path("label").asString(), false));
            }
        }
        if (state.equals("Cancelled")) {
            String cancelledBy = run.get(RUNS.CANCELLED_BY);
            String name = cancelledBy == null ? "VERA" : dsl.select(USERS.NAME)
                    .from(USERS)
                    .where(USERS.ID.eq(cancelledBy))
                    .limit(1)
                    .fetchOne(USERS.NAME);
            result.add(logLine(ended, "cancelled by " + (name == null ? cancelledBy : name), false));
        }
        String stateText = state.equals("Running")
                ? "… running" : "finished — " + stateWords(state);
        result.add(logLine(ended, stateText, false));
        return result;
    }

    private String stateWords(String state) {
        return switch (state) {
            case "Done" -> "done";
            case "DoneWithErrors" -> "done with errors";
            case "Failed" -> "failed";
            case "Cancelled" -> "cancelled";
            default -> "skipped";
        };
    }

    private Map<String, Object> logLine(Instant at, String text, boolean error) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("at", Instants.format(at));
        result.put("text", text);
        result.put("isError", error);
        return result;
    }

    private Map<String, Object> item(String id, String title, String error) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("iterationId", id);
        result.put("title", title);
        result.put("error", error);
        return result;
    }

    private boolean listMatches(String raw, String value) {
        if (raw == null) {
            return true;
        }
        return value != null && List.of(raw.split(",")).contains(value);
    }

    private JsonNode read(String value) {
        return json.readTree(value);
    }

    private Map<String, Object> map(JsonNode value) {
        Map<String, Object> result = new LinkedHashMap<>();
        value.properties().forEach(entry -> result.put(entry.getKey(), entry.getValue().isNumber()
                ? entry.getValue().numberValue() : entry.getValue().asString()));
        return result;
    }
}

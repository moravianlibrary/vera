package cz.mzk.vera.tasks;

import static cz.mzk.vera.domain.permissions.Permissions.hasPermission;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.SCHEDULES;
import static cz.mzk.vera.db.tables.Tables.RUN_ERRORS;

import cz.mzk.vera.domain.schedules.Schedules;
import cz.mzk.vera.domain.Names;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Instants;
import cz.mzk.vera.web.RequestLanguage;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ENT-schedule; L26: repeat rows reflect the intention templates' queued dates.
@Repository
public class ScheduleReads {
    private static final int LISTED_RUN_CEILING = 60;
    private static final int OCCURRENCE_CEILING = 10_000;
    private static final Map<String, Integer> RANGE_DAYS = Map.of("day", 1, "week", 7, "month", 30);
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final Clock clock;
    private final JsonMapper json;
    private final ScheduleQueue queue;

    public ScheduleReads(DSLContext dsl, HeldAccessQueries access, Clock clock,
            JsonMapper json, ScheduleQueue queue) {
        this.dsl = dsl;
        this.access = access;
        this.clock = clock;
        this.json = json;
        this.queue = queue;
    }

    public boolean canRead(String userId) {
        return hasPermission(access.heldBy(userId).grants(), "task.read");
    }

    public Map<String, Object> row(String id) {
        Instant now = clock.instant();
        Instant end = now;
        Record plugin = dsl.select(SCHEDULES.ID, SCHEDULES.NAME, SCHEDULES.NAMES, SCHEDULES.CADENCE, SCHEDULES.OVERLAP,
                        SCHEDULES.PAUSED_BY, SCHEDULES.PAUSED_AT, SCHEDULES.PAUSE_REASON,
                        SCHEDULES.CREATED_BY, SCHEDULES.SINCE, PLUGIN_INSTANCES.ID,
                        PLUGIN_INSTANCES.NAME, PLUGIN_INSTANCES.NAMES, PLUGIN_INSTANCES.IS_ENABLED,
                        PLUGIN_IMPLEMENTATIONS.NAME, PLUGIN_IMPLEMENTATIONS.KIND)
                .from(SCHEDULES).join(PLUGIN_INSTANCES).on(PLUGIN_INSTANCES.ID.eq(SCHEDULES.INSTANCE_ID))
                .join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(SCHEDULES.ID.eq(id)).fetchOne();
        return plugin == null ? null : pluginRow(plugin, now, end);
    }

    public Map<String, Object> index(String range) {
        String selected = RANGE_DAYS.containsKey(range) ? range : "day";
        Instant now = clock.instant();
        Instant end = now.plus(RANGE_DAYS.get(selected), ChronoUnit.DAYS);
        List<Map<String, Object>> rows = new ArrayList<>();
        dsl.select(SCHEDULES.ID, SCHEDULES.NAME, SCHEDULES.NAMES, SCHEDULES.CADENCE, SCHEDULES.OVERLAP,
                        SCHEDULES.PAUSED_BY, SCHEDULES.PAUSED_AT, SCHEDULES.PAUSE_REASON,
                        SCHEDULES.CREATED_BY, SCHEDULES.SINCE, PLUGIN_INSTANCES.ID,
                        PLUGIN_INSTANCES.NAME, PLUGIN_INSTANCES.NAMES, PLUGIN_INSTANCES.IS_ENABLED,
                        PLUGIN_IMPLEMENTATIONS.NAME, PLUGIN_IMPLEMENTATIONS.KIND)
                .from(SCHEDULES).join(PLUGIN_INSTANCES).on(PLUGIN_INSTANCES.ID.eq(SCHEDULES.INSTANCE_ID))
                .join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .orderBy(SCHEDULES.POSITION).fetch(row -> rows.add(pluginRow(row, now, end)));
        dsl.selectFrom(INTENTION_TEMPLATES).orderBy(INTENTION_TEMPLATES.ID)
                .fetch(row -> rows.add(repeatRow(row, now, end)));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("asOf", Instants.format(now));
        result.put("range", selected);
        result.put("windowEnd", Instants.format(end));
        result.put("schedules", rows);
        result.put("runningCount", dsl.fetchCount(RUNS, RUNS.STATE.eq("Running")));
        return result;
    }

    private Map<String, Object> pluginRow(Record row, Instant now, Instant end) {
        Map<String, Object> instance = new LinkedHashMap<>();
        instance.put("id", row.get(PLUGIN_INSTANCES.ID));
        instance.put("name", localized(row.get(PLUGIN_INSTANCES.NAMES)));
        instance.put("names", node(row.get(PLUGIN_INSTANCES.NAMES)));
        instance.put("plugin", row.get(PLUGIN_IMPLEMENTATIONS.NAME));
        instance.put("kind", row.get(PLUGIN_IMPLEMENTATIONS.KIND));
        instance.put("isEnabled", row.get(PLUGIN_INSTANCES.IS_ENABLED));
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("kind", "plugin");
        source.put("instance", instance);
        Map<String, Object> pause = null;
        if (row.get(SCHEDULES.PAUSED_BY) != null) {
            pause = new LinkedHashMap<>();
            pause.put("pausedBy", row.get(SCHEDULES.PAUSED_BY));
            pause.put("pausedAt", Instants.format(row.get(SCHEDULES.PAUSED_AT).toInstant()));
            pause.put("reason", row.get(SCHEDULES.PAUSE_REASON));
        }
        Map<String, Object> result = row(row.get(SCHEDULES.ID), localized(row.get(SCHEDULES.NAMES)), source,
                map(row.get(SCHEDULES.CADENCE).data()), row.get(SCHEDULES.OVERLAP), pause,
                row.get(SCHEDULES.CREATED_BY), row.get(SCHEDULES.SINCE).toString(),
                row.get(SCHEDULES.PAUSED_BY) != null, now, end);
        result.put("names", node(row.get(SCHEDULES.NAMES)));
        return result;
    }

    private Map<String, Object> repeatRow(Record row, Instant now, Instant end) {
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("kind", "repeat");
        source.put("templateId", row.get(INTENTION_TEMPLATES.ID));
        JsonNode patterns = node(row.get(INTENTION_TEMPLATES.NAME_PATTERNS));
        String name = localized(patterns).replace("{period}", "next period");
        Map<String, Object> names = new LinkedHashMap<>();
        patterns.properties().forEach(entry -> names.put(entry.getKey(),
                entry.getValue().asString().replace("{period}", "next period")));
        Map<String, Object> cadence = Schedules.repeatCadenceOf(row.get(INTENTION_TEMPLATES.EVERY));
        Instant computed = queue.next(cadence, now);
        Instant queued = row.get(INTENTION_TEMPLATES.NEXT_ON)
                .atStartOfDay(ZoneId.of("Europe/Prague")).toInstant();
        if (!queued.equals(computed)) {
            throw new IllegalStateException("Queued repeat differs from its cadence for "
                    + row.get(INTENTION_TEMPLATES.ID));
        }
        Map<String, Object> result = row(row.get(INTENTION_TEMPLATES.ID), name, source, cadence, "skip", null,
                row.get(INTENTION_TEMPLATES.CREATED_BY), row.get(INTENTION_TEMPLATES.SINCE).toString(),
                false, now, end);
        result.put("names", names);
        return result;
    }

    private Map<String, Object> row(String id, String name, Map<String, Object> source,
            Map<String, Object> cadence, String overlap, Map<String, Object> pause,
            String createdBy, String since, boolean paused, Instant now, Instant end) {
        List<? extends Record> runs = dsl.selectFrom(RUNS).orderBy(RUNS.STARTED_AT.desc()).fetch()
                .stream().filter(run -> belongs(run, source, id)).toList();
        Record last = runs.isEmpty() ? null : runs.getFirst();
        List<Instant> window = occurrences(cadence, now, end);
        Map<String, Object> lastRun = null;
        if (last != null) {
            lastRun = new LinkedHashMap<>();
            lastRun.put("id", last.get(RUNS.ID));
            lastRun.put("state", last.get(RUNS.STATE));
            lastRun.put("startedAt", Instants.format(last.get(RUNS.STARTED_AT).toInstant()));
            lastRun.put("errorCount", dsl.fetchCount(RUN_ERRORS, RUN_ERRORS.RUN_ID.eq(last.get(RUNS.ID))));
        }
        Map<String, Object> timeline = new LinkedHashMap<>();
        timeline.put("runCount", paused ? 0 : window.size());
        timeline.put("runsAt", paused || window.size() > LISTED_RUN_CEILING
                ? List.of() : window.stream().map(Instants::format).toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("name", name);
        result.put("source", source);
        result.put("cadence", cadence);
        result.put("overlap", overlap);
        result.put("pause", pause);
        result.put("createdBy", createdBy);
        result.put("since", since);
        result.put("lastRun", lastRun);
        result.put("nextAt", paused ? null : scheduleNextAt(id, source));
        result.put("runCount", runs.size());
        result.put("window", timeline);
        return result;
    }

    private String scheduleNextAt(String id, Map<String, Object> source) {
        if ("repeat".equals(source.get("kind"))) {
            Record template = dsl.select(INTENTION_TEMPLATES.NEXT_ON).from(INTENTION_TEMPLATES)
                    .where(INTENTION_TEMPLATES.ID.eq(id)).fetchOne();
            return Instants.format(template.get(INTENTION_TEMPLATES.NEXT_ON)
                    .atStartOfDay(ZoneId.of("Europe/Prague")).toInstant());
        }
        Record schedule = dsl.select(SCHEDULES.NEXT_AT).from(SCHEDULES)
                .where(SCHEDULES.ID.eq(id)).fetchOne();
        return Instants.format(schedule.get(SCHEDULES.NEXT_AT).toInstant());
    }

    private boolean belongs(Record run, Map<String, Object> source, String id) {
        JsonNode trigger = json.readTree(run.get(RUNS.TRIGGER).data());
        String kind = trigger.path("kind").asString();
        return "plugin".equals(source.get("kind"))
                ? "schedule".equals(kind) && id.equals(trigger.path("scheduleId").asString())
                : "repeat".equals(kind) && id.equals(trigger.path("templateId").asString());
    }

    private List<Instant> occurrences(Map<String, Object> cadence, Instant from, Instant to) {
        List<Instant> found = new ArrayList<>();
        Instant cursor = from.minusMillis(2);
        while (found.size() < OCCURRENCE_CEILING) {
            Instant next = queue.next(cadence, cursor);
            if (next == null || !next.isBefore(to)) {
                break;
            }
            found.add(next);
            cursor = next;
        }
        return found;
    }

    private Map<String, Object> map(String raw) {
        JsonNode node = json.readTree(raw);
        Map<String, Object> result = new LinkedHashMap<>();
        node.properties().forEach(entry -> result.put(
                entry.getKey(), json.convertValue(entry.getValue(), Object.class)));
        return result;
    }

    private JsonNode node(org.jooq.JSONB value) { return value == null ? null : json.readTree(value.data()); }

    private String localized(org.jooq.JSONB value) { return localized(node(value)); }

    private String localized(JsonNode node) {
        Map<String, String> values = new LinkedHashMap<>();
        if (node != null) node.properties().forEach(entry -> values.put(entry.getKey(), entry.getValue().asString()));
        return Names.nameIn(values, RequestLanguage.current());
    }
}

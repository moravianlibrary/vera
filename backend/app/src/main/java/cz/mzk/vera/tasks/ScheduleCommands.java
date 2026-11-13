package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.SCHEDULES;
import static cz.mzk.vera.domain.permissions.Permissions.hasPermission;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.schedules.Schedules;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-schedule-save; ACT-schedule-pause; ACT-schedule-run; EVENT-code.
@Component
public class ScheduleCommands {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final ScheduleReads reads;
    private final ScheduleQueue queue;
    private final Runs runs;
    private final TasksQueries taskQueries;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;

    public ScheduleCommands(DSLContext dsl, HeldAccessQueries access, ScheduleReads reads,
            ScheduleQueue queue, Runs runs, TasksQueries taskQueries, EventRecorder events,
            Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.reads = reads;
        this.queue = queue;
        this.runs = runs;
        this.taskQueries = taskQueries;
        this.events = events;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    public ActResult create(Caller caller, JsonNode body) {
        if (!maySchedule(caller)) {
            return forbidden();
        }
        String instanceId = body.path("instanceId").asString();
        Record instance = dsl.select(PLUGIN_IMPLEMENTATIONS.KIND, PLUGIN_INSTANCES.NAME)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_INSTANCES.ID.eq(instanceId)).fetchOne();
        if (instance == null
                || !Schedules.schedulableKinds().contains(instance.get(PLUGIN_IMPLEMENTATIONS.KIND))) {
            return ActResult.refused(422, "That plugin runs only while somebody uses it",
                    "schedule.not_schedulable");
        }
        Map<String, Object> cadence = cadence(body.path("cadence"));
        ActResult refusal = cadenceRefusal(cadence);
        if (refusal != null) {
            return refusal;
        }
        String id = "s" + (dsl.select(SCHEDULES.ID).from(SCHEDULES).fetch(SCHEDULES.ID).stream()
                .mapToInt(value -> Integer.parseInt(value.substring(1))).max().orElse(0) + 1);
        int position = dsl.select(SCHEDULES.POSITION).from(SCHEDULES).fetch(SCHEDULES.POSITION).stream()
                .mapToInt(Integer::intValue).max().orElse(-1) + 1;
        Instant nextAt = queue.next(cadence, clock.instant());
        String name = body.path("names").path("en").asString(body.path("names").path("cs").asString()).trim();
        String overlap = body.path("overlap").asString();
        dsl.insertInto(SCHEDULES)
                .set(SCHEDULES.ID, id)
                .set(SCHEDULES.INSTANCE_ID, instanceId)
                .set(SCHEDULES.NAME, name)
                .set(SCHEDULES.NAMES, JSONB.valueOf(body.path("names").toString()))
                .set(SCHEDULES.CADENCE, JSONB.valueOf(json.writeValueAsString(cadence)))
                .set(SCHEDULES.OVERLAP, overlap)
                .set(SCHEDULES.CREATED_BY, caller.userId())
                .set(SCHEDULES.SINCE, LocalDate.ofInstant(clock.instant(), ZoneId.of("Europe/Prague")))
                .set(SCHEDULES.NEXT_AT, nextAt.atOffset(ZoneOffset.UTC))
                .set(SCHEDULES.POSITION, position)
                .execute();
        queue.queueAt(dsl, id, nextAt);
        events.recordAct(EventCode.SCHEDULE_CREATED, "schedule", id, caller, List.of());
        return ActResult.ok(reads.row(id));
    }

    @Transactional
    public ActResult save(Caller caller, String id, JsonNode body) {
        if (!maySchedule(caller)) {
            return forbidden();
        }
        Record old = dsl.selectFrom(SCHEDULES).where(SCHEDULES.ID.eq(id)).fetchOne();
        if (old == null) {
            return ActResult.unknown("schedule");
        }
        Map<String, Object> cadence = cadence(body.path("cadence"));
        ActResult refusal = cadenceRefusal(cadence);
        if (refusal != null) {
            return refusal;
        }
        boolean cadenceChanged = !queue.cadence(old.get(SCHEDULES.CADENCE).data()).equals(cadence);
        Instant nextAt = old.get(SCHEDULES.PAUSED_BY) == null && cadenceChanged
                ? queue.next(cadence, clock.instant()) : old.get(SCHEDULES.NEXT_AT) == null
                        ? null : old.get(SCHEDULES.NEXT_AT).toInstant();
        String name = body.path("names").path("en").asString(body.path("names").path("cs").asString()).trim();
        dsl.update(SCHEDULES).set(SCHEDULES.NAME, name)
                .set(SCHEDULES.NAMES, JSONB.valueOf(body.path("names").toString()))
                .set(SCHEDULES.CADENCE, JSONB.valueOf(json.writeValueAsString(cadence)))
                .set(SCHEDULES.OVERLAP, body.path("overlap").asString())
                .set(SCHEDULES.NEXT_AT, nextAt == null ? null : nextAt.atOffset(ZoneOffset.UTC))
                .where(SCHEDULES.ID.eq(id)).execute();
        if (cadenceChanged && old.get(SCHEDULES.PAUSED_BY) == null) {
            queue.queueAt(dsl, id, nextAt);
        }
        events.recordAct(EventCode.SCHEDULE_CHANGED, "schedule", id, caller, List.of());
        return ActResult.ok(reads.row(id));
    }

    @Transactional
    public ActResult delete(Caller caller, String id) {
        if (!maySchedule(caller)) {
            return forbidden();
        }
        if (dsl.fetchExists(dsl.selectFrom(SCHEDULES).where(SCHEDULES.ID.eq(id))) == false) {
            return ActResult.unknown("schedule");
        }
        dsl.deleteFrom(SCHEDULES).where(SCHEDULES.ID.eq(id)).execute();
        events.recordAct(EventCode.SCHEDULE_DELETED, "schedule", id, caller, List.of());
        return ActResult.noContent();
    }

    @Transactional
    public ActResult pause(Caller caller, String id, String reason) {
        if (!maySchedule(caller)) {
            return forbidden();
        }
        Record row = dsl.selectFrom(SCHEDULES).where(SCHEDULES.ID.eq(id)).fetchOne();
        if (row == null) {
            return ActResult.unknown("schedule");
        }
        if (row.get(SCHEDULES.PAUSED_BY) != null) {
            return ActResult.refused(409, "It is already paused.", "schedule.already_paused");
        }
        dsl.update(SCHEDULES).set(SCHEDULES.PAUSED_BY, caller.userId())
                .set(SCHEDULES.PAUSED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .set(SCHEDULES.PAUSE_REASON, reason.trim())
                .set(SCHEDULES.NEXT_AT, (OffsetDateTime) null)
                .where(SCHEDULES.ID.eq(id)).execute();
        events.recordAct(EventCode.SCHEDULE_PAUSED, "schedule", id, caller, List.of());
        return ActResult.ok(reads.row(id));
    }

    @Transactional
    public ActResult resume(Caller caller, String id) {
        if (!maySchedule(caller)) {
            return forbidden();
        }
        Record row = dsl.selectFrom(SCHEDULES).where(SCHEDULES.ID.eq(id)).fetchOne();
        if (row == null) {
            return ActResult.unknown("schedule");
        }
        if (row.get(SCHEDULES.PAUSED_BY) == null) {
            return ActResult.refused(409, "It is not paused", "schedule.not_paused");
        }
        Instant nextAt = queue.next(queue.cadence(row.get(SCHEDULES.CADENCE).data()), clock.instant());
        dsl.update(SCHEDULES).set(SCHEDULES.PAUSED_BY, (String) null)
                .set(SCHEDULES.PAUSED_AT, (OffsetDateTime) null)
                .set(SCHEDULES.PAUSE_REASON, (String) null)
                .set(SCHEDULES.NEXT_AT, nextAt.atOffset(ZoneOffset.UTC)).where(SCHEDULES.ID.eq(id)).execute();
        queue.queueAt(dsl, id, nextAt);
        events.recordAct(EventCode.SCHEDULE_RESUMED, "schedule", id, caller, List.of());
        return ActResult.ok(reads.row(id));
    }

    @Transactional
    public ActResult run(Caller caller, String id) {
        if (!hasPermission(access.heldBy(caller.userId()).grants(), "plugin.run")) {
            return forbidden();
        }
        Record row = dsl.selectFrom(SCHEDULES).where(SCHEDULES.ID.eq(id)).fetchOne();
        if (row == null) {
            return ActResult.unknown("schedule");
        }
        Map<String, Object> from = new LinkedHashMap<>();
        from.put("label", "Schedules");
        from.put("path", "/schedules?s=" + id);
        Map<String, Object> trigger = new LinkedHashMap<>();
        trigger.put("kind", "manual");
        trigger.put("from", from);
        String runId = runs.start(row.get(SCHEDULES.NAME), row.get(SCHEDULES.INSTANCE_ID), null,
                trigger, caller.userId(), null);
        Record run = dsl.selectFrom(RUNS).where(RUNS.ID.eq(runId)).fetchOne();
        return ActResult.ok(taskQueries.run(run, clock.instant()));
    }

    private boolean maySchedule(Caller caller) {
        return hasPermission(access.heldBy(caller.userId()).grants(), "task.schedule");
    }

    private ActResult forbidden() {
        return ActResult.refused(403, "You may not change schedules", null);
    }

    private Map<String, Object> cadence(JsonNode node) {
        Map<String, Object> result = new LinkedHashMap<>();
        node.properties().forEach(entry -> result.put(
                entry.getKey(), json.convertValue(entry.getValue(), Object.class)));
        return result;
    }

    private ActResult cadenceRefusal(Map<String, Object> cadence) {
        if ("quarter".equals(cadence.get("every"))) {
            return ActResult.refused(422, "A plugin schedule is not quarterly",
                    "schedule.quarterly_not_allowed");
        }
        if (Schedules.isTooFrequent(cadence)) {
            return ActResult.refused(422, "Every 5 minutes is the shortest", "schedule.too_often");
        }
        return null;
    }
}

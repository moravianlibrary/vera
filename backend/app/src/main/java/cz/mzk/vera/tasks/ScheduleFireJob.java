package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.RUN_LOG;
import static cz.mzk.vera.db.tables.Tables.SCHEDULES;

import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.jobs.Jobs;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

// ENT-schedule; PLG-triggers: stale occurrences have no effect; the next one is queued after firing.
@Component
public class ScheduleFireJob implements JobKind<Void> {
    private final DSLContext dsl;
    private final Runs runs;
    private final ScheduleQueue queue;
    private final Jobs jobs;
    private final Clock clock;
    private final JsonMapper json;

    public ScheduleFireJob(DSLContext dsl, Runs runs, ScheduleQueue queue, Jobs jobs,
            Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.runs = runs;
        this.queue = queue;
        this.jobs = jobs;
        this.clock = clock;
        this.json = json;
    }

    @Override
    public String name() {
        return "schedule.fire";
    }

    @Override
    public Void call(Job job) {
        return null;
    }

    @Override
    public void apply(DSLContext tx, Job job, Void ignored) {
        String id = job.payload().path("scheduleId").asString();
        Instant occurrence = Instant.parse(job.payload().path("occurrence").asString());
        Record schedule = tx.selectFrom(SCHEDULES).where(SCHEDULES.ID.eq(id)).fetchOne();
        if (schedule == null || schedule.get(SCHEDULES.PAUSED_BY) != null) {
            return;
        }
        Map<String, Object> cadence = queue.cadence(schedule.get(SCHEDULES.CADENCE).data());
        if (schedule.get(SCHEDULES.NEXT_AT) == null
                || !occurrence.equals(schedule.get(SCHEDULES.NEXT_AT).toInstant())) {
            return;
        }
        boolean running = tx.fetchExists(tx.selectFrom(RUNS)
                .where(RUNS.INSTANCE_ID.eq(schedule.get(SCHEDULES.INSTANCE_ID)))
                .and(RUNS.STATE.eq("Running")));
        if (running && "wait".equals(schedule.get(SCHEDULES.OVERLAP))) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("scheduleId", id);
            payload.put("occurrence", occurrence.toString());
            jobs.enqueue(tx, "schedule.fire", clock.instant().plus(Duration.ofMinutes(1)), payload);
            return;
        }
        Instant nextAt = queue.next(cadence, occurrence);
        tx.update(SCHEDULES).set(SCHEDULES.NEXT_AT, nextAt.atOffset(ZoneOffset.UTC))
                .where(SCHEDULES.ID.eq(id)).execute();
        if (running) {
            skipped(tx, schedule, occurrence);
        } else {
            Map<String, Object> trigger = new LinkedHashMap<>();
            trigger.put("kind", "schedule");
            trigger.put("scheduleId", id);
            trigger.put("cadence", cadence);
            runs.start(schedule.get(SCHEDULES.NAME), schedule.get(SCHEDULES.INSTANCE_ID), null,
                    trigger, null, null);
        }
        queue.queueAt(tx, id, nextAt);
    }

    private void skipped(DSLContext tx, Record schedule, Instant occurrence) {
        int highest = tx.select(RUNS.ID).from(RUNS).fetch(RUNS.ID).stream()
                .mapToInt(value -> Integer.parseInt(value.substring(2))).max().orElse(0);
        String id = "T-" + (highest + 1);
        String scheduleId = schedule.get(SCHEDULES.ID);
        String name = schedule.get(SCHEDULES.NAME);
        Map<String, Object> trigger = new LinkedHashMap<>();
        trigger.put("kind", "schedule");
        trigger.put("scheduleId", scheduleId);
        trigger.put("cadence", queue.cadence(schedule.get(SCHEDULES.CADENCE).data()));
        OffsetDateTime at = occurrence.atOffset(ZoneOffset.UTC);
        String note = "The previous run was still going.";
        tx.insertInto(RUNS)
                .set(RUNS.ID, id)
                .set(RUNS.WHAT, name)
                .set(RUNS.INSTANCE_ID, schedule.get(SCHEDULES.INSTANCE_ID))
                .set(RUNS.TRIGGER, JSONB.valueOf(json.writeValueAsString(trigger)))
                .set(RUNS.STARTED_BY, (String) null)
                .set(RUNS.STATE, "Skipped")
                .set(RUNS.STARTED_AT, at)
                .set(RUNS.FINISHED_AT, at)
                .set(RUNS.ITEM_COUNT, 0)
                .set(RUNS.DONE_COUNT, 0)
                .set(RUNS.CHANGES, JSONB.valueOf("[]"))
                .set(RUNS.NOTE, note)
                .execute();
        tx.insertInto(RUN_LOG)
                .set(RUN_LOG.RUN_ID, id)
                .set(RUN_LOG.AT, at)
                .set(RUN_LOG.TEXT, id + " started — " + name + " (schedule " + scheduleId + ")")
                .set(RUN_LOG.IS_ERROR, false)
                .set(RUN_LOG.POSITION, 0)
                .execute();
        tx.insertInto(RUN_LOG)
                .set(RUN_LOG.RUN_ID, id)
                .set(RUN_LOG.AT, at)
                .set(RUN_LOG.TEXT, "skipped — " + note)
                .set(RUN_LOG.IS_ERROR, false)
                .set(RUN_LOG.POSITION, 1)
                .execute();
    }
}

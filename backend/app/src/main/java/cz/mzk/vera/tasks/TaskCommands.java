package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.TASK_RETENTION;
import static cz.mzk.vera.domain.permissions.Permissions.hasPermission;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.domain.tasks.Tasks;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// ACT-run-cancel; ACT-retention.
@Component
public class TaskCommands {
    private final DSLContext dsl;
    private final TasksQueries queries;
    private final HeldAccessQueries access;
    private final Clock clock;
    private final JsonMapper json;
    private final Runs runs;

    public TaskCommands(DSLContext dsl, TasksQueries queries, HeldAccessQueries access,
            Clock clock, JsonMapper json, Runs runs) {
        this.dsl = dsl;
        this.queries = queries;
        this.access = access;
        this.clock = clock;
        this.json = json;
        this.runs = runs;
    }

    @Transactional
    public ActResult rerun(Caller caller, String id) {
        Record row = queries.visibleRun(caller.userId(), id, clock.instant());
        if (row == null) {
            return ActResult.unknown("run");
        }
        if (row.get(RUNS.INSTANCE_ID) == null
                || !List.of("Failed", "Cancelled").contains(row.get(RUNS.STATE))) {
            return ActResult.refused(409, "Only a failed or cancelled plugin run is run again",
                    "task.not_rerunnable");
        }
        List<Grant> grants = access.heldBy(caller.userId()).grants();
        Tasks.Session session = new Tasks.Session(caller.userId(), grants);
        Tasks.Run run = new Tasks.Run(row.get(RUNS.STATE), row.get(RUNS.STARTED_BY), true);
        if (!Tasks.canRunAgain(session, run)) {
            return ActResult.refused(403, "You may not run this plugin", null);
        }
        Map<String, Object> trigger = new LinkedHashMap<>();
        trigger.put("kind", "manual");
        trigger.put("from", Map.of("label", "Tasks", "path", "/tasks?run=" + id));
        String createdId = runs.start(row.get(RUNS.WHAT), row.get(RUNS.INSTANCE_ID), null, trigger,
                caller.userId(), id);
        Record created = dsl.selectFrom(RUNS).where(RUNS.ID.eq(createdId)).fetchOne();
        return ActResult.ok(queries.run(created, clock.instant()));
    }

    @Transactional
    public ActResult cancel(Caller caller, String id) {
        Record row = queries.visibleRun(caller.userId(), id, clock.instant());
        if (row == null) {
            return ActResult.unknown("run");
        }
        if (!row.get(RUNS.STATE).equals("Running")) {
            return ActResult.refused(409, "It has already finished", "task.not_running");
        }
        List<Grant> grants = access.heldBy(caller.userId()).grants();
        Tasks.Session session = new Tasks.Session(caller.userId(), grants);
        Tasks.Run run = new Tasks.Run(row.get(RUNS.STATE), row.get(RUNS.STARTED_BY),
                row.get(RUNS.INSTANCE_ID) != null);
        if (!Tasks.canCancelRun(session, run)) {
            return ActResult.refused(403, "You may not cancel another person's run", null);
        }
        Instant now = clock.instant();
        int done = row.get(RUNS.DONE_COUNT);
        int items = row.get(RUNS.ITEM_COUNT);
        String note = "Stopped after " + done + " of " + items
                + "; what it had already done stays.";
        dsl.update(RUNS)
                .set(RUNS.STATE, "Cancelled")
                .set(RUNS.FINISHED_AT, now.atOffset(ZoneOffset.UTC))
                .set(RUNS.ITEMS_PER_MINUTE, (Double) null)
                .set(RUNS.NOTE, note)
                .set(RUNS.CANCELLED_BY, caller.userId())
                .where(RUNS.ID.eq(id))
                .execute();
        return ActResult.ok(queries.run(dsl.selectFrom(RUNS).where(RUNS.ID.eq(id)).fetchOne(), now));
    }

    @Transactional
    public ActResult retention(Caller caller, Map<String, Integer> retention) {
        List<Grant> grants = access.heldBy(caller.userId()).grants();
        if (!hasPermission(grants, "task.schedule")) {
            return ActResult.refused(403, "You may not change how long runs are kept", null);
        }
        int days = retention.get("days");
        int failedDays = retention.get("failedDays");
        if (failedDays < days) {
            return ActResult.refused(422,
                    "Failed and cancelled runs are kept at least as long as the others",
                    "retention.failed_shorter");
        }
        dsl.update(TASK_RETENTION)
                .set(TASK_RETENTION.DAYS, days)
                .set(TASK_RETENTION.FAILED_DAYS, failedDays)
                .where(TASK_RETENTION.ID.eq(1))
                .execute();
        return ActResult.ok(queries.retentionMap(queries.retention()));
    }

}

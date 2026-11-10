package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.RUN_ERRORS;
import static cz.mzk.vera.db.tables.Tables.RUN_ITEMS;
import static cz.mzk.vera.db.tables.Tables.RUN_LOG;
import static cz.mzk.vera.db.tables.Tables.RUN_TARGETS;
import static cz.mzk.vera.db.tables.Tables.RUNS;

import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.jobs.Jobs;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-run-items; B5: plugin calls are outside the chunk's apply transaction.
@Component
public class PluginRunJob implements JobKind<PluginRunJob.Chunk> {
    private static final int CHUNK_SIZE = 25;
    private static final int LISTED_ITEMS = 6;
    private final DSLContext dsl;
    private final Clock clock;
    private final JsonMapper json;
    private final Jobs jobs;
    private final List<RunKind> runKinds;

    public PluginRunJob(DSLContext dsl, Clock clock, JsonMapper json,
            Jobs jobs, List<RunKind> runKinds) {
        this.dsl = dsl;
        this.clock = clock;
        this.json = json;
        this.jobs = jobs;
        this.runKinds = runKinds;
    }

    @Override
    public String name() {
        return "plugin.run";
    }

    @Override
    public Chunk call(Job job) {
        String runId = job.payload().path("runId").asString();
        int offset = job.payload().path("offset").asInt();
        Record run = dsl.select(RUNS.INSTANCE_ID, RUNS.STATE, RUNS.CORE_NAME)
                .from(RUNS).where(RUNS.ID.eq(runId)).fetchOne();
        if (run == null || !"Running".equals(run.get(RUNS.STATE))) {
            return Chunk.stale(runId, offset);
        }
        String instanceId = run.get(RUNS.INSTANCE_ID);
        String coreName = run.get(RUNS.CORE_NAME);
        if (instanceId == null && "VERA".equals(coreName)) {
            RunKind kind = findKind("Custody", coreName);
            List<RunKind.PlacementTarget> targets = dsl.select(RUN_TARGETS.POSITION, RUN_TARGETS.REQUEST_ID)
                    .from(RUN_TARGETS).where(RUN_TARGETS.RUN_ID.eq(runId))
                    .and(RUN_TARGETS.POSITION.ge(offset)).orderBy(RUN_TARGETS.POSITION)
                    .limit(CHUNK_SIZE).fetch(row -> new RunKind.PlacementTarget(
                            row.get(RUN_TARGETS.POSITION), row.get(RUN_TARGETS.REQUEST_ID)));
            RunKind.Context context = new RunKind.Context(runId, offset, null, null, "Custody", coreName,
                    null, List.of(), targets);
            return new Chunk(runId, offset, kind, context, kind.call(context), false, false);
        }
        Record instance = dsl.select(PLUGIN_IMPLEMENTATIONS.KIND, PLUGIN_INSTANCES.NAME,
                        PLUGIN_INSTANCES.IS_ENABLED, PLUGIN_INSTANCES.IS_DELETED,
                        PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_INSTANCES.ID.eq(instanceId)).fetchOne();
        if (instance == null || !instance.get(PLUGIN_INSTANCES.IS_ENABLED)
                || instance.get(PLUGIN_INSTANCES.IS_DELETED)) {
            return Chunk.switchedOff(runId, offset);
        }
        String kindName = instance.get(PLUGIN_IMPLEMENTATIONS.KIND);
        RunKind kind = findKind(kindName, coreName);
        List<RunKind.Target> targets = dsl.select(RUN_TARGETS.POSITION, RUN_TARGETS.DOCUMENT_ID,
                        RUN_TARGETS.REQUEST_ID, RUN_TARGETS.ITERATION_ID, DOCUMENTS.CATALOG_ID, DOCUMENTS.TITLE,
                        DOCUMENTS.TYPE, DOCUMENTS.SHELF_MARK)
                .from(RUN_TARGETS).join(DOCUMENTS).on(DOCUMENTS.ID.eq(RUN_TARGETS.DOCUMENT_ID))
                .where(RUN_TARGETS.RUN_ID.eq(runId)).and(RUN_TARGETS.POSITION.ge(offset))
                .orderBy(RUN_TARGETS.POSITION).limit(CHUNK_SIZE)
                .fetch(row -> new RunKind.Target(row.get(RUN_TARGETS.POSITION), row.get(RUN_TARGETS.DOCUMENT_ID),
                        row.get(RUN_TARGETS.REQUEST_ID), row.get(RUN_TARGETS.ITERATION_ID),
                        row.get(DOCUMENTS.CATALOG_ID), row.get(DOCUMENTS.TITLE), row.get(DOCUMENTS.TYPE),
                        row.get(DOCUMENTS.SHELF_MARK)));
        RunKind.Context context = new RunKind.Context(runId, offset, instanceId,
                instance.get(PLUGIN_INSTANCES.NAME), kindName, coreName,
                instance.get(PLUGIN_IMPLEMENTATIONS.VERSIONS), targets, List.of());
        return new Chunk(runId, offset, kind, context, kind.call(context), false, false);
    }

    private RunKind findKind(String kind, String coreName) {
        return runKinds.stream().filter(candidate -> candidate.supports(kind, coreName))
                .findFirst().orElseThrow(() -> new IllegalStateException("No run kind for " + kind));
    }

    @Override
    public void apply(DSLContext tx, Job job, Chunk chunk) {
        Record run = tx.selectFrom(RUNS).where(RUNS.ID.eq(chunk.runId())).fetchOne();
        if (run == null || !"Running".equals(run.get(RUNS.STATE)) || chunk.stale()) {
            return;
        }
        OffsetDateTime now = clock.instant().atOffset(ZoneOffset.UTC);
        if (chunk.switchedOff()) {
            finishFailed(tx, run.get(RUNS.ID), now, "The plugin was switched off.");
            return;
        }
        RunKind.Call answer = chunk.answer();
        if (answer.failure() != null) {
            finishFailed(tx, run.get(RUNS.ID), now, answer.failure());
            return;
        }
        if (answer.allUnavailable()) {
            finishFailed(tx, run.get(RUNS.ID), now, "The source did not answer.");
            return;
        }
        if (answer.page() != null && answer.page().failure() != null && answer.page().answer() == null) {
            finishFailed(tx, run.get(RUNS.ID), now, answer.page().failure());
            return;
        }
        RunKind.Applied applied = chunk.kind().apply(tx, chunk.context(), answer);
        if (applied.page() && !applied.errors().isEmpty()
                && answer.page() != null && answer.page().failure() != null) {
            finishFailed(tx, run.get(RUNS.ID), now, answer.page().failure());
            return;
        }
        if (applied.placing()) {
            applyPlacement(tx, run, chunk, applied, now);
            return;
        }
        if (applied.page()) {
            applyPage(tx, run, chunk, applied, now);
            return;
        }
        applyAnswers(tx, run, chunk, applied, now);
    }

    private void applyPlacement(DSLContext tx, Record run, Chunk chunk,
            RunKind.Applied applied, OffsetDateTime now) {
        int done = run.get(RUNS.DONE_COUNT) + applied.doneCountDelta();
        tx.update(RUNS).set(RUNS.DONE_COUNT, done).where(RUNS.ID.eq(chunk.runId())).execute();
        if (done >= run.get(RUNS.ITEM_COUNT)) {
            tx.update(RUNS).set(RUNS.STATE, "Done").set(RUNS.FINISHED_AT, now)
                    .set(RUNS.CHANGES, JSONB.valueOf(json.writeValueAsString(List.of(
                            Map.of("label", done + " proposals placed", "path", applied.changePath())))))
                    .where(RUNS.ID.eq(chunk.runId())).execute();
        } else {
            enqueueNext(tx, chunk.runId(), done);
        }
    }

    private void applyPage(DSLContext tx, Record run, Chunk chunk,
            RunKind.Applied applied, OffsetDateTime now) {
        int errors = tx.selectCount().from(RUN_ERRORS).where(RUN_ERRORS.RUN_ID.eq(chunk.runId()))
                .fetchOne(0, int.class);
        for (int index = 0; index < applied.errors().size(); index++) {
            String error = applied.errors().get(index);
            errors++;
            tx.insertInto(RUN_ERRORS).set(RUN_ERRORS.RUN_ID, chunk.runId()).set(RUN_ERRORS.MESSAGE, error)
                    .set(RUN_ERRORS.AT_ITEM, run.get(RUNS.DONE_COUNT) + index + 1)
                    .set(RUN_ERRORS.POSITION, errors - 1).execute();
            tx.insertInto(RUN_LOG).set(RUN_LOG.RUN_ID, chunk.runId()).set(RUN_LOG.AT, now)
                    .set(RUN_LOG.TEXT, error).set(RUN_LOG.IS_ERROR, true)
                    .set(RUN_LOG.POSITION, nextLogPosition(tx, chunk.runId())).execute();
        }
        int total = run.get(RUNS.ITEM_COUNT) + applied.itemCountDelta();
        int done = run.get(RUNS.DONE_COUNT) + applied.doneCountDelta();
        tx.update(RUNS).set(RUNS.ITEM_COUNT, total).set(RUNS.DONE_COUNT, done)
                .where(RUNS.ID.eq(chunk.runId())).execute();
        if (applied.more()) {
            enqueueNext(tx, chunk.runId(), 0);
            return;
        }
        List<Map<String, Object>> changes = applied.itemCountDelta() == 0 ? List.of()
                : List.of(Map.of("label", applied.itemCountDelta()
                        + ("/requests".equals(applied.changePath()) ? " proposals" : " catalog records"),
                        "path", applied.changePath()));
        tx.update(RUNS).set(RUNS.STATE, errors == 0 ? "Done" : "DoneWithErrors")
                .set(RUNS.FINISHED_AT, now).set(RUNS.CHANGES, JSONB.valueOf(json.writeValueAsString(changes)))
                .where(RUNS.ID.eq(chunk.runId())).execute();
    }

    private void applyAnswers(DSLContext tx, Record run, Chunk chunk,
            RunKind.Applied applied, OffsetDateTime now) {
        int done = run.get(RUNS.DONE_COUNT);
        int changesBeforeChunk = changeCount(run.get(RUNS.CHANGES).data());
        int errors = tx.selectCount().from(RUN_ERRORS).where(RUN_ERRORS.RUN_ID.eq(chunk.runId()))
                .fetchOne(0, int.class);
        int position = chunk.offset();
        for (RunKind.TargetAnswer answer : chunk.answer().answers()) {
            done++;
            if (answer.unavailable() || answer.error() != null) {
                String message = answer.error() == null ? "The source did not answer." : answer.error();
                errors++;
                tx.insertInto(RUN_ERRORS).set(RUN_ERRORS.RUN_ID, chunk.runId())
                        .set(RUN_ERRORS.ITERATION_ID, answer.target().iterationId())
                        .set(RUN_ERRORS.MESSAGE, message).set(RUN_ERRORS.AT_ITEM, done)
                        .set(RUN_ERRORS.POSITION, errors - 1).execute();
                tx.insertInto(RUN_LOG).set(RUN_LOG.RUN_ID, chunk.runId()).set(RUN_LOG.AT, now)
                        .set(RUN_LOG.TEXT, answer.target().iterationId() + " " + message)
                        .set(RUN_LOG.IS_ERROR, true).set(RUN_LOG.POSITION, nextLogPosition(tx, chunk.runId()))
                        .execute();
            }
            if (position < LISTED_ITEMS) {
                tx.insertInto(RUN_ITEMS).set(RUN_ITEMS.RUN_ID, chunk.runId())
                        .set(RUN_ITEMS.ITERATION_ID, answer.target().iterationId())
                        .set(RUN_ITEMS.ERROR, answer.error()).set(RUN_ITEMS.POSITION, position).execute();
            }
            position++;
        }
        int changesTotal = changesBeforeChunk + applied.changes();
        long elapsedNanos = Duration.between(run.get(RUNS.STARTED_AT).toInstant(), clock.instant()).toNanos();
        Double pace = elapsedNanos > 0 ? done * 60_000_000_000d / elapsedNanos : null;
        tx.update(RUNS).set(RUNS.DONE_COUNT, done).set(RUNS.ITEMS_PER_MINUTE, pace)
                .set(RUNS.CHANGES, JSONB.valueOf(json.writeValueAsString(
                        changePlaces(changesTotal, chunk.context().kind()))))
                .where(RUNS.ID.eq(chunk.runId())).execute();
        if (done >= run.get(RUNS.ITEM_COUNT)) {
            tx.update(RUNS).set(RUNS.STATE, errors == 0 ? "Done" : "DoneWithErrors")
                    .set(RUNS.FINISHED_AT, now).where(RUNS.ID.eq(chunk.runId())).execute();
        } else {
            enqueueNext(tx, chunk.runId(), done);
        }
    }

    private void enqueueNext(DSLContext tx, String runId, int offset) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("runId", runId);
        payload.put("offset", offset);
        // A millisecond later, so a frozen test clock stops between chunks; nothing waits on it.
        jobs.enqueue(tx, "plugin.run", clock.instant().plusMillis(1), payload);
    }

    private int nextLogPosition(DSLContext tx, String runId) {
        return tx.selectCount().from(RUN_LOG).where(RUN_LOG.RUN_ID.eq(runId)).fetchOne(0, int.class);
    }

    private String changeNoun(String kind) {
        return switch (kind) {
            case "Registry" -> "registry states";
            case "Validation" -> "defects";
            case "Restriction" -> "restrictions";
            default -> "properties";
        };
    }

    private int changeCount(String raw) {
        JsonNode values = json.readTree(raw);
        if (!values.isArray() || values.isEmpty()) {
            return 0;
        }
        String count = values.get(0).path("label").asString().split(" ", 2)[0];
        try {
            return Integer.parseInt(count);
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private List<Map<String, Object>> changePlaces(int changes, String kind) {
        if (changes == 0) {
            return List.of();
        }
        return List.of(Map.of("label", changes + " " + changeNoun(kind), "path", "/documents"));
    }

    private void finishFailed(DSLContext tx, String id, OffsetDateTime now, String message) {
        tx.update(RUNS).set(RUNS.STATE, "Failed").set(RUNS.FAILURE, message)
                .set(RUNS.FINISHED_AT, now).set(RUNS.ITEMS_PER_MINUTE, (Double) null)
                .where(RUNS.ID.eq(id)).execute();
    }

    public record Chunk(String runId, int offset, RunKind kind, RunKind.Context context, RunKind.Call answer,
            boolean switchedOff, boolean stale) {
        static Chunk stale(String runId, int offset) {
            return new Chunk(runId, offset, null, null, null, false, true);
        }

        static Chunk switchedOff(String runId, int offset) {
            return new Chunk(runId, offset, null, null, null, true, false);
        }
    }
}

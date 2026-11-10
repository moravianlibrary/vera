package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.RUN_ERRORS;
import static cz.mzk.vera.db.tables.Tables.RUN_ITEMS;
import static cz.mzk.vera.db.tables.Tables.RUN_LOG;
import static cz.mzk.vera.db.tables.Tables.RUN_TARGETS;
import static cz.mzk.vera.db.tables.Tables.RUNS;

import cz.mzk.vera.documents.PluginAnswerWrites;
import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.jobs.Jobs;
import cz.mzk.vera.plugin.propertysource.PropertySource;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.propertysource.ValuesInput;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Iteration;
import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.registry.LookupInput;
import cz.mzk.vera.plugin.registry.Registry;
import cz.mzk.vera.plugin.restriction.Restriction;
import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.plugin.restriction.RestrictionCheckInput;
import cz.mzk.vera.plugin.validation.Validation;
import cz.mzk.vera.plugin.validation.ValidationCheckAnswer;
import cz.mzk.vera.plugin.validation.ValidationCheckInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
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
    private final PluginCalls calls;
    private final PluginAnswerWrites answerWrites;
    private final Clock clock;
    private final JsonMapper json;
    private final Jobs jobs;

    public PluginRunJob(DSLContext dsl, PluginCalls calls, Clock clock,
            JsonMapper json, Jobs jobs, PluginAnswerWrites answerWrites) {
        this.dsl = dsl;
        this.calls = calls;
        this.answerWrites = answerWrites;
        this.clock = clock;
        this.json = json;
        this.jobs = jobs;
    }

    @Override
    public String name() {
        return "plugin.run";
    }

    @Override
    public Chunk call(Job job) {
        String runId = job.payload().path("runId").asString();
        int offset = job.payload().path("offset").asInt();
        Record run = dsl.select(RUNS.INSTANCE_ID, RUNS.STATE)
                .from(RUNS).where(RUNS.ID.eq(runId)).fetchOne();
        if (run == null || !"Running".equals(run.get(RUNS.STATE))) {
            return new Chunk(runId, offset, List.of(), 0, false, true, false, "");
        }
        String instanceId = run.get(RUNS.INSTANCE_ID);
        Record instance = dsl.select(PLUGIN_IMPLEMENTATIONS.KIND, PLUGIN_INSTANCES.NAME,
                        PLUGIN_INSTANCES.IS_ENABLED, PLUGIN_INSTANCES.IS_DELETED)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_INSTANCES.ID.eq(instanceId))
                .fetchOne();
        if (instance == null || !instance.get(PLUGIN_INSTANCES.IS_ENABLED)
                || instance.get(PLUGIN_INSTANCES.IS_DELETED)) {
            return new Chunk(runId, offset, List.of(), 0, true, false, false, "");
        }
        String kind = instance.get(PLUGIN_IMPLEMENTATIONS.KIND);
        List<Target> targets = dsl.select(RUN_TARGETS.POSITION, RUN_TARGETS.DOCUMENT_ID,
                        RUN_TARGETS.ITERATION_ID, DOCUMENTS.CATALOG_ID, DOCUMENTS.TITLE,
                        DOCUMENTS.TYPE, DOCUMENTS.SHELF_MARK)
                .from(RUN_TARGETS).join(DOCUMENTS).on(DOCUMENTS.ID.eq(RUN_TARGETS.DOCUMENT_ID))
                .where(RUN_TARGETS.RUN_ID.eq(runId)).and(RUN_TARGETS.POSITION.ge(offset))
                .orderBy(RUN_TARGETS.POSITION).limit(CHUNK_SIZE)
                .fetch(row -> new Target(row.get(RUN_TARGETS.POSITION), row.get(RUN_TARGETS.DOCUMENT_ID),
                        row.get(RUN_TARGETS.ITERATION_ID), row.get(DOCUMENTS.CATALOG_ID),
                        row.get(DOCUMENTS.TITLE), row.get(DOCUMENTS.TYPE), row.get(DOCUMENTS.SHELF_MARK)));
        List<TargetAnswer> answers = new ArrayList<>();
        for (Target target : targets) {
            answers.add(callTarget(instanceId, instance.get(PLUGIN_INSTANCES.NAME),
                    kind, target));
        }
        boolean allUnavailable = !answers.isEmpty()
                && answers.stream().allMatch(answer -> answer.unavailable());
        return new Chunk(runId, offset, answers, targets.size(), false, false, allUnavailable, kind);
    }

    private TargetAnswer callTarget(String instanceId, String instanceName, String kind, Target target) {
        Document record = new Document(target.documentId(), target.catalogId(), null, target.title(),
                target.documentType(), target.shelfMark());
        return switch (kind) {
            case "Registry" -> answer(calls.call(instanceId, Registry.class, "lookup",
                    (plugin, context) -> plugin.lookup(context,
                            new LookupInput(record, identifiers(target.catalogId())))), target);
            case "PropertySource" -> answer(calls.call(instanceId, PropertySource.class, "values",
                    (plugin, context) -> plugin.values(context,
                            new ValuesInput(record, iteration(target)))), target);
            case "Validation" -> answer(calls.call(instanceId, Validation.class, "check",
                    (plugin, context) -> plugin.check(context,
                            new ValidationCheckInput(record, propertyValues(target)))), target);
            case "Restriction" -> answer(calls.call(instanceId, Restriction.class, "check",
                    (plugin, context) -> plugin.check(context,
                            new RestrictionCheckInput(record, restrictionValues(target)))), target);
            default -> new TargetAnswer(target, null, "The plugin was switched off.", false);
        };
    }

    private List<String> identifiers(String catalogId) {
        return dsl.select(CATALOG_MIRROR_KEYS.VALUE).from(CATALOG_MIRROR_KEYS)
                .where(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(catalogId))
                .and(CATALOG_MIRROR_KEYS.KIND.eq("identifier"))
                .orderBy(CATALOG_MIRROR_KEYS.POSITION).fetch(CATALOG_MIRROR_KEYS.VALUE);
    }

    private Iteration iteration(Target target) {
        if (target.iterationId() == null) {
            return new Iteration("", target.documentId(), 1, null, null, null, null, "Enqueued",
                    null, null);
        }
        Record row = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(target.iterationId())).fetchOne();
        return new Iteration(row.get(ITERATIONS.ID), row.get(ITERATIONS.DOCUMENT_ID), row.get(ITERATIONS.ATTEMPT),
                row.get(ITERATIONS.REQUEST_ID), row.get(ITERATIONS.CATEGORY_ID), row.get(ITERATIONS.PRIORITY),
                row.get(ITERATIONS.PROJECT_ID), row.get(ITERATIONS.PROGRESS), row.get(ITERATIONS.LIST_ID),
                row.get(ITERATIONS.FORMER_LIST_NAME));
    }

    private List<ValidationCheckInput.PropertyValue> propertyValues(Target target) {
        List<ValidationCheckInput.PropertyValue> values = new ArrayList<>();
        dsl.select(DOCUMENT_PROPERTY_SOURCES.KEY, DOCUMENT_PROPERTY_SOURCES.VALUE)
                .from(DOCUMENT_PROPERTY_SOURCES).where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(target.documentId()))
                .orderBy(DOCUMENT_PROPERTY_SOURCES.POSITION).fetch().forEach(row -> values.add(
                        new ValidationCheckInput.PropertyValue(row.get(DOCUMENT_PROPERTY_SOURCES.KEY),
                                json.readTree(row.get(DOCUMENT_PROPERTY_SOURCES.VALUE).data()))));
        if (target.iterationId() != null) {
            dsl.select(ITERATION_PROPERTY_SOURCES.KEY, ITERATION_PROPERTY_SOURCES.VALUE)
                    .from(ITERATION_PROPERTY_SOURCES)
                    .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(target.iterationId()))
                    .orderBy(ITERATION_PROPERTY_SOURCES.POSITION).fetch().forEach(row -> values.add(
                            new ValidationCheckInput.PropertyValue(row.get(ITERATION_PROPERTY_SOURCES.KEY),
                                    json.readTree(row.get(ITERATION_PROPERTY_SOURCES.VALUE).data()))));
        }
        return values;
    }

    private List<RestrictionCheckInput.PropertyValue> restrictionValues(Target target) {
        return propertyValues(target).stream()
                .map(value -> new RestrictionCheckInput.PropertyValue(value.key(), value.value())).toList();
    }

    private TargetAnswer answer(PluginOutcome<?> outcome, Target target) {
        if (outcome instanceof PluginOutcome.Answered<?> answer) {
            return new TargetAnswer(target, answer.answer(), null, false);
        }
        if (outcome instanceof PluginOutcome.Refused<?> refused) {
            return new TargetAnswer(target, null, refused.code() + ": " + refused.message(), false);
        }
        return new TargetAnswer(target, null, null, true);
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
        if (chunk.allUnavailable()) {
            finishFailed(tx, run.get(RUNS.ID), now, "The source did not answer.");
            return;
        }
        int done = run.get(RUNS.DONE_COUNT);
        int changesBeforeChunk = changeCount(run.get(RUNS.CHANGES).data());
        int errors = tx.selectCount().from(RUN_ERRORS).where(RUN_ERRORS.RUN_ID.eq(chunk.runId()))
                .fetchOne(0, int.class);
        int changes = 0;
        int position = chunk.offset();
        for (TargetAnswer answer : chunk.answers()) {
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
            } else {
                changes += writeAnswer(tx, chunk.runId(), chunk.kind(), answer);
            }
            if (position < LISTED_ITEMS) {
                tx.insertInto(RUN_ITEMS).set(RUN_ITEMS.RUN_ID, chunk.runId())
                        .set(RUN_ITEMS.ITERATION_ID, answer.target().iterationId())
                        .set(RUN_ITEMS.ERROR, answer.error())
                        .set(RUN_ITEMS.POSITION, position).execute();
            }
            position++;
        }
        int changesTotal = changesBeforeChunk + changes;
        long elapsedNanos = Duration.between(run.get(RUNS.STARTED_AT).toInstant(), clock.instant()).toNanos();
        Double pace = elapsedNanos > 0 ? done * 60_000_000_000d / elapsedNanos : null;
        tx.update(RUNS).set(RUNS.DONE_COUNT, done).set(RUNS.ITEMS_PER_MINUTE, pace)
                .set(RUNS.CHANGES, JSONB.valueOf(json.writeValueAsString(changePlaces(changesTotal, chunk.kind()))))
                .where(RUNS.ID.eq(chunk.runId())).execute();
        int total = run.get(RUNS.ITEM_COUNT);
        if (done >= total) {
            tx.update(RUNS).set(RUNS.STATE, errors == 0 ? "Done" : "DoneWithErrors")
                    .set(RUNS.FINISHED_AT, now)
                    .where(RUNS.ID.eq(chunk.runId())).execute();
        } else {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("runId", chunk.runId());
            payload.put("offset", done);
            // A millisecond later, so a frozen test clock stops between chunks; nothing waits on it.
            jobs.enqueue(tx, "plugin.run", clock.instant().plusMillis(1), payload);
        }
    }

    private int writeAnswer(DSLContext tx, String runId, String kind, TargetAnswer answer) {
        Target target = answer.target();
        String instanceId = tx.select(RUNS.INSTANCE_ID).from(RUNS).where(RUNS.ID.eq(runId))
                .fetchOne(0, String.class);
        String instanceName = tx.select(PLUGIN_INSTANCES.NAME).from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(instanceId)).fetchOne(0, String.class);
        if ("Registry".equals(kind)) {
            return answerWrites.registry(tx, target.documentId(), instanceName, (LookupAnswer) answer.answer());
        }
        if (target.iterationId() == null) {
            return 0;
        }
        if ("PropertySource".equals(kind)) {
            return answerWrites.properties(tx, target.documentId(), target.iterationId(), instanceId,
                    instanceName, (ValuesAnswer) answer.answer());
        }
        if ("Validation".equals(kind)) {
            ValidationCheckAnswer found = (ValidationCheckAnswer) answer.answer();
            return answerWrites.defects(tx, target.iterationId(), instanceId, found.defects());
        }
        if ("Restriction".equals(kind)) {
            return answerWrites.restriction(tx, target.iterationId(), (RestrictionCheckAnswer) answer.answer());
        }
        return 0;
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
        String label = values.get(0).path("label").asString();
        String count = label.split(" ", 2)[0];
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
        Map<String, Object> change = new LinkedHashMap<>();
        change.put("label", changes + " " + changeNoun(kind));
        change.put("path", "/documents");
        return List.of(change);
    }

    private void finishFailed(DSLContext tx, String id, OffsetDateTime now, String message) {
        tx.update(RUNS).set(RUNS.STATE, "Failed").set(RUNS.FAILURE, message)
                .set(RUNS.FINISHED_AT, now).set(RUNS.ITEMS_PER_MINUTE, (Double) null)
                .where(RUNS.ID.eq(id)).execute();
    }

    public record Target(int position, String documentId, String iterationId, String catalogId,
            String title, String documentType, String shelfMark) { }
    public record TargetAnswer(Target target, Object answer, String error, boolean unavailable) { }
    public record Chunk(String runId, int offset, List<TargetAnswer> answers, int processed,
            boolean switchedOff, boolean stale, boolean allUnavailable, String kind) { }
}

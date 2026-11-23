package cz.mzk.vera.ingest;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.domain.iterations.Iterations.progressAfterGates;

import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.documents.PluginAnswerWrites;
import cz.mzk.vera.documents.RegistryLookupRun;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.iterations.IterationCheckRun;
import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
import cz.mzk.vera.plugin.catalog.ReadAnswer;
import cz.mzk.vera.plugin.catalog.ReadInput;
import cz.mzk.vera.plugin.propertysource.PropertySource;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.propertysource.ValuesInput;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Iteration;
import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.plugin.validation.ValidationCheckAnswer;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// LC-ITER-ingest; STAT-defect-key; STAT-gates; DOC-page-count; REG-evidence.
@Component
public class IngestJob implements JobKind<IngestJob.Result> {
    private final DSLContext dsl;
    private final PluginCalls calls;
    private final PluginInstances instances;
    private final DocumentStates states;
    private final PluginAnswerWrites answerWrites;
    private final IterationCheckRun checkRun;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;
    private final RegistryLookupRun registryLookups;

    public IngestJob(DSLContext dsl, PluginCalls calls, PluginInstances instances, DocumentStates states,
            PluginAnswerWrites answerWrites, IterationCheckRun checkRun, EventRecorder events,
            Clock clock, JsonMapper json, RegistryLookupRun registryLookups) {
        this.dsl = dsl;
        this.calls = calls;
        this.instances = instances;
        this.states = states;
        this.answerWrites = answerWrites;
        this.checkRun = checkRun;
        this.events = events;
        this.clock = clock;
        this.json = json;
        this.registryLookups = registryLookups;
    }

    @Override
    public String name() {
        return "ingest";
    }

    @Override
    public Result call(Job job) {
        String id = job.payload().path("iterationId").asString();
        Record row = dsl.select(ITERATIONS.DOCUMENT_ID, ITERATIONS.ATTEMPT, ITERATIONS.REQUEST_ID,
                ITERATIONS.CATEGORY_ID, ITERATIONS.PRIORITY, ITERATIONS.PROJECT_ID, ITERATIONS.PROGRESS,
                ITERATIONS.LIST_ID, ITERATIONS.FORMER_LIST_NAME, DOCUMENTS.CATALOG_ID,
                DOCUMENTS.TITLE, DOCUMENTS.TYPE, DOCUMENTS.SHELF_MARK, DOCUMENTS.UNIT_TYPE,
                DOCUMENTS.UNIT_VALUE)
                .from(ITERATIONS).join(DOCUMENTS).on(ITERATIONS.DOCUMENT_ID.eq(DOCUMENTS.ID))
                .where(ITERATIONS.ID.eq(id)).fetchOne();
        if (row == null) {
            return Result.stale(id);
        }
        String documentId = row.get(ITERATIONS.DOCUMENT_ID);
        String catalogId = row.get(DOCUMENTS.CATALOG_ID);
        Iteration iteration = new Iteration(id, documentId, row.get(ITERATIONS.ATTEMPT),
                row.get(ITERATIONS.REQUEST_ID), row.get(ITERATIONS.CATEGORY_ID), row.get(ITERATIONS.PRIORITY),
                row.get(ITERATIONS.PROJECT_ID), row.get(ITERATIONS.PROGRESS), row.get(ITERATIONS.LIST_ID),
                row.get(ITERATIONS.FORMER_LIST_NAME), null, null, null, List.of(), List.of(), null, null,
                List.of(), null, iterationProperties(id));
        Record mirror = dsl.select(CATALOG_MIRROR.RECORD).from(CATALOG_MIRROR)
                .where(CATALOG_MIRROR.CATALOG_ID.eq(catalogId)).orderBy(CATALOG_MIRROR.POSITION)
                .limit(1).fetchOne();
        if (mirror == null) {
            return Result.failed(id, documentId, row.get(ITERATIONS.ATTEMPT), "Catalog record is unavailable");
        }
        String catalogInstance = dsl.select(CATALOG_MIRROR.INSTANCE_ID).from(CATALOG_MIRROR)
                .where(CATALOG_MIRROR.CATALOG_ID.eq(catalogId)).orderBy(CATALOG_MIRROR.POSITION)
                .limit(1).fetchOne(0, String.class);
        PluginOutcome<ReadAnswer> read = calls.call(catalogInstance, CatalogAdapter.class, "read",
                (plugin, context) -> plugin.read(context, new ReadInput(catalogId)));
        if (!(read instanceof PluginOutcome.Answered<ReadAnswer> answeredRead)) {
            return Result.failed(id, documentId, row.get(ITERATIONS.ATTEMPT), outcome("Catalog adapter", read));
        }
        JsonNode recordJson = json.readTree(mirror.get(CATALOG_MIRROR.RECORD).data());
        Document record = new Document(documentId, catalogId, null, row.get(DOCUMENTS.TITLE),
                row.get(DOCUMENTS.TYPE), row.get(DOCUMENTS.SHELF_MARK));
        List<String> identifiers = dsl.select(CATALOG_MIRROR_KEYS.VALUE).from(CATALOG_MIRROR_KEYS)
                .where(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(catalogId))
                .and(CATALOG_MIRROR_KEYS.KIND.eq("identifier"))
                .orderBy(CATALOG_MIRROR_KEYS.POSITION).fetch(CATALOG_MIRROR_KEYS.VALUE);
        List<PluginInstances.Instance> propertySources = instances.enabled(dsl, "PropertySource", "OnIngest");
        List<RegistryAnswer> registryAnswers = new ArrayList<>();
        List<PropertyAnswer> propertyAnswers = new ArrayList<>();
        List<DefectAnswer> defects = new ArrayList<>();
        List<RestrictionAnswer> restrictionAnswers = new ArrayList<>();
        try {
            registryLookups.run(record, identifiers, null).forEach(answer -> registryAnswers.add(
                    new RegistryAnswer(answer.instance(), answer.registry(), answer.answer())));
        } catch (RegistryLookupRun.RegistryLookupFailure failure) {
            return Result.failed(id, documentId, row.get(ITERATIONS.ATTEMPT), failure.getMessage());
        }
        for (PluginInstances.Instance instance : propertySources) {
            if (!instance.reads(record.catalogId())) {
                continue;
            }
            PluginOutcome<ValuesAnswer> result = calls.call(instance.id(), PropertySource.class, "values",
                    (plugin, context) -> plugin.values(context, new ValuesInput(record, iteration)));
            if (!(result instanceof PluginOutcome.Answered<ValuesAnswer> answer)) {
                return Result.failed(id, documentId, row.get(ITERATIONS.ATTEMPT), outcome(instance.name(), result));
            }
            propertyAnswers.add(new PropertyAnswer(instance, answer.answer()));
        }
        List<IterationCheckRun.Value> currentValues = dsl.select(DOCUMENT_PROPERTY_SOURCES.KEY,
                DOCUMENT_PROPERTY_SOURCES.VALUE, DOCUMENT_PROPERTY_SOURCES.SOURCE)
                .from(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId))
                .orderBy(DOCUMENT_PROPERTY_SOURCES.POSITION)
                .fetch(value -> new IterationCheckRun.Value(value.get(DOCUMENT_PROPERTY_SOURCES.KEY),
                        json.readTree(value.get(DOCUMENT_PROPERTY_SOURCES.VALUE).data()),
                        json.readTree(value.get(DOCUMENT_PROPERTY_SOURCES.SOURCE).data())
                                .path("kind").asString()));
        dsl.select(ITERATION_PROPERTY_SOURCES.KEY, ITERATION_PROPERTY_SOURCES.VALUE,
                ITERATION_PROPERTY_SOURCES.SOURCE)
                .from(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(id))
                .orderBy(ITERATION_PROPERTY_SOURCES.POSITION)
                .fetch(value -> currentValues.add(new IterationCheckRun.Value(
                        value.get(ITERATION_PROPERTY_SOURCES.KEY),
                        json.readTree(value.get(ITERATION_PROPERTY_SOURCES.VALUE).data()),
                        json.readTree(value.get(ITERATION_PROPERTY_SOURCES.SOURCE).data())
                                .path("kind").asString())));
        IterationCheckRun.Result checked;
        try {
            checked = checkRun.run(record, currentValues);
        } catch (PluginUnavailable failure) {
            return Result.failed(id, documentId, row.get(ITERATIONS.ATTEMPT), failure.getMessage());
        }
        for (IterationCheckRun.ValidationAnswer answer : checked.validations()) {
            for (ValidationCheckAnswer.Defect defect : answer.answer().defects()) {
                defects.add(new DefectAnswer(answer.instance().id(), defect.rule(), defect.field(), defect.detail()));
            }
        }
        for (IterationCheckRun.RestrictionAnswer answer : checked.restrictions()) {
            restrictionAnswers.add(new RestrictionAnswer(answer.instance(), answer.answer()));
        }
        return new Result(id, documentId, row.get(ITERATIONS.ATTEMPT), record, registryAnswers, propertyAnswers,
                defects, restrictionAnswers, null, false);
    }

    @Override
    public void apply(DSLContext tx, Job job, Result result) {
        if (result.stale()) {
            return;
        }
        String id = result.iterationId();
        Record current = tx.select(ITERATIONS.DOCUMENT_ID, ITERATIONS.ATTEMPT, ITERATIONS.PROGRESS)
                .from(ITERATIONS).where(ITERATIONS.ID.eq(id)).fetchOne();
        if (current == null || !result.documentId().equals(current.get(ITERATIONS.DOCUMENT_ID))
                || result.attempt() != current.get(ITERATIONS.ATTEMPT)
                || !"Enqueued".equals(current.get(ITERATIONS.PROGRESS))) {
            return;
        }
        if (result.error() != null) {
            tx.update(ITERATIONS).set(ITERATIONS.PROGRESS, "IngestFailed")
                    .set(ITERATIONS.INGEST_FAILURE_ERROR, result.error()).where(ITERATIONS.ID.eq(id)).execute();
            event(tx, EventCode.ITERATION_INGEST_FAILED, "iteration", id,
                    Map.of("attempt", result.attempt(), "error", result.error()));
            return;
        }
        applyRegistry(tx, result);
        applyProperties(tx, result);
        applyDefects(tx, result);
        applyRestriction(tx, job, result);
        String progress = progressAfterGates(states.recordOf(tx, result.documentId()).iterations().stream()
                .filter(value -> value.id().equals(id)).findFirst().orElseThrow()).name();
        tx.update(ITERATIONS).set(ITERATIONS.PROGRESS, progress).set(ITERATIONS.INGEST_FAILURE_ERROR, (String) null)
                .where(ITERATIONS.ID.eq(id)).execute();
        event(tx, EventCode.ITERATION_INGESTED, "iteration", id, Map.of());
        states.recompute(tx, result.documentId());
    }

    private void applyDefects(DSLContext tx, Result result) {
        for (PluginInstances.Instance instance : instances.enabled(tx, "Validation")) {
            List<ValidationCheckAnswer.Defect> defects = result.defects().stream()
                    .filter(defect -> defect.instanceId().equals(instance.id()))
                    .map(defect -> new ValidationCheckAnswer.Defect(
                            defect.rule(), defect.field(), defect.detail())).toList();
            answerWrites.defects(tx, result.iterationId(), instance.id(), defects);
        }
    }

    private void applyRegistry(DSLContext tx, Result result) {
        for (RegistryAnswer answer : result.registryAnswers()) {
            answerWrites.registry(tx, result.documentId(), answer.registry(), answer.answer());
        }
    }

    private void applyProperties(DSLContext tx, Result result) {
        for (PropertyAnswer answer : result.propertyAnswers()) {
            answerWrites.properties(tx, result.documentId(), result.iterationId(), answer.instance().id(),
                    answer.instance().name(), answer.answer());
        }
    }

    private void applyRestriction(DSLContext tx, Job job, Result result) {
        RestrictionAnswer selected = result.restrictionAnswers().stream()
                .filter(answer -> answer.answer().findings().stream()
                        .anyMatch(RestrictionCheckAnswer.Finding::forbidden))
                .findFirst().orElseGet(() -> result.restrictionAnswers().stream().findFirst().orElse(null));
        if (selected == null) {
            answerWrites.restriction(tx, result.iterationId(), null, null,
                    new RestrictionCheckAnswer(List.of()), Long.toString(job.id()));
            return;
        }
        RestrictionCheckAnswer.Finding finding = selected.answer().findings().stream()
                .filter(RestrictionCheckAnswer.Finding::forbidden).findFirst()
                .orElseGet(() -> selected.answer().findings().stream().findFirst().orElse(null));
        answerWrites.restriction(tx, result.iterationId(), selected.instance().id(), selected.instance().name(),
                new RestrictionCheckAnswer(finding == null ? List.of() : List.of(finding)), Long.toString(job.id()));
    }

    private String outcome(String instance, PluginOutcome<?> outcome) {
        if (outcome instanceof PluginOutcome.Refused<?> refused) {
            return instance + " refused: " + refused.code() + ": " + refused.message();
        }
        return instance + " unavailable";
    }

    private List<Document.PropertyValues> iterationProperties(String iterationId) {
        Map<String, List<Document.SourcedValue>> values = new LinkedHashMap<>();
        dsl.select(ITERATION_PROPERTY_SOURCES.KEY, ITERATION_PROPERTY_SOURCES.SOURCE,
                ITERATION_PROPERTY_SOURCES.TIER, ITERATION_PROPERTY_SOURCES.VALUE,
                ITERATION_PROPERTY_SOURCES.OBSERVED_AT, ITERATION_PROPERTY_SOURCES.SET_BY)
                .from(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iterationId))
                .orderBy(ITERATION_PROPERTY_SOURCES.POSITION)
                .fetch().forEach(row -> {
                    JsonNode sourceJson = json.readTree(row.get(ITERATION_PROPERTY_SOURCES.SOURCE).data());
                    Document.ValueSource source = new Document.ValueSource(sourceJson.path("kind").asString(),
                            sourceJson.path("instanceId").asString(), sourceJson.path("instanceName").asString());
                    JsonNode value = json.readTree(row.get(ITERATION_PROPERTY_SOURCES.VALUE).data());
                    Document.SourcedValue sourced = new Document.SourcedValue(source,
                            row.get(ITERATION_PROPERTY_SOURCES.TIER), value,
                            row.get(ITERATION_PROPERTY_SOURCES.OBSERVED_AT).toInstant(),
                            row.get(ITERATION_PROPERTY_SOURCES.SET_BY));
                    values.computeIfAbsent(row.get(ITERATION_PROPERTY_SOURCES.KEY), ignored -> new ArrayList<>())
                            .add(sourced);
                });
        return values.entrySet().stream()
                .map(entry -> new Document.PropertyValues(entry.getKey(), List.copyOf(entry.getValue())))
                .toList();
    }

    private void event(DSLContext tx, EventCode code, String kind, String id, Map<String, Object> data) {
        events.record(new EventInput(code, kind, id, null, new EventInput.System(), Correlation.newId(),
                clock.instant(), json.valueToTree(data), null));
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }

    public record Result(String iterationId, String documentId, int attempt, Document record,
            List<RegistryAnswer> registryAnswers, List<PropertyAnswer> propertyAnswers,
            List<DefectAnswer> defects, List<RestrictionAnswer> restrictionAnswers, String error, boolean stale) {
        static Result stale(String id) {
            return new Result(id, null, 0, null, List.of(), List.of(), List.of(), List.of(), null, true);
        }
        static Result failed(String id, String error) {
            return failed(id, null, 0, error);
        }
        static Result failed(String id, String documentId, int attempt, String error) {
            return new Result(id, documentId, attempt, null, List.of(), List.of(), List.of(), List.of(), error, false);
        }
    }
    public record RegistryAnswer(PluginInstances.Instance instance, String registry, LookupAnswer answer) {}
    public record PropertyAnswer(PluginInstances.Instance instance, ValuesAnswer answer) {}
    public record DefectAnswer(String instanceId, String rule, String field, String detail) {}
    public record RestrictionAnswer(PluginInstances.Instance instance, RestrictionCheckAnswer answer) {}
}

package cz.mzk.vera.iterations;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.domain.iterations.Iterations.isCancellable;
import static cz.mzk.vera.domain.iterations.Iterations.isOverrulable;
import static cz.mzk.vera.domain.iterations.Iterations.isResumable;
import static cz.mzk.vera.domain.iterations.Iterations.progressAfterGates;
import static cz.mzk.vera.domain.validations.Validations.isFoundAfterScan;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.PageSource;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.RestrictionOverride;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.iterations.Iterations;
import cz.mzk.vera.domain.validations.Validations;
import cz.mzk.vera.db.tables.tables.records.DocumentsRecord;
import cz.mzk.vera.db.tables.tables.records.IterationsRecord;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
import cz.mzk.vera.plugin.catalog.ReadAnswer;
import cz.mzk.vera.plugin.catalog.ReadInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.session.Caller;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// ACT-cancel; ACT-resume; ACT-overrule; ACT-page-count; ACT-recheck; ACT-relink: one act, one transaction.
@Component
public class IterationReviewCommands {
    private final DSLContext dsl;
    private final IterationAccess access;
    private final DocumentStates states;
    private final IterationChecks checks;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;
    private final PluginCalls pluginCalls;
    private final PluginInstances pluginInstances;

    public IterationReviewCommands(DSLContext dsl, IterationAccess access,
            DocumentStates states, IterationChecks checks,
            EventRecorder events, Clock clock, JsonMapper json, PluginCalls pluginCalls,
            PluginInstances pluginInstances) {
        this.dsl = dsl;
        this.access = access;
        this.states = states;
        this.checks = checks;
        this.events = events;
        this.clock = clock;
        this.json = json;
        this.pluginCalls = pluginCalls;
        this.pluginInstances = pluginInstances;
    }

    // ACT-relink; DOC-relink: preserve the document and its linked history while changing catalog identity.
    @Transactional
    public ActResult relink(Caller caller, String documentId, String catalogId) {
        DocumentsRecord document = dsl.selectFrom(DOCUMENTS).where(DOCUMENTS.ID.eq(documentId)).fetchOne();
        if (document == null) {
            return ActResult.refused(404, "No such document", "not_found");
        }
        IterationsRecord latest = dsl.selectFrom(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq(documentId))
                .orderBy(ITERATIONS.ATTEMPT.desc()).limit(1).fetchOne();
        if (latest == null) {
            if (!access.mayActAnywhere(caller, IterationCodes.RECHECK)) {
                return ActResult.refused(403, "This is outside what you may change",
                        IterationCodes.OUTSIDE_CUSTODY);
            }
        } else {
            IterationAccess.Result found = access.actionableIteration(caller, latest.getId(),
                    IterationCodes.RECHECK);
            if (found.refusal() != null) {
                return found.refusal();
            }
        }
        if (catalogId.equals(document.getCatalogId())) {
            return ActResult.refused(422, "Choose a different catalog record", "document.same_catalog_record");
        }
        String other = dsl.select(DOCUMENTS.ID).from(DOCUMENTS)
                .where(DOCUMENTS.CATALOG_ID.eq(catalogId))
                .and(DOCUMENTS.UNIT_VALUE.eq(document.getUnitValue()))
                .and(DOCUMENTS.ID.ne(documentId)).limit(1).fetchOne(DOCUMENTS.ID);
        if (other != null) {
            return ActResult.refused(409, "Another document already holds this catalog record",
                    "document.catalog_record_held");
        }
        ReadAnswer readAnswer = null;
        for (PluginInstances.Instance adapter : pluginInstances.enabled(dsl, "CatalogAdapter")) {
            PluginOutcome<ReadAnswer> outcome = pluginCalls.call(adapter.id(), CatalogAdapter.class, "read",
                    (plugin, context) -> plugin.read(context, new ReadInput(catalogId)));
            if (outcome instanceof PluginOutcome.Answered<ReadAnswer> answer
                    && (document.getUnitValue() == null || (answer.answer().units() != null
                        && answer.answer().units().contains(document.getUnitValue())))) {
                readAnswer = answer.answer();
                break;
            }
        }
        if (readAnswer == null) {
            return ActResult.refused(422, "The catalog does not read this record", "document.catalog_unread");
        }
        dsl.update(DOCUMENTS).set(DOCUMENTS.CATALOG_ID, catalogId)
                .set(DOCUMENTS.CATALOG_STATE, (JSONB) null)
                .where(DOCUMENTS.ID.eq(documentId)).execute();
        Map<String, Object> data = Map.of("catalogId", Map.of("from", document.getCatalogId(), "to", catalogId));
        events.record(new EventInput(EventCode.DOCUMENT_RELINKED, "document", documentId, null,
                new EventInput.User(caller.userId()), Correlation.newId(), clock.instant(),
                json.valueToTree(data), null));
        return latest == null ? ActResult.ok(null) : recheck(caller, latest.getId());
    }

    // DOC-relink; PLG-api-record-change: a run either moves the identity or leaves a state for staff.
    @Transactional
    public void catalogReplacement(String documentId, String catalogId, List<String> units, String runId) {
        DocumentsRecord document = dsl.selectFrom(DOCUMENTS).where(DOCUMENTS.ID.eq(documentId)).fetchOne();
        if (document == null) {
            return;
        }
        String other = dsl.select(DOCUMENTS.ID).from(DOCUMENTS)
                .where(DOCUMENTS.CATALOG_ID.eq(catalogId))
                .and(DOCUMENTS.UNIT_VALUE.eq(document.getUnitValue()))
                .and(DOCUMENTS.ID.ne(documentId)).limit(1).fetchOne(DOCUMENTS.ID);
        boolean unitMissing = document.getUnitValue() != null
                && (units == null || !units.contains(document.getUnitValue()));
        if (other != null || unitMissing) {
            Map<String, Object> state = new LinkedHashMap<>();
            state.put("kind", "replaced");
            state.put("catalogId", catalogId);
            state.put("documentId", other);
            dsl.update(DOCUMENTS).set(DOCUMENTS.CATALOG_STATE, JSONB.valueOf(json.writeValueAsString(state)))
                    .where(DOCUMENTS.ID.eq(documentId)).execute();
            return;
        }
        dsl.update(DOCUMENTS).set(DOCUMENTS.CATALOG_ID, catalogId)
                .set(DOCUMENTS.CATALOG_STATE, (JSONB) null)
                .where(DOCUMENTS.ID.eq(documentId)).execute();
        Map<String, Object> data = Map.of("catalogId", Map.of("from", document.getCatalogId(), "to", catalogId));
        events.recordRun(new EventInput(EventCode.DOCUMENT_RELINKED, "document", documentId, null,
                new EventInput.System(), Correlation.newId(), clock.instant(), json.valueToTree(data), null), runId);
    }

    // DOC-relink; PLG-api-record-change: a dropped catalog record remains on its document for staff to resolve.
    @Transactional
    public void catalogGone(String documentId) {
        dsl.update(DOCUMENTS).set(DOCUMENTS.CATALOG_STATE, JSONB.valueOf("{\"kind\":\"gone\"}"))
                .where(DOCUMENTS.ID.eq(documentId)).execute();
    }

    public List<CatalogIterationCheck> callCatalogChanged(String documentId) {
        List<String> ids = dsl.select(ITERATIONS.ID).from(ITERATIONS)
                .where(ITERATIONS.DOCUMENT_ID.eq(documentId))
                .and(ITERATIONS.PROGRESS.ne("Cancelled"))
                .orderBy(ITERATIONS.ATTEMPT.desc()).fetch(ITERATIONS.ID);
        List<CatalogIterationCheck> results = new ArrayList<>();
        for (String id : ids) {
            DocumentIteration current = load(documentId, id);
            results.add(new CatalogIterationCheck(id,
                    checks.run(current.iteration(), current.document(), IterationChecks.Run.RECHECK)));
        }
        return results;
    }

    public void applyCatalogChanged(String documentId, List<CatalogIterationCheck> results) {
        for (CatalogIterationCheck item : results) {
            DocumentIteration current = load(documentId, item.iterationId());
            refreshCatalogReading(documentId);
            int gone = current.iteration().defects().size() - item.result().defects().size();
            applyRecheck(new Caller("a3", null, null), current, item.result(), EventCode.ITERATION_RECHECKED,
                    Map.of("by", "catalog_change", "found", item.result().defects().size(), "gone", gone),
                    "The record was read from the catalog again.");
            states.recompute(dsl, documentId);
        }
    }

    // enterPageCount and fixableIteration: ACT-page-count refuses after a scan.
    @Transactional
    public ActResult pageCount(Caller caller, String id, PageCount body) {
        IterationAccess.Result found = access.actionableIteration(caller, id, IterationCodes.RECHECK);
        if (found.refusal() != null) {
            return found.refusal();
        }
        String documentId = found.value().iteration().getDocumentId();
        DocumentIteration current = load(documentId, id);
        if (isFoundAfterScan(current.iteration())) {
            return ActResult.refused(409, "It is scanned; the scan counts its pages", IterationCodes.SCANNED);
        }
        List<PageSource> prior = current.document().pageSources();
        Integer previous = prior.stream().sorted((a, b) -> Integer.compare(b.tier(), a.tier()))
                .map(PageSource::value).findFirst().orElse(null);
        int position = dsl.selectCount().from(DOCUMENT_PAGE_SOURCES)
                .where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.eq(documentId)).fetchOne(0, int.class);
        dsl.deleteFrom(DOCUMENT_PAGE_SOURCES).where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.eq(documentId)
                .and(DOCUMENT_PAGE_SOURCES.SOURCE.eq("manual"))).execute();
        dsl.insertInto(DOCUMENT_PAGE_SOURCES)
                .set(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID, documentId)
                .set(DOCUMENT_PAGE_SOURCES.POSITION, position)
                .set(DOCUMENT_PAGE_SOURCES.SOURCE, "manual")
                .set(DOCUMENT_PAGE_SOURCES.TIER, 100)
                .set(DOCUMENT_PAGE_SOURCES.VALUE, body.pages())
                .set(DOCUMENT_PAGE_SOURCES.OBSERVED_AT, now())
                .set(DOCUMENT_PAGE_SOURCES.SET_BY, caller.userId())
                .execute();
        IterationChecks.CheckResult result = checks.run(current.iteration(), current.document(),
                IterationChecks.Run.PAGE_COUNT);
        Map<String, Object> eventData = new LinkedHashMap<>();
        eventData.put("pages", body.pages());
        eventData.put("previous", previous);
        RecheckAnswer answer = applyRecheck(caller, current, result, EventCode.ITERATION_PAGE_COUNT_ENTERED,
                eventData, null);
        states.recompute(dsl, documentId);
        return ActResult.ok(answer.body());
    }

    // recheckIteration: refresh the stored catalog reading and record the check answer.
    @Transactional
    public ActResult recheck(Caller caller, String id) {
        IterationAccess.Result found = access.actionableIteration(caller, id, IterationCodes.RECHECK);
        if (found.refusal() != null) {
            return found.refusal();
        }
        String documentId = found.value().iteration().getDocumentId();
        DocumentIteration current = load(documentId, id);
        refreshCatalogReading(documentId);
        IterationChecks.CheckResult result = checks.run(current.iteration(), current.document(),
                IterationChecks.Run.RECHECK);
        int gone = current.iteration().defects().size() - result.defects().size();
        RecheckAnswer answer = applyRecheck(caller, current, result, EventCode.ITERATION_RECHECKED,
                Map.of("by", "catalog_change", "found", result.defects().size(), "gone", gone),
                "The record was read from the catalog again.");
        states.recompute(dsl, documentId);
        return ActResult.ok(answer.body());
    }

    @Transactional
    public void catalogChanged(String documentId) {
        List<String> ids = dsl.select(ITERATIONS.ID).from(ITERATIONS)
                .where(ITERATIONS.DOCUMENT_ID.eq(documentId))
                .and(ITERATIONS.PROGRESS.ne("Cancelled"))
                .orderBy(ITERATIONS.ATTEMPT.desc()).fetch(ITERATIONS.ID);
        for (String id : ids) {
            DocumentIteration current = load(documentId, id);
            refreshCatalogReading(documentId);
            IterationChecks.CheckResult result = checks.run(current.iteration(), current.document(),
                    IterationChecks.Run.RECHECK);
            int gone = current.iteration().defects().size() - result.defects().size();
            applyRecheck(new Caller("a3", null, null), current, result, EventCode.ITERATION_RECHECKED,
                    Map.of("by", "catalog_change", "found", result.defects().size(), "gone", gone),
                    "The record was read from the catalog again.");
            states.recompute(dsl, documentId);
        }
    }

    // cancelIteration: hold progress and remove any list placement.
    @Transactional
    public ActResult cancel(Caller caller, String id, Cancellation body) {
        IterationAccess.Result found = access.actionableIteration(caller, id, IterationCodes.CANCEL);
        if (found.refusal() != null) {
            return found.refusal();
        }
        String documentId = found.value().iteration().getDocumentId();
        IterationsRecordRow row = row(id);
        Iteration iteration = states.recordOf(dsl, documentId).iterations().stream()
                .filter(value -> value.id().equals(id)).findFirst().orElseThrow();
        if (!isCancellable(iteration)) {
            return ActResult.refused(409, "It is already held, or already scanned",
                    IterationCodes.ALREADY_HELD);
        }
        OffsetDateTime at = now();
        String listId = row.listId();
        String listName = listId == null ? null : dsl.select(DIGITIZATION_LISTS.NAME)
                .from(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.ID.eq(listId)).fetchOne(0, String.class);
        String progress = row.progress();
        if (listId != null) {
            Iteration released = withProgress(iteration, "Ready");
            progress = progressAfterGates(released).name();
        }
        var cancelUpdate = dsl.update(ITERATIONS)
                .set(ITERATIONS.LIST_ID, (String) null)
                .set(ITERATIONS.PROGRESS, progress)
                .set(ITERATIONS.CANCELLATION_CAUSE, "Decided");
        cancelUpdate
                .set(ITERATIONS.CANCELLATION_ACTOR_ID, caller.userId())
                .set(ITERATIONS.CANCELLATION_AT, at)
                .set(ITERATIONS.CANCELLATION_PUBLIC_TEXT, body.publicText())
                .set(ITERATIONS.CANCELLATION_INTERNAL_TEXT, body.internalText())
                .where(ITERATIONS.ID.eq(id)).execute();
        int askerCount = dsl.select(REQUESTS.REQUESTER_ID).from(REQUESTS)
                .where(REQUESTS.ITERATION_ID.eq(id).or(REQUESTS.TRACKS_ITERATION_ID.eq(id)))
                .fetch(REQUESTS.REQUESTER_ID).stream().distinct().toList().size();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("list", listId == null ? null : Map.of("id", listId, "name", listName));
        record(EventCode.ITERATION_CANCELLED, id, caller, at, data, body.publicText(), body.internalText());
        states.recompute(dsl, documentId);
        return ActResult.ok(Map.of("progress", progress, "askerCount", askerCount));
    }

    // resumeIteration: lift the hold and return the item to the pool.
    @Transactional
    public ActResult resume(Caller caller, String id) {
        IterationAccess.Result found = access.actionableIteration(caller, id, IterationCodes.RESUME);
        if (found.refusal() != null) {
            return found.refusal();
        }
        String documentId = found.value().iteration().getDocumentId();
        IterationsRecordRow row = row(id);
        Iteration iteration = states.recordOf(dsl, documentId).iterations().stream()
                .filter(value -> value.id().equals(id)).findFirst().orElseThrow();
        if (!isResumable(iteration)) {
            return ActResult.refused(409, "It is not held, or it has been scanned", IterationCodes.NOT_HELD);
        }
        Iteration released = new Iteration(iteration.id(), iteration.documentId(), iteration.attempt(),
                iteration.requestId(), iteration.categoryId(), iteration.projectId(),
                cz.mzk.vera.domain.entities.Progress.valueOf(
                        row.listId() == null ? iteration.progress().name() : "Ready"),
                iteration.restriction(), iteration.restrictionOverride(), null, iteration.defects(),
                iteration.verdicts(), iteration.links());
        String progress = progressAfterGates(released).name();
        var resumeUpdate = dsl.update(ITERATIONS)
                .set(ITERATIONS.LIST_ID, (String) null)
                .set(ITERATIONS.CANCELLATION_CAUSE, (String) null)
                .set(ITERATIONS.CANCELLATION_ACTOR_ID, (String) null)
                .set(ITERATIONS.CANCELLATION_AT, (OffsetDateTime) null)
                .set(ITERATIONS.CANCELLATION_PUBLIC_TEXT, (String) null)
                .set(ITERATIONS.CANCELLATION_INTERNAL_TEXT, (String) null)
                .set(ITERATIONS.PROGRESS, progress);
        resumeUpdate.where(ITERATIONS.ID.eq(id)).execute();
        String internal = row.listId() == null ? null : "Taken off " + row.listId() + ".";
        internal = combine(internal, progressNote(iteration.progress().name(), progress));
        record(EventCode.ITERATION_RESUMED, id, caller, now(), Map.of(), null, internal);
        states.recompute(dsl, documentId);
        return ActResult.ok(Map.of("progress", progress));
    }

    // overruleRestriction: preserve the restriction finding and lift its gate.
    @Transactional
    public ActResult overrule(Caller caller, String id, Overrule body) {
        IterationAccess.Result found = access.actionableIteration(caller, id, IterationCodes.OVERRULE);
        if (found.refusal() != null) {
            return found.refusal();
        }
        String documentId = found.value().iteration().getDocumentId();
        IterationsRecordRow row = row(id);
        Iteration iteration = states.recordOf(dsl, documentId).iterations().stream()
                .filter(value -> value.id().equals(id)).findFirst().orElseThrow();
        if (!isOverrulable(iteration)) {
            return ActResult.refused(409, "No restriction stands on it", IterationCodes.NO_RESTRICTION);
        }
        String progress = isFoundAfterScan(iteration) ? iteration.progress().name()
                : progressAfterGates(withoutRestriction(iteration)).name();
        OffsetDateTime at = now();
        dsl.update(ITERATIONS).set(ITERATIONS.OVERRIDE_ACTOR_ID, caller.userId())
                .set(ITERATIONS.OVERRIDE_AT, at).set(ITERATIONS.OVERRIDE_NOTE, body.note())
                .set(ITERATIONS.PROGRESS, progress).where(ITERATIONS.ID.eq(id)).execute();
        String rule = row.restrictionRule() == null ? "unknown" : row.restrictionRule();
        String internal = combine(rule + " no longer stops it.", body.note());
        internal = combine(internal, progressNote(iteration.progress().name(), progress));
        record(EventCode.ITERATION_RESTRICTION_OVERRULED, id, caller, at,
                Map.of("rule", Map.of("id", rule, "name", rule.equals("unknown") ? "Unknown rule" : rule)),
                null, internal);
        states.recompute(dsl, documentId);
        return ActResult.ok(Map.of("progress", progress));
    }

    private RecheckAnswer applyRecheck(Caller caller, DocumentIteration current,
            IterationChecks.CheckResult result, EventCode code, Map<String, Object> data, String reason) {
        Iteration iteration = current.iteration();
        List<Defect> cleared = iteration.defects().stream()
                .filter(defect -> result.goneSubjects().contains(defect.subject())).toList();
        List<String> remainingKeys = result.defects().stream().map(Defect::key).toList();
        if (remainingKeys.isEmpty()) {
            dsl.deleteFrom(ITERATION_DEFECTS)
                    .where(ITERATION_DEFECTS.ITERATION_ID.eq(iteration.id())).execute();
        } else {
            dsl.deleteFrom(ITERATION_DEFECTS).where(ITERATION_DEFECTS.ITERATION_ID.eq(iteration.id())
                    .and(ITERATION_DEFECTS.KEY.notIn(remainingKeys))).execute();
        }
        String progress = isFoundAfterScan(iteration) ? iteration.progress().name()
                : progressAfterGates(withDefects(iteration, result.defects())).name();
        dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, progress)
                .where(ITERATIONS.ID.eq(iteration.id())).execute();
        String internal = reason;
        if (!cleared.isEmpty()) {
            List<String> names = new ArrayList<>();
            for (Defect defect : cleared) {
                String instanceName = dsl.select(PLUGIN_INSTANCES.NAME).from(PLUGIN_INSTANCES)
                        .where(PLUGIN_INSTANCES.ID.eq(defect.instanceId())).fetchOne(0, String.class);
                String displayName = instanceName == null ? defect.instanceId() : instanceName;
                names.add(displayName + " " + defect.ruleCode());
            }
            internal = combine(internal, "The checks no longer find " + String.join(", ", names) + ".");
        }
        internal = combine(internal, progressNote(iteration.progress().name(), progress));
        record(code, iteration.id(), caller, now(), data, null, internal);
        List<String> keys = cleared.stream().map(Defect::key).toList();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clearedKeys", keys);
        body.put("review", Validations.reviewStateOf(withDefects(iteration, result.defects())));
        body.put("progress", progress);
        return new RecheckAnswer(body, data);
    }

    private DocumentIteration load(String documentId, String id) {
        var record = states.recordOf(dsl, documentId);
        Iteration iteration = record.iterations().stream().filter(value -> value.id().equals(id))
                .findFirst().orElseThrow();
        return new DocumentIteration(iteration, record.document());
    }

    private void refreshCatalogReading(String documentId) {
        OffsetDateTime at = now();
        dsl.select(DOCUMENT_PROPERTY_SOURCES.KEY, DOCUMENT_PROPERTY_SOURCES.POSITION,
                DOCUMENT_PROPERTY_SOURCES.SOURCE)
                .from(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId)
                        .and(DOCUMENT_PROPERTY_SOURCES.KEY.in("title", "material_type", "shelf_mark")))
                .fetch().forEach(row -> {
                    var source = json.readTree(row.get(DOCUMENT_PROPERTY_SOURCES.SOURCE).data());
                    if ("plugin".equals(source.path("kind").asString())
                            && "pi1".equals(source.path("instanceId").asString())) {
                        dsl.update(DOCUMENT_PROPERTY_SOURCES).set(DOCUMENT_PROPERTY_SOURCES.OBSERVED_AT, at)
                                .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId)
                                        .and(DOCUMENT_PROPERTY_SOURCES.KEY.eq(
                                                row.get(DOCUMENT_PROPERTY_SOURCES.KEY)))
                                        .and(DOCUMENT_PROPERTY_SOURCES.POSITION.eq(
                                                row.get(DOCUMENT_PROPERTY_SOURCES.POSITION))))
                                .execute();
                    }
                });
    }

    private Iteration withProgress(Iteration value, String progress) {
        return new Iteration(value.id(), value.documentId(), value.attempt(), value.requestId(),
                value.categoryId(), value.projectId(), Progress.valueOf(progress), value.restriction(),
                value.restrictionOverride(),
                value.cancellation(), value.defects(), value.verdicts(), value.links());
    }

    private Iteration withDefects(Iteration value, List<Defect> defects) {
        return new Iteration(value.id(), value.documentId(), value.attempt(), value.requestId(),
                value.categoryId(),
                value.projectId(), value.progress(), value.restriction(), value.restrictionOverride(),
                value.cancellation(), defects, value.verdicts(), value.links());
    }

    private Iteration withoutRestriction(Iteration value) {
        return new Iteration(value.id(), value.documentId(), value.attempt(), value.requestId(),
                value.categoryId(),
                value.projectId(), value.progress(), value.restriction(),
                new RestrictionOverride(""),
                value.cancellation(), value.defects(), value.verdicts(), value.links());
    }

    private IterationsRecordRow row(String id) {
        var value = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(id)).fetchOne();
        return new IterationsRecordRow(value.getProgress(), value.getListId(), value.getRestrictionRule());
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }

    private String progressNote(String before, String after) {
        if (before.equals(after)) {
            return null;
        }
        if ("Ready".equals(after)) {
            return "Every gate passes: Ready.";
        }
        return "Back to " + after + ": a gate holds it.";
    }

    private String combine(String first, String second) {
        if (first == null || first.isBlank()) {
            return second;
        }
        if (second == null || second.isBlank()) {
            return first;
        }
        return first + " " + second;
    }

    private void record(EventCode code, String id, Caller caller, OffsetDateTime at,
            Map<String, Object> data, String publicReason, String internalReason) {
        events.record(new EventInput(code, "iteration", id, null, new EventInput.User(caller.userId()),
                Correlation.newId(), at.toInstant(), json.valueToTree(data),
                new EventInput.Reason(publicReason, internalReason)));
    }

    public record PageCount(int pages) {}
    public record Relink(String catalogId) {}
    public record CatalogIterationCheck(String iterationId, IterationChecks.CheckResult result) {}
    public record Cancellation(String publicText, String internalText) {}
    public record Overrule(String note) {}
    private record DocumentIteration(Iteration iteration, Document document) {}
    private record IterationsRecordRow(String progress, String listId, String restrictionRule) {}
    private record RecheckAnswer(Map<String, Object> body, Map<String, Object> data) {}
}

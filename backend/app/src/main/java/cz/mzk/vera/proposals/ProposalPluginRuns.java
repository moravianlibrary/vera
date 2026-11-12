package cz.mzk.vera.proposals;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_REGISTRY_RECORDS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_VALUES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;

import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.registry.LookupInput;
import cz.mzk.vera.plugin.registry.Registry;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.restriction.Restriction;
import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.plugin.restriction.RestrictionCheckInput;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.iterations.Iterations;
import cz.mzk.vera.domain.status.Status;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.documents.RegistryLookupRun;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.pluginhost.PluginOutcome;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// LC-REQ-preview: share the registry and restriction calls used by proposal checks and previews.
@Component
public class ProposalPluginRuns {
    private final DSLContext dsl;
    private final RegistryLookupRun registryCalls;
    private final PluginCalls calls;
    private final PluginInstances instances;
    private final DocumentStates states;
    private final Duration previewTimeout;
    private final ThreadPoolExecutor previewExecutor = new ThreadPoolExecutor(
            8, 8, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(4096));

    public ProposalPluginRuns(DSLContext dsl, RegistryLookupRun registryCalls, PluginCalls calls,
            PluginInstances instances, DocumentStates states,
            @Value("${vera.proposals.preview-timeout:2s}") Duration previewTimeout) {
        this.dsl = dsl;
        this.registryCalls = registryCalls;
        this.calls = calls;
        this.instances = instances;
        this.states = states;
        this.previewTimeout = previewTimeout;
    }

    @PreDestroy
    void stopPreviewExecutor() {
        previewExecutor.shutdownNow();
    }

    public long previewDeadline() {
        return System.nanoTime() + previewTimeout.toNanos();
    }

    public List<RegistryAnswer> registries(String documentId, Duration timeout) {
        Record row = dsl.select(DOCUMENTS.ID, DOCUMENTS.CATALOG_ID, DOCUMENTS.UNIT_TYPE,
                        DOCUMENTS.UNIT_VALUE, DOCUMENTS.TITLE, DOCUMENTS.TYPE, DOCUMENTS.SHELF_MARK)
                .from(DOCUMENTS).where(DOCUMENTS.ID.eq(documentId)).fetchOne();
        if (row == null) {
            return List.of();
        }
        Document document = document(row);
        List<String> identifiers = dsl.select(CATALOG_MIRROR_KEYS.VALUE).from(CATALOG_MIRROR_KEYS)
                .where(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(row.get(DOCUMENTS.CATALOG_ID)))
                .and(CATALOG_MIRROR_KEYS.KIND.eq("identifier"))
                .orderBy(CATALOG_MIRROR_KEYS.POSITION).fetch(CATALOG_MIRROR_KEYS.VALUE);
        return lookup(document, identifiers, timeout);
    }

    public List<RegistryAnswer> lookup(Document document, List<String> identifiers, Duration timeout) {
        try {
            return registryCalls.run(document, identifiers, timeout).stream()
                    .map(answer -> new RegistryAnswer(answer.instance(), answer.registry(), answer.answer())).toList();
        } catch (RegistryLookupRun.RegistryLookupFailure failure) {
            throw new ProposalPluginFailure(failure.getMessage());
        }
    }

    public List<RestrictionAnswer> restrictions(Document document, Duration timeout) {
        List<RestrictionAnswer> answers = new ArrayList<>();
        List<RestrictionCheckInput.PropertyValue> properties = dsl
                .select(DOCUMENT_PROPERTY_VALUES.KEY, DOCUMENT_PROPERTY_VALUES.TEXT_VALUE,
                        DOCUMENT_PROPERTY_VALUES.NUMBER_VALUE)
                .from(DOCUMENT_PROPERTY_VALUES)
                .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(document.id()))
                .orderBy(DOCUMENT_PROPERTY_VALUES.KEY, DOCUMENT_PROPERTY_VALUES.ORDINAL)
                .fetch(row -> new RestrictionCheckInput.PropertyValue(
                        row.get(DOCUMENT_PROPERTY_VALUES.KEY), row.get(DOCUMENT_PROPERTY_VALUES.NUMBER_VALUE) == null
                                ? row.get(DOCUMENT_PROPERTY_VALUES.TEXT_VALUE)
                                : row.get(DOCUMENT_PROPERTY_VALUES.NUMBER_VALUE)));
        for (PluginInstances.Instance instance : instances.enabled(dsl, "Restriction")) {
            PluginOutcome<RestrictionCheckAnswer> outcome = timeout == null
                    ? calls.call(dsl, instance.id(), Restriction.class, "check",
                            (plugin, context) -> plugin.check(context, new RestrictionCheckInput(document, properties)))
                    : calls.call(dsl, instance.id(), Restriction.class, "check", timeout,
                            (plugin, context) -> plugin.check(context, new RestrictionCheckInput(document, properties)));
            if (!(outcome instanceof PluginOutcome.Answered<RestrictionCheckAnswer> answer)) {
                throw new ProposalPluginFailure(instance.name() + " restriction check failed");
            }
            answers.add(new RestrictionAnswer(instance, answer.answer()));
        }
        return List.copyOf(answers);
    }

    public Map<String, Object> preview(String catalogId, String unit, String title, String type,
            boolean staff, String documentId) {
        return previewBatch(List.of(new PreviewRequest(catalogId, unit, title, type, documentId)),
                staff, previewDeadline()).getFirst();
    }

    public List<Map<String, Object>> previewBatch(List<PreviewRequest> requests, boolean staff, long deadline) {
        List<PreviewState> states = requests.stream().map(request -> prepare(request, staff)).toList();
        List<PreviewCall> callsToRun = new ArrayList<>();
        for (int index = 0; index < states.size(); index++) {
            PreviewState state = states.get(index);
            for (RegistryLookupRun.RegistryInstance registry : state.registries()) {
                callsToRun.add(new PreviewCall(index, true, registry.instance(), registry.registry(),
                        submitPreviewCall(state, registry.instance(), true, deadline)));
            }
            for (PluginInstances.Instance instance : state.restrictions()) {
                callsToRun.add(new PreviewCall(index, false, instance, null,
                        submitPreviewCall(state, instance, false, deadline)));
            }
        }
        List<List<RegistryAnswer>> registryAnswers = new ArrayList<>();
        List<List<RestrictionAnswer>> restrictionAnswers = new ArrayList<>();
        boolean[] registryFailed = new boolean[states.size()];
        boolean[] restrictionFailed = new boolean[states.size()];
        for (int index = 0; index < states.size(); index++) {
            registryAnswers.add(new ArrayList<>());
            restrictionAnswers.add(new ArrayList<>());
        }
        for (PreviewCall call : callsToRun) {
            PreviewCallResult result = await(call.future(), deadline);
            if (result == null || !result.answered()) {
                (call.isRegistry() ? registryFailed : restrictionFailed)[call.itemIndex()] = true;
            } else if (call.isRegistry()) {
                registryAnswers.get(call.itemIndex()).add(new RegistryAnswer(
                        call.instance(), call.registryName(), result.registry()));
            } else {
                restrictionAnswers.get(call.itemIndex())
                        .add(new RestrictionAnswer(call.instance(), result.restriction()));
            }
        }
        List<Map<String, Object>> previews = new ArrayList<>();
        for (int index = 0; index < states.size(); index++) {
            previews.add(previewResult(states.get(index), registryAnswers.get(index),
                    restrictionAnswers.get(index), registryFailed[index], restrictionFailed[index], staff));
        }
        return List.copyOf(previews);
    }

    private Future<PreviewCallResult> submitPreviewCall(PreviewState state, PluginInstances.Instance instance,
            boolean registry, long deadline) {
        try {
            return previewExecutor.submit(() -> previewCall(state, instance, registry, deadline));
        } catch (RejectedExecutionException rejected) {
            return CompletableFuture.completedFuture(PreviewCallResult.failed());
        }
    }

    private PreviewState prepare(PreviewRequest request, boolean staff) {
        Document document = documentFor(request.catalogId(), request.unit(), request.title(), request.type(),
                request.documentId());
        List<String> identifiers = dsl.select(CATALOG_MIRROR_KEYS.VALUE).from(CATALOG_MIRROR_KEYS)
                .where(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(request.catalogId()))
                .and(CATALOG_MIRROR_KEYS.KIND.eq("identifier"))
                .orderBy(CATALOG_MIRROR_KEYS.POSITION).fetch(CATALOG_MIRROR_KEYS.VALUE);
        List<RegistryLookupRun.RegistryInstance> registryInstances = registryCalls.enabled();
        List<PluginInstances.Instance> restrictionInstances = staff
                ? instances.enabled(dsl, "Restriction") : List.of();
        List<RestrictionCheckInput.PropertyValue> properties = staff ? properties(document) : List.of();
        return new PreviewState(request, document, identifiers, properties, registryInstances, restrictionInstances);
    }

    private PreviewCallResult previewCall(PreviewState state, PluginInstances.Instance instance,
            boolean registry, long deadline) {
        long remaining = deadline - System.nanoTime();
        if (remaining <= 0) {
            return PreviewCallResult.failed();
        }
        Duration timeout = Duration.ofNanos(remaining);
        if (registry) {
            PluginOutcome<LookupAnswer> outcome = calls.call(dsl, instance.id(), Registry.class, "lookup", timeout,
                    (plugin, context) -> plugin.lookup(context,
                            new LookupInput(state.document(), state.identifiers())));
            return outcome instanceof PluginOutcome.Answered<LookupAnswer> answer
                    ? PreviewCallResult.registry(answer.answer()) : PreviewCallResult.failed();
        }
        PluginOutcome<RestrictionCheckAnswer> outcome = calls.call(dsl, instance.id(), Restriction.class,
                "check", timeout, (plugin, context) -> plugin.check(context,
                        new RestrictionCheckInput(state.document(), state.properties())));
        return outcome instanceof PluginOutcome.Answered<RestrictionCheckAnswer> answer
                ? PreviewCallResult.restriction(answer.answer()) : PreviewCallResult.failed();
    }

    private PreviewCallResult await(Future<PreviewCallResult> future, long deadline) {
        long remaining = deadline - System.nanoTime();
        if (remaining <= 0) {
            future.cancel(true);
            return null;
        }
        try {
            return future.get(remaining, TimeUnit.NANOSECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            future.cancel(true);
            return null;
        } catch (ExecutionException | TimeoutException exception) {
            future.cancel(true);
            return null;
        }
    }

    private Map<String, Object> previewResult(PreviewState previewState, List<RegistryAnswer> registries,
            List<RestrictionAnswer> restrictions, boolean registryFailed, boolean restrictionFailed, boolean staff) {
        Map<String, Object> preview = new LinkedHashMap<>();
        PreviewRequest request = previewState.request();
        if (registryFailed) {
            preview.put("copies", null);
        } else {
            List<Map<String, Object>> copies = new ArrayList<>();
            var documentRecord = request.documentId() == null ? null : states.recordOf(dsl, request.documentId());
            if (documentRecord != null) {
                dsl.select(DOCUMENT_REGISTRY_RECORDS.REGISTRY, DOCUMENT_REGISTRY_RECORDS.STATE,
                                DOCUMENT_REGISTRY_RECORDS.URL)
                        .from(DOCUMENT_REGISTRY_RECORDS)
                        .where(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq(request.documentId()))
                        .orderBy(DOCUMENT_REGISTRY_RECORDS.POSITION)
                        .fetch().forEach(row -> {
                            String state = row.get(DOCUMENT_REGISTRY_RECORDS.STATE);
                            if ("Digitized".equals(state) || "Published".equals(state)) {
                                copies.add(copy(row.get(DOCUMENT_REGISTRY_RECORDS.REGISTRY), state,
                                        row.get(DOCUMENT_REGISTRY_RECORDS.URL)));
                            }
                        });
            }
            for (RegistryAnswer answer : registries) {
                for (LookupAnswer.RegistryRecord record : answer.answer().records()) {
                    String state = normalizedState(record.rawState());
                    if ("Digitized".equals(state) || "Published".equals(state)) {
                        Map<String, Object> liveCopy = copy(answer.registry(), state, record.link());
                        if (!copies.contains(liveCopy)) {
                            copies.add(liveCopy);
                        }
                    }
                }
            }
            if (request.documentId() != null) {
                dsl.select(ITERATIONS.ID, ITERATIONS.PROGRESS).from(ITERATIONS)
                        .where(ITERATIONS.DOCUMENT_ID.eq(request.documentId())).orderBy(ITERATIONS.ATTEMPT)
                        .fetch().forEach(row -> {
                            Progress progress = Progress.valueOf(row.get(ITERATIONS.PROGRESS));
                            if (Status.isProgressAtLeast(progress, Progress.Digitized)) {
                                var iteration = documentRecord.iterations().stream()
                                        .filter(value -> value.id().equals(row.get(ITERATIONS.ID)))
                                        .findFirst().orElseThrow();
                                var link = Iterations.primaryLinkOf(iteration);
                                Map<String, Object> copy = new LinkedHashMap<>();
                                copy.put("source", "VERA");
                                copy.put("state", progress == Progress.Published ? "Published" : "Digitized");
                                copy.put("link", link == null ? null : link.url());
                                copies.add(copy);
                            }
                        });
            }
            preview.put("copies", copies);
        }
        if (staff) {
            if (restrictionFailed) {
                preview.put("restrictions", null);
            } else {
                List<Map<String, Object>> findings = new ArrayList<>();
                for (RestrictionAnswer answer : restrictions) {
                    for (RestrictionCheckAnswer.Finding finding : answer.answer().findings()) {
                        Map<String, Object> value = new LinkedHashMap<>();
                        value.put("forbidden", finding.forbidden());
                        value.put("until", finding.until() == null ? null : finding.until().toString());
                        value.put("why", finding.why());
                        findings.add(value);
                    }
                }
                preview.put("restrictions", findings);
            }
        }
        return preview;
    }

    private Map<String, Object> copy(String source, String state, String link) {
        Map<String, Object> copy = new LinkedHashMap<>();
        copy.put("source", source);
        copy.put("state", state);
        copy.put("link", link);
        return copy;
    }

    private List<RestrictionCheckInput.PropertyValue> properties(Document document) {
        return dsl.select(DOCUMENT_PROPERTY_VALUES.KEY, DOCUMENT_PROPERTY_VALUES.TEXT_VALUE,
                        DOCUMENT_PROPERTY_VALUES.NUMBER_VALUE)
                .from(DOCUMENT_PROPERTY_VALUES)
                .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(document.id()))
                .orderBy(DOCUMENT_PROPERTY_VALUES.KEY, DOCUMENT_PROPERTY_VALUES.ORDINAL)
                .fetch(row -> new RestrictionCheckInput.PropertyValue(
                        row.get(DOCUMENT_PROPERTY_VALUES.KEY), row.get(DOCUMENT_PROPERTY_VALUES.NUMBER_VALUE) == null
                                ? row.get(DOCUMENT_PROPERTY_VALUES.TEXT_VALUE)
                                : row.get(DOCUMENT_PROPERTY_VALUES.NUMBER_VALUE)));
    }

    public Document documentFor(String catalogId, String unit, String title, String type, String id) {
        Record row = dsl.select(DOCUMENTS.ID, DOCUMENTS.CATALOG_ID, DOCUMENTS.UNIT_TYPE,
                        DOCUMENTS.UNIT_VALUE, DOCUMENTS.TITLE, DOCUMENTS.TYPE, DOCUMENTS.SHELF_MARK)
                .from(DOCUMENTS).where(DOCUMENTS.CATALOG_ID.eq(catalogId))
                .and(unit == null ? DOCUMENTS.UNIT_VALUE.isNull() : DOCUMENTS.UNIT_VALUE.eq(unit))
                .fetchOne();
        if (row != null) {
            return document(row);
        }
        return new Document(id, catalogId, unit == null ? null : new Document.Unit("volume-name", unit),
                title, type, null);
    }

    private Document document(Record row) {
        String unitType = row.get(DOCUMENTS.UNIT_TYPE);
        Document.Unit unit = unitType == null ? null : new Document.Unit(unitType, row.get(DOCUMENTS.UNIT_VALUE));
        return new Document(row.get(DOCUMENTS.ID), row.get(DOCUMENTS.CATALOG_ID), unit,
                row.get(DOCUMENTS.TITLE), row.get(DOCUMENTS.TYPE), row.get(DOCUMENTS.SHELF_MARK));
    }

    private String normalizedState(String raw) {
        return switch (raw == null ? "" : raw) {
            case "Digitized", "digitized" -> "Digitized";
            case "Published", "published" -> "Published";
            default -> "";
        };
    }

    public record RegistryAnswer(PluginInstances.Instance instance, String registry, LookupAnswer answer) {}
    public record RestrictionAnswer(PluginInstances.Instance instance, RestrictionCheckAnswer answer) {}
    public record PreviewRequest(String catalogId, String unit, String title, String type, String documentId) {}

    private record PreviewState(PreviewRequest request, Document document, List<String> identifiers,
            List<RestrictionCheckInput.PropertyValue> properties,
            List<RegistryLookupRun.RegistryInstance> registries, List<PluginInstances.Instance> restrictions) {}

    private record PreviewCall(int itemIndex, boolean isRegistry, PluginInstances.Instance instance, String registryName,
            Future<PreviewCallResult> future) {}

    private record PreviewCallResult(LookupAnswer registry, RestrictionCheckAnswer restriction, boolean answered) {
        static PreviewCallResult registry(LookupAnswer answer) { return new PreviewCallResult(answer, null, true); }
        static PreviewCallResult restriction(RestrictionCheckAnswer answer) {
            return new PreviewCallResult(null, answer, true);
        }
        static PreviewCallResult failed() { return new PreviewCallResult(null, null, false); }
    }

    public static final class ProposalPluginFailure extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public ProposalPluginFailure(String message) {
            super(message);
        }
    }
}

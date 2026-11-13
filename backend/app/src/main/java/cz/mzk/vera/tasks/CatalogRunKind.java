package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_SYNC;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_CURSORS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.RUN_TARGETS;

import cz.mzk.vera.iterations.IterationReviewCommands;
import cz.mzk.vera.plugin.catalog.ChangeFeed;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
import cz.mzk.vera.plugin.catalog.CatalogReplacement;
import cz.mzk.vera.plugin.catalog.ReadAnswer;
import cz.mzk.vera.plugin.catalog.ReadInput;
import cz.mzk.vera.plugin.catalog.ChangesAnswer;
import cz.mzk.vera.plugin.catalog.ChangesInput;
import cz.mzk.vera.plugin.catalog.MirroredCatalog;
import cz.mzk.vera.plugin.catalog.SyncAnswer;
import cz.mzk.vera.plugin.catalog.SyncInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-api-cursor; PLG-api-mirror; PLG-api-record-change.
@Component
public class CatalogRunKind implements RunKind {
    private final DSLContext dsl;
    private final PluginCalls calls;
    private final RunSets runSets;
    private final IterationReviewCommands reviewCommands;
    private final Clock clock;
    private final JsonMapper json;

    public CatalogRunKind(DSLContext dsl, PluginCalls calls, RunSets runSets,
            IterationReviewCommands reviewCommands, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.calls = calls;
        this.runSets = runSets;
        this.reviewCommands = reviewCommands;
        this.clock = clock;
        this.json = json;
    }

    @Override
    public boolean supports(String kind, String coreName) {
        return "CatalogAdapter".equals(kind);
    }

    @Override
    public Call call(Context context) {
        String recheckOperation = recheckOperation(context.runId());
        String recheckMarker = dsl.select(PLUGIN_CURSORS.CURSOR).from(PLUGIN_CURSORS)
                .where(PLUGIN_CURSORS.INSTANCE_ID.eq(context.instanceId())
                        .and(PLUGIN_CURSORS.OPERATION.eq(recheckOperation)))
                .fetchOne(PLUGIN_CURSORS.CURSOR);
        if (recheckMarker != null) {
            Set<Integer> affected = markerPositions(recheckMarker);
            List<TargetAnswer> answers = context.targets().stream().map(target -> new TargetAnswer(target,
                    affected.contains(target.position())
                            ? reviewCommands.callCatalogChanged(target.documentId()) : null, null, false)).toList();
            return new Call(answers, List.of(), answers.size(), false, null, null);
        }
        JsonNode version = json.readTree(context.versions().data()).get(0);
        JsonNode operations = version.path("declares").path("operations");
        String operation;
        if (operations.toString().contains("sync")) {
            operation = "sync";
        } else if (operations.toString().contains("changes")) {
            operation = "changes";
        } else {
            return new Call(List.of(), List.of(), 0, false,
                    "The catalog adapter declares neither sync nor changes.", null);
        }
        String cursor = dsl.select(PLUGIN_CURSORS.CURSOR).from(PLUGIN_CURSORS)
                .where(PLUGIN_CURSORS.INSTANCE_ID.eq(context.instanceId()))
                .and(PLUGIN_CURSORS.OPERATION.eq(operation)).fetchOne(PLUGIN_CURSORS.CURSOR);
        if ("sync".equals(operation)) {
            PluginOutcome<SyncAnswer> outcome = calls.call(context.instanceId(), CatalogAdapter.class,
                    operation, (plugin, pluginContext) -> ((MirroredCatalog) plugin)
                            .sync(pluginContext, new SyncInput(cursor)));
            RunKind.Page page = RunKind.Page.sync(context.instanceId(), operation, outcome, null);
            if (outcome instanceof PluginOutcome.Answered<SyncAnswer> answered) {
                page = new RunKind.Page(page.instanceId(), page.operation(),
                        new SyncPage(answered.answer(), readReplacementUnits(context.instanceId(),
                                answered.answer().replaced())), page.failure(), page.agent());
            }
            return new Call(List.of(), List.of(), 0, false, null, page);
        }
        PluginOutcome<ChangesAnswer> outcome = calls.call(context.instanceId(), CatalogAdapter.class,
                operation, (plugin, pluginContext) -> ((ChangeFeed) plugin)
                        .changes(pluginContext, new ChangesInput(cursor)));
        RunKind.Page page = RunKind.Page.changes(context.instanceId(), operation, outcome, null);
        if (outcome instanceof PluginOutcome.Answered<ChangesAnswer> answered) {
            page = new RunKind.Page(page.instanceId(), page.operation(),
                    new ChangesPage(answered.answer(), readReplacementUnits(context.instanceId(),
                            answered.answer().replaced())), page.failure(), page.agent());
        }
        return new Call(List.of(), List.of(), 0, false, null, page);
    }

    @Override
    public Applied apply(DSLContext tx, Context context, Call call) {
        if (call.page() == null) {
            for (TargetAnswer answer : call.answers()) {
                if (answer.answer() == null) {
                    continue;
                }
                @SuppressWarnings("unchecked")
                List<IterationReviewCommands.CatalogIterationCheck> checks =
                        (List<IterationReviewCommands.CatalogIterationCheck>) answer.answer();
                reviewCommands.applyCatalogChanged(answer.target().documentId(), checks);
            }
            int count = call.answers().size();
            String operation = recheckOperation(context.runId());
            int itemCount = tx.select(RUNS.ITEM_COUNT).from(RUNS).where(RUNS.ID.eq(context.runId()))
                    .fetchOne(RUNS.ITEM_COUNT);
            boolean finished = context.offset() + count >= itemCount;
            boolean more = markerMore(tx, context.instanceId(), operation);
            if (finished) {
                tx.deleteFrom(PLUGIN_CURSORS).where(PLUGIN_CURSORS.INSTANCE_ID.eq(context.instanceId())
                        .and(PLUGIN_CURSORS.OPERATION.eq(operation))).execute();
            }
            return new Applied((int) call.answers().stream().filter(answer -> answer.answer() != null).count(),
                    0, count, more || !finished, true, false, List.of(), "/documents");
        }
        RunKind.Page page = call.page();
        if (page.failure() != null) {
            return new Applied(0, 0, 0, false, true, false, List.of(page.failure()), "/documents");
        }
        OffsetDateTime now = clock.instant().atOffset(ZoneOffset.UTC);
        List<String> catalogIds = new ArrayList<>();
        List<String> droppedIds = new ArrayList<>();
        List<RunSets.Target> relinkedTargets = new ArrayList<>();
        List<CatalogReplacement> replacements;
        Map<String, List<String>> replacementUnits = new LinkedHashMap<>();
        String nextCursor;
        boolean more;
        if (page.answer() instanceof SyncPage result) {
            SyncAnswer answer = result.answer();
            nextCursor = answer.nextCursor();
            more = answer.hasMore();
            for (SyncAnswer.Keep keep : answer.keep()) {
                upsertMirror(tx, page.instanceId(), keep, now);
                catalogIds.add(keep.catalogId());
            }
            for (String catalogId : answer.drop()) {
                tx.deleteFrom(CATALOG_MIRROR_KEYS).where(CATALOG_MIRROR_KEYS.INSTANCE_ID.eq(page.instanceId())
                        .and(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(catalogId))).execute();
                tx.deleteFrom(CATALOG_MIRROR).where(CATALOG_MIRROR.INSTANCE_ID.eq(page.instanceId())
                        .and(CATALOG_MIRROR.CATALOG_ID.eq(catalogId))).execute();
                droppedIds.add(catalogId);
            }
            tx.insertInto(CATALOG_MIRROR_SYNC).set(CATALOG_MIRROR_SYNC.INSTANCE_ID, page.instanceId())
                    .set(CATALOG_MIRROR_SYNC.SYNCED_AT, now)
                    .onConflict(CATALOG_MIRROR_SYNC.INSTANCE_ID).doUpdate()
                    .set(CATALOG_MIRROR_SYNC.SYNCED_AT, now).execute();
            if (!more) {
                droppedIds.addAll(finishRebuild(tx, context));
            }
            replacements = answer.replaced();
            replacementUnits.putAll(result.units());
        } else {
            ChangesPage result = (ChangesPage) page.answer();
            ChangesAnswer answer = result.answer();
            nextCursor = answer.nextCursor();
            more = nextCursor != null;
            catalogIds.addAll(answer.catalogIds());
            replacements = answer.replaced();
            replacementUnits.putAll(result.units());
        }
        for (String droppedId : droppedIds) {
            List<String> documents = tx.select(DOCUMENTS.ID).from(DOCUMENTS)
                    .where(DOCUMENTS.CATALOG_ID.eq(droppedId)).fetch(DOCUMENTS.ID);
            documents.forEach(reviewCommands::catalogGone);
        }
        for (CatalogReplacement replacement : replacements) {
            List<String> documents = tx.select(DOCUMENTS.ID).from(DOCUMENTS)
                    .where(DOCUMENTS.CATALOG_ID.eq(replacement.oldCatalogId())).fetch(DOCUMENTS.ID);
            List<String> units = replacementUnits.getOrDefault(replacement.oldCatalogId(), List.of());
            for (String documentId : documents) {
                reviewCommands.catalogReplacement(documentId, replacement.newCatalogId(), units, context.runId());
                if (replacement.newCatalogId().equals(tx.select(DOCUMENTS.CATALOG_ID).from(DOCUMENTS)
                        .where(DOCUMENTS.ID.eq(documentId)).fetchOne(DOCUMENTS.CATALOG_ID))) {
                    relinkedTargets.addAll(tx.select(DOCUMENTS.ID, ITERATIONS.ID).from(DOCUMENTS)
                            .join(ITERATIONS).on(ITERATIONS.DOCUMENT_ID.eq(DOCUMENTS.ID))
                            .where(DOCUMENTS.ID.eq(documentId)).and(ITERATIONS.PROGRESS.ne("Cancelled"))
                            .orderBy(ITERATIONS.ATTEMPT.desc())
                            .fetch(row -> new RunSets.Target(row.get(DOCUMENTS.ID), row.get(ITERATIONS.ID))));
                }
            }
            catalogIds.add(replacement.newCatalogId());
        }
        List<RunSets.Target> held = new ArrayList<>(runSets.heldCatalogTargets(tx, catalogIds));
        held.addAll(relinkedTargets);
        int position = tx.selectCount().from(RUN_TARGETS).where(RUN_TARGETS.RUN_ID.eq(context.runId()))
                .fetchOne(0, int.class);
        Set<String> staged = new HashSet<>(tx.select(RUN_TARGETS.DOCUMENT_ID, RUN_TARGETS.ITERATION_ID)
                .from(RUN_TARGETS).where(RUN_TARGETS.RUN_ID.eq(context.runId()))
                .fetch(row -> row.get(RUN_TARGETS.DOCUMENT_ID) + "/" + row.get(RUN_TARGETS.ITERATION_ID)));
        List<Integer> affected = new ArrayList<>();
        for (RunSets.Target target : held) {
            if (!staged.add(target.documentId() + "/" + target.iterationId())) {
                continue;
            }
            tx.insertInto(RUN_TARGETS).set(RUN_TARGETS.RUN_ID, context.runId())
                    .set(RUN_TARGETS.POSITION, position).set(RUN_TARGETS.DOCUMENT_ID, target.documentId())
                    .set(RUN_TARGETS.ITERATION_ID, target.iterationId()).execute();
            affected.add(position++);
        }
        saveCursor(tx, page.instanceId(), page.operation(), nextCursor);
        boolean recheck = !affected.isEmpty();
        if (recheck) {
            saveCursor(tx, page.instanceId(), recheckOperation(context.runId()), markerOf(more, affected));
        }
        return new Applied(affected.size(), affected.size(), 0, more || recheck,
                true, false, List.of(), "/documents");
    }

    // PLG-api-mirror: keep the old mirror until a run begun after Reset has read every page.
    private List<String> finishRebuild(DSLContext tx, Context context) {
        OffsetDateTime resetAt = tx.select(PLUGIN_INSTANCES.REBUILD_AFTER).from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(context.instanceId())).forUpdate()
                .fetchOne(PLUGIN_INSTANCES.REBUILD_AFTER);
        OffsetDateTime startedAt = tx.select(RUNS.STARTED_AT).from(RUNS)
                .where(RUNS.ID.eq(context.runId())).fetchOne(RUNS.STARTED_AT);
        if (resetAt == null || !startedAt.isAfter(resetAt)) {
            return List.of();
        }
        List<String> stale = tx.select(CATALOG_MIRROR.CATALOG_ID).from(CATALOG_MIRROR)
                .where(CATALOG_MIRROR.INSTANCE_ID.eq(context.instanceId()))
                .and(CATALOG_MIRROR.FETCHED_AT.lt(startedAt)).fetch(CATALOG_MIRROR.CATALOG_ID);
        tx.deleteFrom(CATALOG_MIRROR_KEYS).where(CATALOG_MIRROR_KEYS.INSTANCE_ID.eq(context.instanceId()))
                .and(CATALOG_MIRROR_KEYS.CATALOG_ID.in(stale)).execute();
        tx.deleteFrom(CATALOG_MIRROR).where(CATALOG_MIRROR.INSTANCE_ID.eq(context.instanceId()))
                .and(CATALOG_MIRROR.CATALOG_ID.in(stale)).execute();
        tx.update(PLUGIN_INSTANCES).setNull(PLUGIN_INSTANCES.REBUILD_AFTER)
                .where(PLUGIN_INSTANCES.ID.eq(context.instanceId())).execute();
        return stale;
    }

    private String recheckOperation(String runId) {
        return "recheck:" + runId;
    }

    private Set<Integer> markerPositions(String marker) {
        Set<Integer> positions = new HashSet<>();
        if (marker != null && !marker.isEmpty()) {
            for (String value : marker.substring(marker.indexOf('|') + 1).split(",")) {
                positions.add(Integer.parseInt(value));
            }
        }
        return positions;
    }

    private String markerOf(boolean more, List<Integer> positions) {
        return more + "|" + positions.stream().sorted().map(String::valueOf)
                .collect(java.util.stream.Collectors.joining(","));
    }

    private boolean markerMore(DSLContext tx, String instanceId, String operation) {
        String marker = tx.select(PLUGIN_CURSORS.CURSOR).from(PLUGIN_CURSORS)
                .where(PLUGIN_CURSORS.INSTANCE_ID.eq(instanceId)
                        .and(PLUGIN_CURSORS.OPERATION.eq(operation)))
                .fetchOne(PLUGIN_CURSORS.CURSOR);
        return marker != null && marker.startsWith("true|");
    }

    private void saveCursor(DSLContext tx, String instanceId, String operation, String cursor) {
        tx.insertInto(PLUGIN_CURSORS).set(PLUGIN_CURSORS.INSTANCE_ID, instanceId)
                .set(PLUGIN_CURSORS.OPERATION, operation).set(PLUGIN_CURSORS.CURSOR, cursor)
                .onConflict(PLUGIN_CURSORS.INSTANCE_ID, PLUGIN_CURSORS.OPERATION)
                .doUpdate().set(PLUGIN_CURSORS.CURSOR, cursor).execute();
    }

    private void upsertMirror(DSLContext tx, String instanceId, SyncAnswer.Keep keep, OffsetDateTime now) {
        int position = tx.selectCount().from(CATALOG_MIRROR).where(CATALOG_MIRROR.INSTANCE_ID.eq(instanceId))
                .fetchOne(0, int.class);
        tx.insertInto(CATALOG_MIRROR).set(CATALOG_MIRROR.INSTANCE_ID, instanceId)
                .set(CATALOG_MIRROR.CATALOG_ID, keep.catalogId()).set(CATALOG_MIRROR.TITLE, keep.title())
                .set(CATALOG_MIRROR.TYPE, "Unknown")
                .set(CATALOG_MIRROR.UNITS, JSONB.valueOf(json.writeValueAsString(keep.units())))
                .set(CATALOG_MIRROR.RECORD, JSONB.valueOf(json.writeValueAsString(keep.record())))
                .set(CATALOG_MIRROR.FETCHED_AT, now).set(CATALOG_MIRROR.POSITION, position)
                .onConflict(CATALOG_MIRROR.INSTANCE_ID, CATALOG_MIRROR.CATALOG_ID).doUpdate()
                .set(CATALOG_MIRROR.TITLE, keep.title())
                .set(CATALOG_MIRROR.UNITS, JSONB.valueOf(json.writeValueAsString(keep.units())))
                .set(CATALOG_MIRROR.RECORD, JSONB.valueOf(json.writeValueAsString(keep.record())))
                .set(CATALOG_MIRROR.FETCHED_AT, now).execute();
        tx.deleteFrom(CATALOG_MIRROR_KEYS).where(CATALOG_MIRROR_KEYS.INSTANCE_ID.eq(instanceId)
                .and(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(keep.catalogId()))).execute();
        int keyPosition = 0;
        for (String identifier : keep.identifiers()) {
            tx.insertInto(CATALOG_MIRROR_KEYS).set(CATALOG_MIRROR_KEYS.INSTANCE_ID, instanceId)
                    .set(CATALOG_MIRROR_KEYS.CATALOG_ID, keep.catalogId())
                    .set(CATALOG_MIRROR_KEYS.KIND, "identifier").set(CATALOG_MIRROR_KEYS.VALUE, identifier)
                    .set(CATALOG_MIRROR_KEYS.NORMALIZED, identifier.replace("-", "").toLowerCase(Locale.ROOT))
                    .set(CATALOG_MIRROR_KEYS.POSITION, keyPosition++).execute();
        }
    }

    private Map<String, List<String>> readReplacementUnits(String instanceId,
            List<CatalogReplacement> replacements) {
        Map<String, List<String>> units = new LinkedHashMap<>();
        for (CatalogReplacement replacement : replacements) {
            PluginOutcome<ReadAnswer> read = calls.call(instanceId, CatalogAdapter.class, "read",
                    (plugin, pluginContext) -> plugin.read(pluginContext,
                            new ReadInput(replacement.newCatalogId())));
            if (read instanceof PluginOutcome.Answered<ReadAnswer> record) {
                units.put(replacement.oldCatalogId(), record.answer().units());
            } else {
                units.put(replacement.oldCatalogId(), null);
            }
        }
        return units;
    }

    private record ChangesPage(ChangesAnswer answer, Map<String, List<String>> units) {}
    private record SyncPage(SyncAnswer answer, Map<String, List<String>> units) {}
}

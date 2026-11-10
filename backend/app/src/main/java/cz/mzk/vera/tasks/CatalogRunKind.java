package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_CURSORS;
import static cz.mzk.vera.db.tables.Tables.RUN_TARGETS;

import cz.mzk.vera.iterations.IterationReviewCommands;
import cz.mzk.vera.plugin.catalog.ChangeFeed;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
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
import java.util.List;
import java.util.Locale;
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
            return new Call(List.of(), List.of(), 0, false, null,
                    RunKind.Page.sync(context.instanceId(), operation, outcome, null));
        }
        PluginOutcome<ChangesAnswer> outcome = calls.call(context.instanceId(), CatalogAdapter.class,
                operation, (plugin, pluginContext) -> ((ChangeFeed) plugin)
                        .changes(pluginContext, new ChangesInput(cursor)));
        return new Call(List.of(), List.of(), 0, false, null,
                RunKind.Page.changes(context.instanceId(), operation, outcome, null));
    }

    @Override
    public Applied apply(DSLContext tx, Context context, Call call) {
        RunKind.Page page = call.page();
        if (page.failure() != null) {
            return new Applied(0, 0, 0, false, true, false, List.of(page.failure()), "/documents");
        }
        OffsetDateTime now = clock.instant().atOffset(ZoneOffset.UTC);
        List<String> catalogIds = new ArrayList<>();
        String nextCursor;
        boolean more;
        if (page.answer() instanceof SyncAnswer answer) {
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
                catalogIds.add(catalogId);
            }
        } else {
            ChangesAnswer answer = (ChangesAnswer) page.answer();
            nextCursor = answer.nextCursor();
            more = nextCursor != null;
            catalogIds.addAll(answer.catalogIds());
        }
        List<RunSets.Target> held = runSets.heldCatalogTargets(tx, catalogIds);
        int position = tx.selectCount().from(RUN_TARGETS).where(RUN_TARGETS.RUN_ID.eq(context.runId()))
                .fetchOne(0, int.class);
        for (RunSets.Target target : held) {
            tx.insertInto(RUN_TARGETS).set(RUN_TARGETS.RUN_ID, context.runId())
                    .set(RUN_TARGETS.POSITION, position++).set(RUN_TARGETS.DOCUMENT_ID, target.documentId())
                    .set(RUN_TARGETS.ITERATION_ID, target.iterationId()).execute();
            reviewCommands.catalogChanged(target.documentId());
        }
        saveCursor(tx, page.instanceId(), page.operation(), nextCursor);
        int count = held.size();
        return new Applied(count, count, count, more, true, false, List.of(), "/documents");
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
}

package cz.mzk.vera.mixes;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DELETED_MIX_IDS;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static cz.mzk.vera.db.tables.Tables.MIXES;
import static cz.mzk.vera.db.tables.Tables.MIX_REVISIONS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.lower;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.Names;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.RecordIds;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-mix-create; ACT-mix-save; ACT-mix-snapshot; ACT-mix-primary; ACT-mix-archive; ACT-mix-delete.
@Service
class MixCommands {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final EventRecorder events;
    private final MixQueries queries;
    private final JsonMapper json;
    private final Clock clock;

    MixCommands(DSLContext dsl, HeldAccessQueries access, EventRecorder events, MixQueries queries,
            JsonMapper json, Clock clock) {
        this.dsl = dsl;
        this.access = access;
        this.events = events;
        this.queries = queries;
        this.json = json;
        this.clock = clock;
    }

    @Transactional
    ActResult create(Caller caller, JsonNode body) {
        if (!may(caller, "mix.edit")) {
            return ActResult.refused(403, "You may not edit mixes", null);
        }
        JsonNode names = body.path("names");
        String name = legacyName(names);
        if (taken(names, null)) {
            return ActResult.refused(409, "A mix already has that name", "mix.name_taken");
        }
        String sourceId = body.path("fromMixId").isNull() ? null : body.path("fromMixId").asString();
        var source = sourceId == null ? null : dsl.selectFrom(MIXES).where(MIXES.ID.eq(sourceId)).fetchOne();
        if (sourceId != null && source == null) {
            return ActResult.refused(404, "No such mix", "not_found");
        }
        JsonNode shares = source == null ? json.createObjectNode()
                : json.readTree(source.getShares().data());
        Integer fromRevision = body.path("fromRevision").isNull()
                ? null : body.path("fromRevision").asInt();
        if (fromRevision != null) {
            var version = dsl.selectFrom(MIX_REVISIONS).where(MIX_REVISIONS.MIX_ID.eq(sourceId)
                    .and(MIX_REVISIONS.REVISION.eq(fromRevision))).fetchOne();
            if (version == null) {
                return ActResult.refused(422, "That mix revision does not exist", "mix.revision_not_found");
            }
            shares = json.readTree(version.getShares().data());
        }
        List<String> ids = new ArrayList<>(dsl.select(MIXES.ID).from(MIXES).fetch(MIXES.ID));
        ids.addAll(dsl.select(DELETED_MIX_IDS.ID).from(DELETED_MIX_IDS).fetch(DELETED_MIX_IDS.ID));
        String id = RecordIds.next("d", ids);
        OffsetDateTime at = now();
        int position = dsl.select(coalesce(max(MIXES.POSITION), -1).add(1))
                .from(MIXES).fetchOne(0, int.class);
        dsl.insertInto(MIXES).set(MIXES.ID, id).set(MIXES.NAME, name)
                .set(MIXES.NAMES, org.jooq.JSONB.valueOf(names.toString())).set(MIXES.IS_PRIMARY, false)
                .set(MIXES.SHARES, JSONB.valueOf(shares.toString())).set(MIXES.REVISION, 1)
                .set(MIXES.POSITION, position).execute();
        insertRevision(id, 1, shares, at, null, 0);
        events.recordAct(EventCode.MIX_CREATED, "mix", id, caller,
                List.of(EventChanges.change("mix", null, Map.of("id", id, "name", name))));
        return ActResult.created(queries.record(id, caller));
    }

    @Transactional
    ActResult save(Caller caller, String id, JsonNode body) {
        if (!may(caller, "mix.edit")) {
            return ActResult.refused(403, "You may not edit mixes", null);
        }
        var mix = dsl.selectFrom(MIXES).where(MIXES.ID.eq(id)).fetchOne();
        if (mix == null) {
            return ActResult.unknown("mix");
        }
        if (mix.getArchivedAt() != null) {
            return ActResult.refused(409, "This mix is archived; make an editable copy", "mix.is_archived");
        }
        if (mix.getRevision() != body.path("revision").asInt()) {
            return ActResult.refused(409, "Somebody changed this mix meanwhile", "mix.revision");
        }
        String parentId = body.path("parentId").isNull() ? null : body.path("parentId").asString();
        List<String> children = dsl.select(CATEGORIES.ID).from(CATEGORIES)
                .where(parentId == null ? CATEGORIES.PARENT_ID.isNull() : CATEGORIES.PARENT_ID.eq(parentId))
                .orderBy(CATEGORIES.POSITION).fetch(CATEGORIES.ID);
        JsonNode patch = body.path("shares");
        if (children.isEmpty() || patch.size() != children.size()
                || children.stream().anyMatch(child -> !patch.has(child))) {
            return ActResult.refused(422, "Name every child in this category set", "mix.child_missing");
        }
        double total = 0;
        for (String child : children) {
            JsonNode value = patch.path(child);
            if (!value.isNull()) {
                total += value.asDouble();
            }
        }
        if (total > 100) {
            return ActResult.refused(422, "A set cannot pass 100", "mix.over_hundred");
        }
        JsonNode before = json.readTree(mix.getShares().data());
        Map<String, Object> shares = new LinkedHashMap<>();
        before.properties().forEach(entry -> shares.put(entry.getKey(), entry.getValue()));
        for (String child : children) {
            JsonNode value = patch.path(child);
            if (value.isNull()) {
                shares.remove(child);
            } else {
                shares.put(child, value.asDouble());
            }
        }
        JsonNode next = json.valueToTree(shares);
        int revision = mix.getRevision() + 1;
        int revisionPosition = dsl.select(coalesce(max(MIX_REVISIONS.POSITION), -1).add(1))
                .from(MIX_REVISIONS).where(MIX_REVISIONS.MIX_ID.eq(id)).fetchOne(0, int.class);
        dsl.update(MIXES).set(MIXES.SHARES, JSONB.valueOf(next.toString())).set(MIXES.REVISION, revision)
                .where(MIXES.ID.eq(id)).execute();
        insertRevision(id, revision, next, now(), null, revisionPosition);
        events.recordAct(EventCode.MIX_REVISED, "mix", id, caller,
                List.of(EventChanges.change("revision", mix.getRevision(), revision),
                        EventChanges.change("shares", before, next)));
        return ActResult.ok(queries.record(id, caller));
    }

    @Transactional
    ActResult snapshot(Caller caller, String id, JsonNode body) {
        if (!may(caller, "mix.edit")) {
            return ActResult.refused(403, "You may not edit mixes", null);
        }
        if (!dsl.fetchExists(dsl.selectOne().from(MIXES).where(MIXES.ID.eq(id)))) {
            return ActResult.unknown("mix");
        }
        var revision = dsl.selectFrom(MIX_REVISIONS).where(MIX_REVISIONS.MIX_ID.eq(id)
                .and(MIX_REVISIONS.REVISION.eq(body.path("revision").asInt()))).fetchOne();
        if (revision == null) {
            return ActResult.refused(422, "No such revision", "mix.revision_not_found");
        }
        if (revision.getLabel() != null) {
            return ActResult.refused(409, "That revision already has a snapshot label", "mix.revision_labelled");
        }
        dsl.update(MIX_REVISIONS).set(MIX_REVISIONS.LABEL, body.path("label").asString())
                .where(MIX_REVISIONS.MIX_ID.eq(id).and(MIX_REVISIONS.REVISION.eq(revision.getRevision())))
                .execute();
        events.recordAct(EventCode.MIX_LABELLED, "mix", id, caller,
                List.of(EventChanges.change("label", null, body.path("label").asString()),
                        EventChanges.change("revision", null, revision.getRevision())));
        return ActResult.ok(queries.record(id, caller));
    }

    @Transactional
    ActResult primary(Caller caller, String id) {
        if (!may(caller, "mix.manage")) {
            return ActResult.refused(403, "You may not manage mixes", null);
        }
        var mix = dsl.selectFrom(MIXES).where(MIXES.ID.eq(id)).fetchOne();
        if (mix == null) {
            return ActResult.unknown("mix");
        }
        if (mix.getArchivedAt() != null) {
            return ActResult.refused(409, "An archived mix cannot be Primary", "mix.is_archived");
        }
        dsl.update(MIXES).set(MIXES.IS_PRIMARY, false).execute();
        dsl.update(MIXES).set(MIXES.IS_PRIMARY, true).where(MIXES.ID.eq(id)).execute();
        events.recordAct(EventCode.MIX_MADE_PRIMARY, "mix", id, caller,
                List.of(EventChanges.change("primary", false, true)));
        return ActResult.ok(queries.record(id, caller));
    }

    @Transactional
    ActResult archive(Caller caller, String id) {
        if (!may(caller, "mix.manage")) {
            return ActResult.refused(403, "You may not manage mixes", null);
        }
        var mix = dsl.selectFrom(MIXES).where(MIXES.ID.eq(id)).fetchOne();
        if (mix == null) {
            return ActResult.unknown("mix");
        }
        if (mix.getIsPrimary()) {
            return ActResult.refused(409, "Choose a new Primary mix before archiving this one", "mix.is_primary");
        }
        if (mix.getArchivedAt() == null) {
            OffsetDateTime at = now();
            dsl.update(INTENTIONS).set(INTENTIONS.MIX_REVISION, mix.getRevision())
                    .where(INTENTIONS.DISTRIBUTION_ID.eq(id).and(INTENTIONS.MIX_REVISION.isNull())
                            .and(INTENTIONS.ARCHIVED_AT.isNull())).execute();
            dsl.update(INTENTION_TEMPLATES).set(INTENTION_TEMPLATES.MIX_REVISION, mix.getRevision())
                    .where(INTENTION_TEMPLATES.DISTRIBUTION_ID.eq(id)
                            .and(INTENTION_TEMPLATES.MIX_REVISION.isNull())).execute();
            dsl.update(MIXES).set(MIXES.ARCHIVED_AT, at).where(MIXES.ID.eq(id)).execute();
            events.recordAct(EventCode.MIX_ARCHIVED, "mix", id, caller,
                    List.of(EventChanges.change("archivedAt", null, at.toInstant().toString()),
                            EventChanges.change("revision", null, mix.getRevision())));
        }
        return ActResult.ok(queries.record(id, caller));
    }

    @Transactional
    ActResult delete(Caller caller, String id) {
        if (!may(caller, "mix.manage")) {
            return ActResult.refused(403, "You may not manage mixes", null);
        }
        var mix = dsl.selectFrom(MIXES).where(MIXES.ID.eq(id)).fetchOne();
        if (mix == null) {
            return ActResult.unknown("mix");
        }
        if (mix.getIsPrimary()) {
            return ActResult.refused(409, "Choose a new Primary mix before removing this one", "mix.is_primary");
        }
        boolean used = dsl.fetchExists(dsl.selectOne().from(INTENTIONS)
                .where(INTENTIONS.DISTRIBUTION_ID.eq(id)))
                || dsl.fetchExists(dsl.selectOne().from(INTENTION_TEMPLATES)
                        .where(INTENTION_TEMPLATES.DISTRIBUTION_ID.eq(id)))
                || dsl.selectFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.GENERATED.isNotNull()).fetch()
                        .stream().map(row -> json.readTree(row.getGenerated().data()))
                        .anyMatch(generated -> generated.path("mixId").asString().equals(id));
        if (used || dsl.fetchExists(dsl.selectOne().from(DELETED_MIX_IDS).where(DELETED_MIX_IDS.ID.eq(id)))) {
            return ActResult.refused(409, "A mix that has been used cannot be removed; archive it instead",
                    "mix.in_use");
        }
        dsl.insertInto(DELETED_MIX_IDS).set(DELETED_MIX_IDS.ID, id).execute();
        dsl.deleteFrom(MIX_REVISIONS).where(MIX_REVISIONS.MIX_ID.eq(id)).execute();
        dsl.deleteFrom(MIXES).where(MIXES.ID.eq(id)).execute();
        events.recordAct(EventCode.MIX_DELETED, "mix", id, caller,
                List.of(EventChanges.change("mix", Map.of("id", id, "name", mix.getName()), null)));
        return ActResult.ok(null);
    }

    private void insertRevision(String id, int revision, JsonNode shares, OffsetDateTime at,
            String label, int position) {
        dsl.insertInto(MIX_REVISIONS).set(MIX_REVISIONS.MIX_ID, id)
                .set(MIX_REVISIONS.REVISION, revision).set(MIX_REVISIONS.SHARES, JSONB.valueOf(shares.toString()))
                .set(MIX_REVISIONS.AT, at).set(MIX_REVISIONS.LABEL, label)
                .set(MIX_REVISIONS.POSITION, position).execute();
    }

    private boolean may(Caller caller, String permission) {
        return Permissions.hasPermission(access.heldBy(caller.userId()).grants(), permission);
    }

    private boolean taken(JsonNode names, String exceptId) {
        return dsl.selectFrom(MIXES).where(exceptId == null
                ? org.jooq.impl.DSL.trueCondition() : MIXES.ID.ne(exceptId)).fetch().stream().anyMatch(row -> {
                    JsonNode existing = json.readTree(row.getNames().data());
                    return names.properties().stream().anyMatch(property -> existing.has(property.getKey())
                            && property.getValue().asString().equalsIgnoreCase(
                                    existing.path(property.getKey()).asString()));
                });
    }

    private String legacyName(JsonNode names) {
        JsonNode value = names.get("en");
        return (value == null ? names.path("cs") : value).asString();
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }
}

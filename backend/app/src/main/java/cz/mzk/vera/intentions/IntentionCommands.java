package cz.mzk.vera.intentions;

import static cz.mzk.vera.db.tables.Tables.ARCHIVED_INTENTION_SNAPSHOTS;
import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;

import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;


import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.Names;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.RecordIds;
import cz.mzk.vera.web.RequestLanguage;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-intention-create; ACT-intention-save; ACT-intention-archive; ACT-intention-delete;
// ACT-repeat-save.
@Service
class IntentionCommands {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final ProjectIntentionWrites writer;
    private final IntentionReads reads;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;
    private final RepeatQueue repeatQueue;

    IntentionCommands(
            DSLContext dsl,
            HeldAccessQueries access,
            ProjectIntentionWrites writer,
            IntentionReads reads,
            EventRecorder events,
            Clock clock,
            JsonMapper json,
            RepeatQueue repeatQueue) {
        this.dsl = dsl;
        this.access = access;
        this.writer = writer;
        this.reads = reads;
        this.events = events;
        this.clock = clock;
        this.json = json;
        this.repeatQueue = repeatQueue;
    }

    @Transactional
    ActResult create(Caller caller, JsonNode body) {
        Draft draft = Draft.from(body);
        if (draft.endsOn() != null && draft.endsOn().compareTo(draft.countsFrom()) < 0) {
            return ActResult.refused(422, "It cannot end before it starts counting", "invalid");
        }
        ActResult refused = scopeRefusal(caller, draft);
        if (refused != null) return refused;
        refused = nameRefusal(draft.name(), null);
        if (refused != null) return refused;
        Mix mix = mix(draft.mix());
        if (mix.refusal() != null) return mix.refusal();
        String id =
                writer.createPlanned(
                        draft.name(),
                        draft.description(),
                        draft.fundingKind(),
                        draft.projectId(),
                        draft.scopeCategoryId(),
                        draft.conditionsJson(json),
                        draft.countsFrom(),
                        draft.endsOn(),
                        draft.targetPages(),
                        mix.id(),
                        mix.revision(),
                        null);
        events.recordAct(EventCode.INTENTION_CREATED, "intention", id, caller, List.of());
        return new ActResult(201, null, null, row(caller.userId(), id));
    }

    @Transactional
    ActResult save(Caller caller, String id, JsonNode body) {
        Map<String, Object> found = intention(caller, id);
        if (found == null) return ActResult.refused(404, "Intention not found", null);
        if (found.containsKey("_refusal")) return (ActResult) found.get("_refusal");
        Draft draft = Draft.from(body);
        if (draft.endsOn() != null && draft.endsOn().compareTo(draft.countsFrom()) < 0) {
            return ActResult.refused(422, "It cannot end before it starts counting", "invalid");
        }
        String archivedAt = text(found, "archived_at");
        if (archivedAt != null)
            return ActResult.refused(
                    409,
                    "An archived intention is preserved; copy it to make changes",
                    "intention.is_archived");
        if (!draft.countsFrom().equals(text(found, "counts_from")))
            return ActResult.refused(
                    422,
                    "The counting start is fixed once created; make a new intention from this one",
                    "intention.counts_from");
        if (text(found, "project_id") != null
                && (!draft.name().equals(text(found, "name"))
                        || !draft.fundingKind().equals(text(found, "funding_kind"))
                        || !java.util.Objects.equals(
                                draft.projectId(), text(found, "funding_project_id"))
                        || !java.util.Objects.equals(draft.endsOn(), text(found, "ends_on"))
                        || !java.util.Objects.equals(
                                draft.targetPages(), integer(found, "target_pages")))) {
            return projectRefusal();
        }
        boolean overall = Boolean.TRUE.equals(found.get("is_overall"));
        if (overall
                && (!"any".equals(draft.fundingKind())
                        || draft.scopeCategoryId() != null
                        || !draft.conditions().isEmpty()
                        || draft.targetPages() != null
                        || draft.endsOn() != null)) {
            return ActResult.refused(
                    422,
                    "Overall counts everything, with no target or end",
                    "intention.overall_has_no_target");
        }
        ActResult refused = scopeRefusal(caller, draft);
        if (refused != null) return refused;
        refused = nameRefusal(draft.name(), id);
        if (refused != null) return refused;
        Mix mix = mix(draft.mix());
        if (mix.refusal() != null) return mix.refusal();
        writer.savePlanned(
                id,
                draft.name(),
                draft.description(),
                draft.fundingKind(),
                draft.projectId(),
                draft.scopeCategoryId(),
                draft.conditionsJson(json),
                draft.endsOn(),
                draft.targetPages(),
                mix.id(),
                mix.revision());
        events.recordAct(EventCode.INTENTION_CHANGED, "intention", id, caller, List.of());
        return ActResult.ok(row(caller.userId(), id));
    }

    @Transactional
    ActResult archive(Caller caller, String id) {
        Map<String, Object> found = intention(caller, id);
        if (found == null) return ActResult.refused(404, "Intention not found", null);
        if (found.containsKey("_refusal")) return (ActResult) found.get("_refusal");
        if (Boolean.TRUE.equals(found.get("is_overall"))) return overallRefusal();
        if (text(found, "project_id") != null) return projectRefusal();
        if (text(found, "archived_at") != null) {
            return ActResult.ok(row(caller.userId(), id));
        }
        OffsetDateTime at = clock.instant().atOffset(ZoneOffset.UTC);
        Integer pinnedRevision = integer(found, "mix_revision");
        String distributionId = text(found, "distribution_id");
        if (distributionId != null && pinnedRevision == null) {
            pinnedRevision =
                    dsl.select(cz.mzk.vera.db.tables.Tables.MIXES.REVISION)
                            .from(cz.mzk.vera.db.tables.Tables.MIXES)
                            .where(cz.mzk.vera.db.tables.Tables.MIXES.ID.eq(distributionId))
                            .fetchOne(cz.mzk.vera.db.tables.Tables.MIXES.REVISION);
        }
        dsl.update(INTENTIONS)
                .set(INTENTIONS.ARCHIVED_ACTOR_KIND, "user")
                .set(INTENTIONS.ARCHIVED_ACTOR_USER_ID, caller.userId())
                .set(INTENTIONS.ARCHIVED_AT, at)
                .set(INTENTIONS.MIX_REVISION, pinnedRevision)
                .where(INTENTIONS.ID.eq(id))
                .execute();
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("captured_row", row(caller.userId(), id));
        snapshot.put(
                "mix_tree",
                reads.mix(caller.userId(), id) == null
                        ? null
                        : reads.mix(caller.userId(), id).get("mix"));
        snapshot.put(
                "category_tree",
                dsl.selectFrom(CATEGORIES)
                        .orderBy(CATEGORIES.POSITION)
                        .fetch(
                                r -> {
                                    Map<String, Object> category = new LinkedHashMap<>();
                                    category.put("id", r.getId());
                                    category.put("name", r.getName());
                                    category.put("parentId", r.getParentId());
                                    return category;
                                }));
        dsl.insertInto(ARCHIVED_INTENTION_SNAPSHOTS)
                .set(ARCHIVED_INTENTION_SNAPSHOTS.INTENTION_ID, id)
                .set(
                        ARCHIVED_INTENTION_SNAPSHOTS.CAPTURED_ROW,
                        JSONB.valueOf(json.writeValueAsString(snapshot.get("captured_row"))))
                .set(
                        ARCHIVED_INTENTION_SNAPSHOTS.MIX_TREE,
                        snapshot.get("mix_tree") == null
                                ? null
                                : JSONB.valueOf(json.writeValueAsString(snapshot.get("mix_tree"))))
                .set(
                        ARCHIVED_INTENTION_SNAPSHOTS.CATEGORY_TREE,
                        JSONB.valueOf(json.writeValueAsString(snapshot.get("category_tree"))))
                .execute();
        events.recordAct(
                EventCode.INTENTION_ARCHIVED, "intention", id, caller, List.of(), at.toInstant());
        return ActResult.ok(snapshot.get("captured_row"));
    }

    @Transactional
    ActResult unarchive(Caller caller, String id) {
        Map<String, Object> found = intention(caller, id);
        if (found == null) return ActResult.refused(404, "Intention not found", null);
        if (found.containsKey("_refusal")) return (ActResult) found.get("_refusal");
        if (text(found, "project_id") != null) return projectRefusal();
        return ActResult.refused(
                409,
                "An archive is preserved; create a copy for new work",
                "intention.is_archived");
    }

    @Transactional
    ActResult delete(Caller caller, String id) {
        Map<String, Object> found = intention(caller, id);
        if (found == null) return ActResult.refused(404, "Intention not found", null);
        if (found.containsKey("_refusal")) return (ActResult) found.get("_refusal");
        if (text(found, "archived_at") != null)
            return ActResult.refused(
                    409, "An archived intention is preserved", "intention.is_archived");
        if (Boolean.TRUE.equals(found.get("is_overall"))) return overallRefusal();
        if (text(found, "project_id") != null) return projectRefusal();
        dsl.deleteFrom(INTENTIONS).where(INTENTIONS.ID.eq(id)).execute();
        events.recordAct(EventCode.INTENTION_DELETED, "intention", id, caller, List.of());
        return ActResult.noContent();
    }

    @Transactional
    ActResult createTemplate(Caller caller, JsonNode body) {
        JsonNode draft = body;
        ActResult refusal = templateRefusal(caller, draft);
        if (refusal != null) return refusal;
        String id =
                RecordIds.next(
                        "t",
                        dsl.select(INTENTION_TEMPLATES.ID)
                                .from(INTENTION_TEMPLATES)
                                .fetch(INTENTION_TEMPLATES.ID));
        String mixId = templateMixId(draft.path("mix"));
        Integer revision = nullableInt(draft.path("mix").path("revision"));
        LocalDate today = LocalDate.now(clock);
        String next =
                Intentions.nextPeriodStartOf(
                                Intentions.RepeatPeriod.valueOf(draft.path("every").asString()),
                                today)
                        .toString();
        int position =
                dsl.select(coalesce(max(INTENTION_TEMPLATES.POSITION), -1).add(1))
                        .from(INTENTION_TEMPLATES)
                        .fetchOne(0, int.class);
        writeTemplate(id, draft, mixId, revision, today, next, caller.userId(), position);
        repeatQueue.queue(dsl, id, LocalDate.parse(next));
        events.recordAct(EventCode.REPEAT_CHANGED, "repeat", id, caller, List.of());
        return new ActResult(201, null, null, templateRow(id));
    }

    @Transactional
    ActResult saveTemplate(Caller caller, String id, JsonNode body) {
        var existing =
                dsl.selectFrom(INTENTION_TEMPLATES).where(INTENTION_TEMPLATES.ID.eq(id)).fetchOne();
        if (existing == null) return ActResult.refused(404, "Repeat not found", null);
        ActResult refusal = templateRefusal(caller, body);
        if (refusal != null) return refusal;
        String mixId = templateMixId(body.path("mix"));
        Integer revision = nullableInt(body.path("mix").path("revision"));
        LocalDate today = LocalDate.now(clock);
        String next =
                existing.getEvery().equals(body.path("every").asString())
                        ? existing.getNextOn().toString()
                        : Intentions.nextPeriodStartOf(
                                        Intentions.RepeatPeriod.valueOf(
                                                body.path("every").asString()),
                                        today)
                                .toString();
        dsl.deleteFrom(INTENTION_TEMPLATES).where(INTENTION_TEMPLATES.ID.eq(id)).execute();
        writeTemplate(
                id,
                body,
                mixId,
                revision,
                existing.getSince(),
                next,
                existing.getCreatedBy(),
                existing.getPosition());
        if (!existing.getNextOn().equals(LocalDate.parse(next))) {
            repeatQueue.queue(dsl, id, LocalDate.parse(next));
        }
        events.recordAct(EventCode.REPEAT_CHANGED, "repeat", id, caller, List.of());
        return ActResult.ok(templateRow(id));
    }

    private void writeTemplate(
            String id,
            JsonNode draft,
            String mixId,
            Integer revision,
            LocalDate since,
            String next,
            String createdBy,
            int position) {
        JsonNode funding = draft.path("funding");
        dsl.insertInto(INTENTION_TEMPLATES)
                .set(INTENTION_TEMPLATES.ID, id)
                .set(INTENTION_TEMPLATES.DESCRIPTION, draft.path("description").asString())
                .set(INTENTION_TEMPLATES.NAME_PATTERN, draft.path("namePatterns").path("en").asString(draft.path("namePatterns").path("cs").asString()))
                .set(INTENTION_TEMPLATES.NAME_PATTERNS, JSONB.valueOf(draft.path("namePatterns").toString()))
                .set(INTENTION_TEMPLATES.EVERY, draft.path("every").asString())
                .set(INTENTION_TEMPLATES.FUNDING_KIND, funding.path("kind").asString())
                .set(
                        INTENTION_TEMPLATES.FUNDING_PROJECT_ID,
                        nullableText(funding.path("projectId")))
                .set(
                        INTENTION_TEMPLATES.SCOPE_CATEGORY_ID,
                        nullableText(draft.path("scopeCategoryId")))
                .set(INTENTION_TEMPLATES.SCOPE_CONDITIONS, jsonb(draft.path("scopeConditions")))
                .set(INTENTION_TEMPLATES.DISTRIBUTION_ID, mixId)
                .set(INTENTION_TEMPLATES.MIX_REVISION, revision)
                .set(INTENTION_TEMPLATES.TARGET_PAGES, nullableInt(draft.path("targetPages")))
                .set(
                        INTENTION_TEMPLATES.IS_ARCHIVING_PREVIOUS,
                        draft.path("isArchivingPrevious").asBoolean())
                .set(INTENTION_TEMPLATES.SINCE, since)
                .set(INTENTION_TEMPLATES.NEXT_ON, LocalDate.parse(next))
                .set(INTENTION_TEMPLATES.CREATED_BY, createdBy)
                .set(INTENTION_TEMPLATES.POSITION, position)
                .execute();
    }

    private ActResult templateRefusal(Caller caller, JsonNode draft) {
        HeldScopes scopes = access.scopesHeldBy(caller.userId());
        if (!scopes.hasPermission("intention.repeat")) {
            return ActResult.refused(403, "You may not set repeats", null);
        }
        JsonNode namePatterns = draft.path("namePatterns");
        boolean hasPeriod = namePatterns.path("cs").isString()
                && namePatterns.path("cs").asString().contains("{period}")
                || namePatterns.path("en").isString()
                        && namePatterns.path("en").asString().contains("{period}");
        if (!hasPeriod) {
            return ActResult.refused(422, "Put {period} in at least one name", "invalid");
        }
        JsonNode mix = draft.path("mix");
        if ("use".equals(mix.path("kind").asString())) {
            var selected =
                    dsl.selectFrom(cz.mzk.vera.db.tables.Tables.MIXES)
                            .where(
                                    cz.mzk.vera.db.tables.Tables.MIXES.ID.eq(
                                            mix.path("mixId").asString()))
                            .fetchOne();
            if (selected == null
                    || selected.getArchivedAt() != null
                    || (mix.path("revision").isNumber()
                            && !revisionExists(
                                    mix.path("mixId").asString(), mix.path("revision").asInt()))) {
                return ActResult.refused(
                        422,
                        "Choose an active mix and saved revision",
                        "intention.mix_revision_required");
            }
        }
        JsonNode funding = draft.path("funding");
        List<JsonNode> conditions = new ArrayList<>();
        draft.path("scopeConditions").forEach(conditions::add);
        Draft scope =
                new Draft(
                        "",
                        "",
                        funding.path("kind").asString(),
                        nullableText(funding.path("projectId")),
                        nullableText(draft.path("scopeCategoryId")),
                        conditions,
                        LocalDate.now(clock).toString(),
                        null,
                        nullableInt(draft.path("targetPages")),
                        mix);
        return scopeRefusal(caller, scope);
    }

    private boolean revisionExists(String mixId, int revision) {
        return dsl.fetchExists(
                cz.mzk.vera.db.tables.Tables.MIX_REVISIONS,
                cz.mzk.vera.db.tables.Tables.MIX_REVISIONS
                        .MIX_ID
                        .eq(mixId)
                        .and(cz.mzk.vera.db.tables.Tables.MIX_REVISIONS.REVISION.eq(revision)));
    }

    private String templateMixId(JsonNode mix) {
        if ("use".equals(mix.path("kind").asString())) return mix.path("mixId").asString();
        if ("primary".equals(mix.path("kind").asString())) {
            var row =
                    dsl.selectFrom(cz.mzk.vera.db.tables.Tables.MIXES)
                            .where(cz.mzk.vera.db.tables.Tables.MIXES.IS_PRIMARY.isTrue())
                            .and(cz.mzk.vera.db.tables.Tables.MIXES.ARCHIVED_AT.isNull())
                            .fetchOne();
            return row == null ? null : row.getId();
        }
        return null;
    }

    private Map<String, Object> templateRow(String id) {
        var row =
                dsl.selectFrom(INTENTION_TEMPLATES).where(INTENTION_TEMPLATES.ID.eq(id)).fetchOne();
        Map<String, Object> template = new LinkedHashMap<>();
        template.put("id", row.getId());
        template.put("description", row.getDescription());
        // UI-names: the pattern in the request's language, as a name is.
        template.put("namePattern", Names.nameIn(json.readValue(row.getNamePatterns().data(),
                new TypeReference<Map<String, String>>() { }), RequestLanguage.current()));
        template.put("namePatterns", json.readTree(row.getNamePatterns().data()));
        template.put("every", row.getEvery());
        Map<String, Object> funding = new LinkedHashMap<>();
        funding.put("kind", row.getFundingKind());
        if (row.getFundingProjectId() != null) funding.put("projectId", row.getFundingProjectId());
        template.put("funding", funding);
        template.put("scopeCategoryId", row.getScopeCategoryId());
        if (row.getScopeConditions() != null)
            template.put("scopeConditions", json.readTree(row.getScopeConditions().data()));
        template.put("distributionId", row.getDistributionId());
        if (row.getMixRevision() != null) {
            template.put("mixRevision", row.getMixRevision());
        }
        template.put("targetPages", row.getTargetPages());
        template.put("isArchivingPrevious", row.getIsArchivingPrevious());
        template.put("since", row.getSince().toString());
        template.put("nextOn", row.getNextOn().toString());
        template.put("createdBy", row.getCreatedBy());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("template", template);
        if (row.getDistributionId() == null) result.put("mix", null);
        else {
            var mix =
                    dsl.selectFrom(cz.mzk.vera.db.tables.Tables.MIXES)
                            .where(
                                    cz.mzk.vera.db.tables.Tables.MIXES.ID.eq(
                                            row.getDistributionId()))
                            .fetchOne();
            result.put("mix", Map.of("id", mix.getId(), "name", mix.getName()));
        }
        return result;
    }

    private ActResult scopeRefusal(Caller caller, Draft draft) {
        HeldScopes scopes = access.scopesHeldBy(caller.userId());
        if ("project".equals(draft.fundingKind())) {
            var project =
                    dsl.selectFrom(cz.mzk.vera.db.tables.Tables.PROJECTS)
                            .where(cz.mzk.vera.db.tables.Tables.PROJECTS.ID.eq(draft.projectId()))
                            .fetchOne();
            if (project == null)
                return ActResult.refused(
                        422, "No project " + draft.projectId(), "intention.project");
            boolean reaches =
                    scopes.scopesOf("intention.edit").contains("any")
                            || (scopes.scopesOf("intention.edit").contains("project")
                                    && scopes.projectIds().contains(draft.projectId()));
            if (!reaches)
                return ActResult.refused(
                        403, "You may not set an intention for that funding", null);
        } else if (!scopes.scopesOf("intention.edit").contains("any")) {
            return ActResult.refused(403, "You may not set an intention for that funding", null);
        }
        if (draft.scopeCategoryId() != null
                && !dsl.fetchExists(CATEGORIES, CATEGORIES.ID.eq(draft.scopeCategoryId()))) {
            return ActResult.refused(
                    422, "No category " + draft.scopeCategoryId(), "category.not_found");
        }
        List<String> keys =
                dsl.select(PROPERTY_DEFINITIONS.KEY)
                        .from(PROPERTY_DEFINITIONS)
                        .fetch(PROPERTY_DEFINITIONS.KEY);
        for (JsonNode condition : draft.conditions()) {
            String key = condition.path("key").asString();
            if (!keys.contains(key))
                return ActResult.refused(422, "No property " + key, "property.not_found");
        }
        return null;
    }

    private Mix mix(JsonNode choice) {
        String kind = choice.path("kind").asString();
        if ("none".equals(kind)) return new Mix(null, null, null);
        if ("primary".equals(kind)) {
            var primary =
                    dsl.selectFrom(cz.mzk.vera.db.tables.Tables.MIXES)
                            .where(cz.mzk.vera.db.tables.Tables.MIXES.IS_PRIMARY.isTrue())
                            .and(cz.mzk.vera.db.tables.Tables.MIXES.ARCHIVED_AT.isNull())
                            .fetchOne();
            return primary == null
                    ? new Mix(
                            null,
                            null,
                            ActResult.refused(409, "No active Primary mix", "mix.no_primary"))
                    : new Mix(primary.getId(), null, null);
        }
        String id = choice.path("mixId").asString();
        var selected =
                dsl.selectFrom(cz.mzk.vera.db.tables.Tables.MIXES)
                        .where(cz.mzk.vera.db.tables.Tables.MIXES.ID.eq(id))
                        .fetchOne();
        if (selected == null || selected.getArchivedAt() != null)
            return new Mix(
                    null,
                    null,
                    ActResult.refused(422, "Choose an active mix", "intention.mix_inactive"));
        Integer revision = nullableInt(choice.path("revision"));
        if (revision != null && !revisionExists(id, revision))
            return new Mix(
                    null,
                    null,
                    ActResult.refused(
                            422, "Choose a saved revision", "intention.revision_required"));
        return new Mix(id, revision, null);
    }

    private Map<String, Object> intention(Caller caller, String id) {
        var row = dsl.selectFrom(INTENTIONS).where(INTENTIONS.ID.eq(id)).fetchOne();
        if (row == null) return null;
        if (row.getFundingKind().equals("project")
                && !access.scopesHeldBy(caller.userId()).scopesOf("intention.read").contains("any")
                && !access.scopesHeldBy(caller.userId())
                        .projectIds()
                        .contains(row.getFundingProjectId())) return null;
        Map<String, Object> values = new LinkedHashMap<>();
        HeldScopes scopes = access.scopesHeldBy(caller.userId());
        boolean allowed =
                scopes.scopesOf("intention.edit").contains("any")
                        || (row.getFundingKind().equals("project")
                                && scopes.projectIds().contains(row.getFundingProjectId()));
        if (!allowed) {
            values.put(
                    "_refusal", ActResult.refused(403, "You may not change this intention", null));
            return values;
        }
        values.put("id", row.getId());
        values.put("name", row.getName());
        values.put("description", row.getDescription());
        values.put("funding_kind", row.getFundingKind());
        values.put("funding_project_id", row.getFundingProjectId());
        values.put("project_id", row.getProjectId());
        values.put("distribution_id", row.getDistributionId());
        values.put("mix_revision", row.getMixRevision());
        values.put("scope_category_id", row.getScopeCategoryId());
        values.put("scope_conditions", row.getScopeConditions());
        values.put("counts_from", row.getCountsFrom().toString());
        values.put("ends_on", row.getEndsOn() == null ? null : row.getEndsOn().toString());
        values.put("target_pages", row.getTargetPages());
        values.put("is_overall", row.getIsOverall());
        values.put(
                "archived_at", row.getArchivedAt() == null ? null : row.getArchivedAt().toString());
        return values;
    }

    private Map<String, Object> row(String userId, String id) {
        Object rows = reads.overview(userId).get("rows");
        if (!(rows instanceof List<?> values)) return null;
        for (Object value : values) {
            if (value instanceof Map<?, ?> candidate
                    && candidate.get("intention") instanceof Map<?, ?> intention
                    && id.equals(intention.get("id"))) {
                Map<String, Object> result = new LinkedHashMap<>();
                candidate.forEach((key, item) -> result.put(String.valueOf(key), item));
                Map<String, Object> intentionRow = new LinkedHashMap<>();
                intention.forEach((key, item) -> intentionRow.put(String.valueOf(key), item));
                result.put("intention", intentionRow);
                return result;
            }
        }
        return null;
    }

    private ActResult nameRefusal(String name, String except) {
        boolean exists =
                dsl.selectFrom(INTENTIONS).fetch().stream()
                        .anyMatch(
                                row ->
                                        !row.getId().equals(except)
                                                && row.getName().equalsIgnoreCase(name));
        return exists
                ? ActResult.refused(
                        422, "Another intention already has that name", "intention.name")
                : null;
    }

    private static ActResult overallRefusal() {
        return ActResult.refused(
                409, "The Overall intention cannot be archived or deleted", "intention.overall");
    }

    private static ActResult projectRefusal() {
        return ActResult.refused(
                409,
                "It is its project's intention: it changes, and goes, with the project",
                "intention.project");
    }

    private static String text(Map<String, Object> values, String key) {
        return (String) values.get(key);
    }

    private static Integer integer(Map<String, Object> values, String key) {
        return (Integer) values.get(key);
    }

    private static String nullableText(JsonNode node) {
        return node == null || node.isNull() || node.isMissingNode() ? null : node.asString();
    }

    private static Integer nullableInt(JsonNode node) {
        return node == null || node.isNull() || node.isMissingNode() ? null : node.asInt();
    }

    private static JSONB jsonb(JsonNode node) {
        return node == null || node.isNull() || node.isMissingNode()
                ? null
                : JSONB.valueOf(node.toString());
    }

    private record Mix(String id, Integer revision, ActResult refusal) {}

    private record Draft(
            String name,
            String description,
            String fundingKind,
            String projectId,
            String scopeCategoryId,
            List<JsonNode> conditions,
            String countsFrom,
            String endsOn,
            Integer targetPages,
            JsonNode mix) {
        static Draft from(JsonNode node) {
            JsonNode funding = node.path("funding");
            List<JsonNode> conditions = new ArrayList<>();
            node.path("scopeConditions").forEach(conditions::add);
            return new Draft(
                    node.path("name").asString(),
                    node.path("description").asString(),
                    funding.path("kind").asString(),
                    nullableText(funding.path("projectId")),
                    nullableText(node.path("scopeCategoryId")),
                    conditions,
                    node.path("countsFrom").asString(),
                    nullableText(node.path("endsOn")),
                    nullableInt(node.path("targetPages")),
                    node.path("mix"));
        }

        JSONB conditionsJson(JsonMapper mapper) {
            return conditions.isEmpty()
                    ? null
                    : JSONB.valueOf(mapper.writeValueAsString(conditions));
        }
    }
}

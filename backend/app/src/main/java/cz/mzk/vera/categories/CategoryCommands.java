package cz.mzk.vera.categories;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUP_CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.mixes.MixRefinements;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.RecordIds;
import cz.mzk.vera.web.RequestLanguage;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-category-create; ACT-category-save; ACT-category-delete; ACT-category-custody; ACT-category-refine.
@Service
class CategoryCommands {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final EventRecorder events;
    private final CategoryReads reads;
    private final MixRefinements mixes;
    private final Clock clock;
    private final JsonMapper json;

    CategoryCommands(DSLContext dsl, HeldAccessQueries access, EventRecorder events,
            CategoryReads reads, MixRefinements mixes, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.events = events;
        this.reads = reads;
        this.mixes = mixes;
        this.clock = clock;
        this.json = json;
    }

    // createCategory: PLAN-new-category-share; the new category has no mix share.
    @Transactional
    ActResult create(Caller caller, JsonNode body) {
        String parentId = body.path("parentId").isNull() ? null : body.path("parentId").asString();
        ActResult refusal = placeRefusal(caller, parentId);
        if (refusal != null) {
            return refusal;
        }
        JsonNode names = body.path("names");
        String name = legacyName(names);
        if (nameTaken(parentId, names, null)) {
            return ActResult.refused(409, "A category beside it already has that name", "category.name_taken");
        }
        String id = RecordIds.next("c", dsl.select(CATEGORIES.ID).from(CATEGORIES).fetch(CATEGORIES.ID));
        int position = dsl.select(coalesce(max(CATEGORIES.POSITION), -1).add(1))
                .from(CATEGORIES).fetchOne(0, int.class);
        dsl.insertInto(CATEGORIES).set(CATEGORIES.ID, id).set(CATEGORIES.NAME, name)
                .set(CATEGORIES.NAMES, org.jooq.JSONB.valueOf(names.toString()))
                .set(CATEGORIES.PARENT_ID, parentId).set(CATEGORIES.POSITION, position).execute();
        events.recordAct(EventCode.CATEGORY_CREATED, "category", id, caller,
                List.of(EventChanges.change("category", null, categoryValue(id, name, parentId))));
        return ActResult.ok(category(id));
    }

    // saveCategory: PLAN-move; a moved subtree starts without a share in the new sibling set.
    @Transactional
    ActResult save(Caller caller, String id, JsonNode body) {
        var category = dsl.selectFrom(CATEGORIES).where(CATEGORIES.ID.eq(id)).fetchOne();
        if (category == null) {
            return ActResult.unknown("category");
        }
        if (!mayOn(caller, "category.edit", id)) {
            return ActResult.refused(403, "You may not change this category", null);
        }
        String parentId = body.path("parentId").isNull() ? null : body.path("parentId").asString();
        boolean moved = !java.util.Objects.equals(category.getParentId(), parentId);
        if (moved && parentId != null && Categories.isInSubtree(categoryTree(), parentId, id)) {
            return ActResult.refused(422, "A category cannot go under itself", "category.under_itself");
        }
        if (moved) {
            ActResult refusal = placeRefusal(caller, parentId);
            if (refusal != null) {
                return refusal;
            }
        }
        JsonNode names = body.path("names");
        String name = legacyName(names);
        if (nameTaken(parentId, names, id)) {
            return ActResult.refused(409, "A category beside it already has that name", "category.name_taken");
        }
        String oldName = category.getName();
        String oldParent = category.getParentId();
        dsl.update(CATEGORIES).set(CATEGORIES.NAME, name)
                .set(CATEGORIES.NAMES, org.jooq.JSONB.valueOf(names.toString()))
                .set(CATEGORIES.PARENT_ID, parentId)
                .where(CATEGORIES.ID.eq(id)).execute();
        if (!oldName.equals(name)) {
            events.recordAct(EventCode.CATEGORY_RENAMED, "category", id, caller,
                    List.of(EventChanges.change("name", oldName, name)));
        }
        if (moved) {
            mixes.drop(id, now());
            events.recordAct(EventCode.CATEGORY_MOVED, "category", id, caller,
                    List.of(EventChanges.change("parentId", oldParent, parentId)));
        }
        return ActResult.ok(category(id));
    }

    // deleteCategory: PLAN-delete; custody and mix shares granted on the empty leaf go with it.
    @Transactional
    ActResult delete(Caller caller, String id) {
        var category = dsl.selectFrom(CATEGORIES).where(CATEGORIES.ID.eq(id)).fetchOne();
        if (category == null) {
            return ActResult.unknown("category");
        }
        if (!mayOn(caller, "category.edit", id)) {
            return ActResult.refused(403, "You may not delete this category", null);
        }
        if (dsl.fetchExists(dsl.selectOne().from(CATEGORIES).where(CATEGORIES.PARENT_ID.eq(id)))) {
            return ActResult.refused(409, "Only a category with nothing under it is deleted",
                    "category.has_children");
        }
        if (dsl.fetchExists(dsl.selectOne().from(ITERATIONS).where(ITERATIONS.CATEGORY_ID.eq(id)))) {
            return ActResult.refused(409, "It holds documents; reclassify them first",
                    "category.holds_documents");
        }
        if (dsl.fetchExists(dsl.selectOne().from(INTENTIONS).where(INTENTIONS.SCOPE_CATEGORY_ID.eq(id)))
                || dsl.fetchExists(dsl.selectOne().from(INTENTION_TEMPLATES)
                        .where(INTENTION_TEMPLATES.SCOPE_CATEGORY_ID.eq(id)))) {
            return ActResult.refused(409, "An intention is scoped to it", "category.scope");
        }
        mixes.drop(id, now());
        dsl.deleteFrom(CATEGORY_MEMBERS).where(CATEGORY_MEMBERS.CATEGORY_ID.eq(id)).execute();
        dsl.deleteFrom(GROUP_CATEGORIES).where(GROUP_CATEGORIES.CATEGORY_ID.eq(id)).execute();
        dsl.deleteFrom(CATEGORIES).where(CATEGORIES.ID.eq(id)).execute();
        events.recordAct(EventCode.CATEGORY_DELETED, "category", id, caller,
                List.of(EventChanges.change("category", categoryValue(id, category.getName(),
                        category.getParentId()), null)));
        return ActResult.noContent();
    }

    // saveCategoryCustody: ACCESS-grant-custody; replace the whole set of people and groups.
    @Transactional
    ActResult custody(Caller caller, String id, JsonNode body) {
        if (!dsl.fetchExists(dsl.selectOne().from(CATEGORIES).where(CATEGORIES.ID.eq(id)))) {
            return ActResult.unknown("category");
        }
        if (!mayOn(caller, "category.grant_custody", id)) {
            return ActResult.refused(403, "You may not grant custody here", null);
        }
        List<String> userIds = distinct(body.path("userIds"));
        List<String> groupIds = distinct(body.path("groupIds"));
        boolean unknown = userIds.stream().anyMatch(userId -> !dsl.fetchExists(dsl.selectOne().from(USERS)
                .where(USERS.ID.eq(userId).and(USERS.KIND.eq("person")))))
                || groupIds.stream().anyMatch(groupId -> !dsl.fetchExists(dsl.selectOne().from(GROUPS)
                        .where(GROUPS.ID.eq(groupId))));
        if (unknown) {
            return ActResult.refused(422, "Custody goes to existing groups and people",
                    "category.custody_member_unknown");
        }
        List<String> previousUsers = dsl.select(CATEGORY_MEMBERS.USER_ID).from(CATEGORY_MEMBERS)
                .where(CATEGORY_MEMBERS.CATEGORY_ID.eq(id)).orderBy(CATEGORY_MEMBERS.POSITION)
                .fetch(CATEGORY_MEMBERS.USER_ID);
        List<String> previousGroups = dsl.select(GROUP_CATEGORIES.GROUP_ID).from(GROUP_CATEGORIES)
                .where(GROUP_CATEGORIES.CATEGORY_ID.eq(id)).fetch(GROUP_CATEGORIES.GROUP_ID);
        dsl.deleteFrom(CATEGORY_MEMBERS).where(CATEGORY_MEMBERS.CATEGORY_ID.eq(id)).execute();
        for (int index = 0; index < userIds.size(); index++) {
            dsl.insertInto(CATEGORY_MEMBERS).set(CATEGORY_MEMBERS.CATEGORY_ID, id)
                    .set(CATEGORY_MEMBERS.USER_ID, userIds.get(index))
                    .set(CATEGORY_MEMBERS.POSITION, index).execute();
        }
        for (var group : dsl.selectFrom(GROUPS).orderBy(GROUPS.POSITION).fetch()) {
            List<String> categoryIds = dsl.select(GROUP_CATEGORIES.CATEGORY_ID).from(GROUP_CATEGORIES)
                    .where(GROUP_CATEGORIES.GROUP_ID.eq(group.getId()))
                    .orderBy(GROUP_CATEGORIES.POSITION).fetch(GROUP_CATEGORIES.CATEGORY_ID);
            categoryIds.remove(id);
            if (groupIds.contains(group.getId())) {
                categoryIds.add(id);
            }
            dsl.deleteFrom(GROUP_CATEGORIES).where(GROUP_CATEGORIES.GROUP_ID.eq(group.getId())).execute();
            for (int index = 0; index < categoryIds.size(); index++) {
                dsl.insertInto(GROUP_CATEGORIES).set(GROUP_CATEGORIES.GROUP_ID, group.getId())
                        .set(GROUP_CATEGORIES.CATEGORY_ID, categoryIds.get(index))
                        .set(GROUP_CATEGORIES.POSITION, index).execute();
            }
        }
        if (!previousUsers.equals(userIds) || !new LinkedHashSet<>(previousGroups).equals(
                new LinkedHashSet<>(groupIds))) {
            Map<String, Object> before = new LinkedHashMap<>();
            before.put("userIds", previousUsers);
            before.put("groupIds", previousGroups);
            Map<String, Object> after = new LinkedHashMap<>();
            after.put("userIds", userIds);
            after.put("groupIds", groupIds);
            events.recordAct(EventCode.CATEGORY_CUSTODY_CHANGED, "category", id, caller,
                    List.of(EventChanges.change("custody", before, after)));
        }
        return ActResult.ok(reads.categoryNode(caller.userId(), id));
    }

    // refineCategory: PLAN-refine; move all iterations, then write one History event per move.
    @Transactional
    ActResult refine(Caller caller, String id, JsonNode body) {
        var category = dsl.selectFrom(CATEGORIES).where(CATEGORIES.ID.eq(id)).fetchOne();
        if (category == null) {
            return ActResult.unknown("category");
        }
        if (!mayOn(caller, "category.edit", id)) {
            return ActResult.refused(403, "You may not change this category", null);
        }
        if (dsl.fetchExists(dsl.selectOne().from(CATEGORIES).where(CATEGORIES.PARENT_ID.eq(id)))) {
            return ActResult.refused(409, "Only a leaf is refined; this one has children already",
                    "category.has_children");
        }
        JsonNode names = body.path("names");
        String name = legacyName(names);
        if (nameTaken(id, names, null)) {
            return ActResult.refused(409, "A category beside it already has that name", "category.name_taken");
        }
        String childId = RecordIds.next("c", dsl.select(CATEGORIES.ID).from(CATEGORIES).fetch(CATEGORIES.ID));
        int position = dsl.select(coalesce(max(CATEGORIES.POSITION), -1).add(1))
                .from(CATEGORIES).fetchOne(0, int.class);
        OffsetDateTime at = now();
        dsl.insertInto(CATEGORIES).set(CATEGORIES.ID, childId).set(CATEGORIES.NAME, name)
                .set(CATEGORIES.NAMES, org.jooq.JSONB.valueOf(names.toString()))
                .set(CATEGORIES.PARENT_ID, id).set(CATEGORIES.POSITION, position).execute();
        mixes.refine(id, childId, at);
        List<String> iterationIds = dsl.select(ITERATIONS.ID).from(ITERATIONS)
                .where(ITERATIONS.CATEGORY_ID.eq(id)).fetch(ITERATIONS.ID);
        dsl.update(ITERATIONS).set(ITERATIONS.CATEGORY_ID, childId)
                .where(ITERATIONS.CATEGORY_ID.eq(id)).execute();
        List<Category> categoryTree = categoryTree();
        String fromName = pathName(categoryTree, id);
        String toName = pathName(categoryTree, childId);
        String correlation = Correlation.newId();
        for (String iterationId : iterationIds) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("category", Map.of("from", Map.of("id", id, "name", fromName),
                    "to", Map.of("id", childId, "name", toName)));
            data.put("priority", null);
            Map<String, Object> reason = new LinkedHashMap<>();
            reason.put("public", null);
            reason.put("internal", "As " + category.getName() + " was refined.");
            events.record(new EventInput(EventCode.ITERATION_RECLASSIFIED, "iteration", iterationId, null,
                    new EventInput.User(caller.userId()), correlation, at.toInstant(), json.valueToTree(data),
                    new EventInput.Reason(null, (String) reason.get("internal"))));
        }
        events.recordAct(EventCode.CATEGORY_REFINED, "category", id, caller,
                List.of(EventChanges.change("child", null, categoryValue(childId, name, id))), at.toInstant());
        return ActResult.ok(category(childId));
    }

    private ActResult placeRefusal(Caller caller, String parentId) {
        if (parentId != null && !dsl.fetchExists(dsl.selectOne().from(CATEGORIES)
                .where(CATEGORIES.ID.eq(parentId)))) {
            return ActResult.refused(422, "No category " + parentId, "category.not_found");
        }
        if (!mayOn(caller, "category.edit", parentId)) {
            return ActResult.refused(403, parentId == null
                    ? "Only an administrator changes the top level"
                    : "You may change the tree only inside your own custody", null);
        }
        if (parentId != null && !dsl.fetchExists(dsl.selectOne().from(CATEGORIES)
                .where(CATEGORIES.PARENT_ID.eq(parentId))) && dsl.fetchExists(dsl.selectOne().from(ITERATIONS)
                        .where(ITERATIONS.CATEGORY_ID.eq(parentId)))) {
            return ActResult.refused(409, "It holds documents, so it cannot take a child: refine it instead",
                    "category.holds_documents");
        }
        return null;
    }

    private boolean mayOn(Caller caller, String permission, String categoryId) {
        var held = access.scopesHeldBy(caller.userId());
        List<String> scopes = held.scopesOf(permission);
        if (categoryId == null) {
            return scopes.contains("any");
        }
        if (scopes.contains("any")) {
            return true;
        }
        if (!scopes.contains("custody")) {
            return false;
        }
        List<Category> tree = categoryTree();
        return held.custodyCategoryIds().stream().anyMatch(grant -> Categories.isInSubtree(tree, categoryId, grant));
    }

    private boolean nameTaken(String parentId, JsonNode names, String exceptId) {
        return dsl.selectFrom(CATEGORIES)
                .where(parentId == null ? CATEGORIES.PARENT_ID.isNull() : CATEGORIES.PARENT_ID.eq(parentId))
                .and(exceptId == null ? org.jooq.impl.DSL.trueCondition() : CATEGORIES.ID.ne(exceptId))
                .fetch().stream().anyMatch(row -> {
                    JsonNode existing = json.readTree(row.getNames().data());
                    return names.properties().stream().anyMatch(property -> existing.has(property.getKey())
                            && property.getValue().asString().trim().equalsIgnoreCase(
                                    existing.path(property.getKey()).asString()));
                });
    }

    private String legacyName(JsonNode names) {
        JsonNode value = names.get("en");
        if (value == null) {
            value = names.get("cs");
        }
        return value.asString().trim();
    }

    private List<Category> categoryTree() {
        return dsl.selectFrom(CATEGORIES).orderBy(CATEGORIES.POSITION)
                .fetch(row -> new Category(row.getId(), nameIn(row.getNames().data()), row.getParentId()));
    }

    private String nameIn(String storedNames) {
        JsonNode names = json.readTree(storedNames);
        String language = RequestLanguage.current();
        JsonNode chosen = names.get(language);
        if (chosen == null) {
            chosen = names.get("cs".equals(language) ? "en" : "cs");
        }
        return chosen.asString();
    }

    private String pathName(List<Category> tree, String id) {
        return Categories.categoryPathOf(tree, id).stream().map(Category::name)
                .collect(java.util.stream.Collectors.joining(" / "));
    }

    private Map<String, Object> categoryValue(String id, String name, String parentId) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", id);
        value.put("name", name);
        value.put("parentId", parentId);
        return value;
    }

    private Map<String, Object> category(String id) {
        return dsl.selectFrom(CATEGORIES).where(CATEGORIES.ID.eq(id)).fetchOne(row -> {
            Map<String, Object> result = categoryValue(row.getId(), nameIn(row.getNames().data()), row.getParentId());
            result.put("names", json.readTree(row.getNames().data()));
            return result;
        });
    }

    private List<String> distinct(JsonNode array) {
        LinkedHashSet<String> values = new LinkedHashSet<>();
        array.forEach(value -> values.add(value.asString()));
        return new ArrayList<>(values);
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }
}

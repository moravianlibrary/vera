package cz.mzk.vera.categories;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUP_CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static cz.mzk.vera.db.tables.Tables.MIXES;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBER_GROUPS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static cz.mzk.vera.domain.categories.Categories.custodyReachOf;
import static cz.mzk.vera.domain.categories.Categories.isInSubtree;
import static cz.mzk.vera.domain.categories.Categories.unheldCategoriesOf;
import static cz.mzk.vera.domain.lists.Lists.isInPool;
import static cz.mzk.vera.domain.lists.Lists.isScanned;

import cz.mzk.vera.db.tables.tables.records.IntentionsRecord;
import cz.mzk.vera.domain.categories.Categories.CustodyGroup;
import cz.mzk.vera.domain.categories.Categories.CustodyHolders;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.Distribution;
import cz.mzk.vera.domain.entities.Intention;
import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.intentions.CountingReads;
import cz.mzk.vera.intentions.CountingReads.CountingSnapshot;
import cz.mzk.vera.intentions.CountingReads.StoredIntention;
import cz.mzk.vera.intentions.CountingReads.StoredMix;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// PLAN-tree; PLAN-counting; PLAN-house-mix; ACCESS-category-custody.
@Repository
public class CategoryReads {
    private final DSLContext dsl;
    private final CountingReads counting;
    private final HeldAccessQueries access;

    public CategoryReads(DSLContext dsl, CountingReads counting, HeldAccessQueries access) {
        this.dsl = dsl;
        this.counting = counting;
        this.access = access;
    }

    public List<Map<String, Object>> categories() {
        return dsl.selectFrom(CATEGORIES).orderBy(CATEGORIES.POSITION).fetch(row -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", row.getId());
            result.put("name", row.getName());
            result.put("parentId", row.getParentId());
            return result;
        });
    }

    public boolean canRead(String userId) {
        return access.scopesHeldBy(userId).hasPermission("category.read");
    }

    public Map<String, Object> index(String userId, String requestedMixId) {
        CountingSnapshot data = counting.countingData();
        List<Category> categories = categoriesOf(data);
        CustodyHolders holders = holders();
        Map<String, List<Map<String, Object>>> grants = grantsByCategory();
        Map<String, String> userNames = userNames();
        Map<String, String> groupNames = groupNames();
        List<CategoryTotals> totals = totals(data, categories);
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> totalValues = new LinkedHashMap<>();
        putTotals(totalValues, totals(data.rules().iterations(), data, null, categories));
        result.put("totals", totalValues);
        result.put("nodes", categories.stream().map(category -> node(category, categories, holders,
                data, totals, grants, userNames, groupNames)).toList());
        StoredMix selected = selectedMix(data, requestedMixId);
        result.put("mix", access.scopesHeldBy(userId).hasPermission("mix.read")
                ? mixTree(data, selected) : null);
        result.put("unheldIds", unheldCategoriesOf(categories, holders).stream()
                .map(Category::id).toList());
        return result;
    }

    public Map<String, Object> impact(String userId, String categoryId) {
        CountingSnapshot data = counting.countingData();
        List<Category> categories = categoriesOf(data);
        Category category = categories.stream().filter(candidate -> candidate.id().equals(categoryId))
                .findFirst().orElse(null);
        if (category == null) {
            return null;
        }
        boolean canReadMixes = access.scopesHeldBy(userId).hasPermission("mix.read");
        List<StoredMix> withShare = data.mixes().stream()
                .filter(mix -> mix.shares().containsKey(categoryId)).toList();
        List<Map<String, Object>> shares = new ArrayList<>();
        if (canReadMixes) {
            for (StoredMix mix : withShare) {
                Map<String, Object> share = new LinkedHashMap<>();
                Map<String, Object> mixName = new LinkedHashMap<>();
                mixName.put("id", mix.id());
                mixName.put("name", mix.name());
                share.put("mix", mixName);
                share.put("share", mix.shares().get(categoryId));
                share.put("intentionCount", dsl.fetchCount(INTENTIONS,
                        INTENTIONS.DISTRIBUTION_ID.eq(mix.id())));
                shares.add(share);
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        CategoryTotals nodeTotals = totals(data.rules().iterations(), data, categoryId, categories);
        result.put("documentCount", nodeTotals.documentCount());
        result.put("pages", nodeTotals.pages());
        result.put("shares", shares);
        result.put("otherMixCount", withShare.size() - shares.size());
        result.put("grantCount", grantsByCategory().getOrDefault(categoryId, List.of()).size());
        result.put("scopedIntentions", scopedIntentions(userId, categoryId));
        result.put("scopedIntentionCount", dsl.fetchCount(INTENTIONS,
                INTENTIONS.SCOPE_CATEGORY_ID.eq(categoryId))
                + dsl.fetchCount(INTENTION_TEMPLATES,
                        INTENTION_TEMPLATES.SCOPE_CATEGORY_ID.eq(categoryId)));
        return result;
    }

    private Map<String, Object> node(Category category, List<Category> categories,
            CustodyHolders holders, CountingSnapshot data, List<CategoryTotals> totals,
            Map<String, List<Map<String, Object>>> grants, Map<String, String> userNames,
            Map<String, String> groupNames) {
        CategoryTotals value = totals.stream().filter(item -> item.categoryId().equals(category.id())
                ).findFirst().orElseThrow();
        Map<String, Object> result = new LinkedHashMap<>();
        putTotals(result, value);
        result.put("categoryId", category.id());
        result.put("grants", grants.getOrDefault(category.id(), List.of()));
        result.put("reach", custodyReachOf(categories, holders, category.id()).stream().map(reach -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userId", reach.userId());
            item.put("name", userNames.getOrDefault(reach.userId(), reach.userId()));
            if (reach.groupId() == null) {
                item.put("group", null);
            } else {
                Map<String, Object> group = new LinkedHashMap<>();
                group.put("id", reach.groupId());
                group.put("name", groupNames.getOrDefault(reach.groupId(), reach.groupId()));
                item.put("group", group);
            }
            Map<String, Object> grantedOn = new LinkedHashMap<>();
            grantedOn.put("id", reach.categoryId());
            grantedOn.put("name", categories.stream().filter(candidate -> candidate.id()
                    .equals(reach.categoryId())).map(Category::name).findFirst().orElse(reach.categoryId()));
            item.put("grantedOn", grantedOn);
            return item;
        }).toList());
        return result;
    }

    private List<CategoryTotals> totals(CountingSnapshot data, List<Category> categories) {
        return categories.stream().map(category -> {
            CategoryTotals counts = totals(data.rules().iterations(), data, category.id(), categories);
            return new CategoryTotals(category.id(), counts.documentCount(), counts.pages(),
                    counts.deliveredPages(), counts.readyPages());
        }).toList();
    }

    private CategoryTotals totals(List<cz.mzk.vera.domain.entities.Iteration> iterations,
            CountingSnapshot data, String categoryId, List<Category> categories) {
        List<cz.mzk.vera.domain.entities.Iteration> selected = categoryId == null ? iterations
                : iterations.stream().filter(iteration -> isInSubtree(categories, iteration.categoryId(),
                        categoryId)).toList();
        int pages = selected.stream().map(data.pagesOf()).filter(Objects::nonNull)
                .mapToInt(Integer::intValue).sum();
        int delivered = selected.stream().filter(iteration -> isScanned(iteration)).map(data.pagesOf())
                .filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
        int ready = selected.stream().filter(iteration -> isInPool(iteration)).map(data.pagesOf())
                .filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
        return new CategoryTotals(categoryId, selected.size(), pages, delivered, ready);
    }

    private Map<String, Object> mixTree(CountingSnapshot data, StoredMix selected) {
        if (selected == null) {
            return null;
        }
        List<Category> categories = categoriesOf(data);
        StoredIntention overall = counting.overallIntention(data);
        Intention intention = overall.rule();
        String description = dsl.select(INTENTIONS.DESCRIPTION).from(INTENTIONS)
                .where(INTENTIONS.ID.eq(intention.id())).fetchOne(INTENTIONS.DESCRIPTION);
        Map<String, Object> wireIntention = intentionWire(overall, selected.id(), description);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mixId", selected.id());
        result.put("mixName", selected.name());
        result.put("intention", wireIntention);
        result.put("outputPages", 0);
        Map<String, Object> top = siblingSet(categories, selected.shares(), null);
        result.put("unallocated", top.get("unallocated"));
        result.put("noShareIds", top.get("noShareIds"));
        List<Map<String, Object>> nodes = new ArrayList<>();
        for (Category category : categories) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("categoryId", category.id());
            item.put("share", category.parentId() == null
                    ? selected.shares().get(category.id()) : selected.shares().get(category.id()));
            item.put("ofWhole", Intentions.shareWithinOf(categories,
                    new Distribution(selected.shares()), null, category.id()));
            item.put("actual", null);
            Map<String, Object> set = siblingSet(categories, selected.shares(), category.id());
            item.put("unallocated", set.get("unallocated"));
            item.put("noShareIds", set.get("noShareIds"));
            nodes.add(item);
        }
        result.put("nodes", nodes);
        return result;
    }

    private Map<String, Object> intentionWire(StoredIntention stored, String mixId, String description) {
        Intention intention = stored.rule();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("description", description);
        Map<String, Object> funding = new LinkedHashMap<>();
        funding.put("kind", intention.funding().kind());
        if ("project".equals(intention.funding().kind())) {
            funding.put("projectId", intention.funding().projectId());
        }
        result.put("funding", funding);
        result.put("projectId", stored.projectId());
        result.put("scopeCategoryId", intention.scopeCategoryId());
        result.put("distributionId", mixId);
        result.put("targetPages", intention.targetPages());
        result.put("endsOn", intention.endsOn());
        result.put("isOverall", intention.isOverall());
        result.put("templateId", null);
        result.put("archived", null);
        result.put("id", intention.id());
        result.put("name", stored.name());
        result.put("countsFrom", intention.countsFrom());
        result.put("mixRevision", null);
        return result;
    }

    private Map<String, Object> siblingSet(List<Category> categories, Map<String, Double> shares,
            String parentId) {
        List<Category> children = categories.stream()
                .filter(category -> Objects.equals(category.parentId(), parentId)).toList();
        double allocated = children.stream().mapToDouble(child -> shares.getOrDefault(child.id(), 0.0)).sum();
        List<String> noShareIds = children.stream().filter(child -> !shares.containsKey(child.id()))
                .map(Category::id).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("unallocated", children.isEmpty() ? 0 : Math.max(0, 100 - allocated));
        result.put("noShareIds", noShareIds);
        return result;
    }

    private Map<String, List<Map<String, Object>>> grantsByCategory() {
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        dsl.select(GROUPS.ID, GROUPS.NAME, GROUP_CATEGORIES.CATEGORY_ID).from(GROUPS)
                .join(GROUP_CATEGORIES).on(GROUP_CATEGORIES.GROUP_ID.eq(GROUPS.ID))
                .orderBy(GROUPS.POSITION, GROUP_CATEGORIES.POSITION)
                .fetch().forEach(row -> {
                    Map<String, Object> grant = new LinkedHashMap<>();
                    grant.put("kind", "group");
                    grant.put("id", row.get(GROUPS.ID));
                    grant.put("name", row.get(GROUPS.NAME));
                    result.computeIfAbsent(row.get(GROUP_CATEGORIES.CATEGORY_ID),
                            ignored -> new ArrayList<>()).add(grant);
                });
        dsl.select(USERS.ID, USERS.NAME, CATEGORY_MEMBERS.CATEGORY_ID).from(USERS)
                .join(CATEGORY_MEMBERS).on(CATEGORY_MEMBERS.USER_ID.eq(USERS.ID))
                .orderBy(CATEGORY_MEMBERS.CATEGORY_ID, CATEGORY_MEMBERS.POSITION)
                .fetch().forEach(row -> {
                    Map<String, Object> grant = new LinkedHashMap<>();
                    grant.put("kind", "person");
                    grant.put("id", row.get(USERS.ID));
                    grant.put("name", row.get(USERS.NAME));
                    result.computeIfAbsent(row.get(CATEGORY_MEMBERS.CATEGORY_ID),
                            ignored -> new ArrayList<>()).add(grant);
                });
        return result;
    }

    private Map<String, String> userNames() {
        Map<String, String> result = new LinkedHashMap<>();
        dsl.select(USERS.ID, USERS.NAME).from(USERS).orderBy(USERS.POSITION).fetch()
                .forEach(row -> result.put(row.get(USERS.ID), row.get(USERS.NAME)));
        return result;
    }

    private Map<String, String> groupNames() {
        Map<String, String> result = new LinkedHashMap<>();
        dsl.select(GROUPS.ID, GROUPS.NAME).from(GROUPS).orderBy(GROUPS.POSITION).fetch()
                .forEach(row -> result.put(row.get(GROUPS.ID), row.get(GROUPS.NAME)));
        return result;
    }

    private CustodyHolders holders() {
        Map<String, List<String>> members = new LinkedHashMap<>();
        dsl.select(CATEGORY_MEMBERS.CATEGORY_ID, CATEGORY_MEMBERS.USER_ID).from(CATEGORY_MEMBERS)
                .orderBy(CATEGORY_MEMBERS.CATEGORY_ID, CATEGORY_MEMBERS.POSITION).fetch()
                .forEach(row -> members.computeIfAbsent(row.get(CATEGORY_MEMBERS.CATEGORY_ID),
                        ignored -> new ArrayList<>()).add(row.get(CATEGORY_MEMBERS.USER_ID)));
        Map<String, List<String>> groupCategories = new LinkedHashMap<>();
        dsl.select(GROUP_CATEGORIES.GROUP_ID, GROUP_CATEGORIES.CATEGORY_ID).from(GROUP_CATEGORIES)
                .orderBy(GROUP_CATEGORIES.GROUP_ID, GROUP_CATEGORIES.POSITION).fetch()
                .forEach(row -> groupCategories.computeIfAbsent(row.get(GROUP_CATEGORIES.GROUP_ID),
                        ignored -> new ArrayList<>()).add(row.get(GROUP_CATEGORIES.CATEGORY_ID)));
        Map<String, List<String>> groupMembers = new LinkedHashMap<>();
        dsl.select(GROUP_MEMBERS.GROUP_ID, GROUP_MEMBERS.USER_ID).from(GROUP_MEMBERS)
                .orderBy(GROUP_MEMBERS.GROUP_ID, GROUP_MEMBERS.POSITION).fetch()
                .forEach(row -> groupMembers.computeIfAbsent(row.get(GROUP_MEMBERS.GROUP_ID),
                        ignored -> new ArrayList<>()).add(row.get(GROUP_MEMBERS.USER_ID)));
        List<CustodyGroup> groups = dsl.selectFrom(GROUPS).orderBy(GROUPS.POSITION).fetch(row ->
                new CustodyGroup(row.getId(), row.getName(),
                        groupCategories.getOrDefault(row.getId(), List.of()),
                        groupMembers.getOrDefault(row.getId(), List.of())));
        return new CustodyHolders(groups, members);
    }

    private List<Map<String, Object>> scopedIntentions(String userId, String categoryId) {
        HeldScopes scopes = access.scopesHeldBy(userId);
        return dsl.selectFrom(INTENTIONS).where(INTENTIONS.SCOPE_CATEGORY_ID.eq(categoryId))
                .orderBy(INTENTIONS.POSITION).fetch().stream().filter(row -> intentionVisible(scopes, row))
                .map(row -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", row.getId());
                    item.put("name", row.getName());
                    return item;
                }).toList();
    }

    private boolean intentionVisible(HeldScopes scopes, IntentionsRecord row) {
        if (row.getProjectId() != null) {
            String state = dsl.select(PROJECTS.STATE).from(PROJECTS)
                    .where(PROJECTS.ID.eq(row.getProjectId())).fetchOne(PROJECTS.STATE);
            if ("Proposed".equals(state)) {
                return false;
            }
        }
        if (!scopes.hasPermission("intention.read")) {
            return false;
        }
        List<String> heldScopes = scopes.scopesOf("intention.read");
        if (heldScopes.contains("any") || heldScopes.contains("own")) {
            return true;
        }
        if (!"project".equals(row.getFundingKind())) {
            return false;
        }
        String projectId = row.getFundingProjectId();
        var project = dsl.select(PROJECTS.MANAGER_ID).from(PROJECTS)
                .where(PROJECTS.ID.eq(projectId)).fetchOne();
        if (project == null) {
            return false;
        }
        List<String> memberIds = dsl.select(PROJECT_MEMBERS.USER_ID).from(PROJECT_MEMBERS)
                .where(PROJECT_MEMBERS.PROJECT_ID.eq(projectId))
                .orderBy(PROJECT_MEMBERS.POSITION).fetch(PROJECT_MEMBERS.USER_ID);
        List<String> groupIds = dsl.select(PROJECT_MEMBER_GROUPS.GROUP_ID).from(PROJECT_MEMBER_GROUPS)
                .where(PROJECT_MEMBER_GROUPS.PROJECT_ID.eq(projectId))
                .orderBy(PROJECT_MEMBER_GROUPS.POSITION).fetch(PROJECT_MEMBER_GROUPS.GROUP_ID);
        return scopes.reachesProject("intention.read", project.get(PROJECTS.MANAGER_ID), memberIds,
                groupIds);
    }

    private List<Category> categoriesOf(CountingSnapshot data) {
        return dsl.selectFrom(CATEGORIES).orderBy(CATEGORIES.POSITION).fetch(row ->
                new Category(row.getId(), row.getName(), row.getParentId()));
    }

    private StoredMix selectedMix(CountingSnapshot data, String mixId) {
        StoredMix requested = data.mixes().stream()
                .filter(mix -> mix.id().equals(mixId) && mix.archivedAt() == null).findFirst().orElse(null);
        if (requested != null) {
            return requested;
        }
        String primaryId = dsl.select(MIXES.ID).from(MIXES)
                .where(MIXES.IS_PRIMARY.isTrue().and(MIXES.ARCHIVED_AT.isNull()))
                .orderBy(MIXES.POSITION).fetchOne(MIXES.ID);
        return data.mixes().stream().filter(mix -> mix.id().equals(primaryId)).findFirst().orElse(null);
    }

    private void putTotals(Map<String, Object> target, CategoryTotals totals) {
        target.put("documentCount", totals.documentCount());
        target.put("pages", totals.pages());
        target.put("deliveredPages", totals.deliveredPages());
        target.put("readyPages", totals.readyPages());
    }

    private record CategoryTotals(String categoryId, int documentCount, int pages,
            int deliveredPages, int readyPages) {}
}

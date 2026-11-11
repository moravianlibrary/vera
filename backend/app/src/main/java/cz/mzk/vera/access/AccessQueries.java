package cz.mzk.vera.access;

import static cz.mzk.vera.db.tables.Tables.GROUP_CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBER_GROUPS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_GROUPS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static cz.mzk.vera.db.tables.Tables.WATCHLISTS;
import static org.jooq.impl.DSL.countDistinct;
import static org.jooq.impl.DSL.notExists;

import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.login.IdentityInstances;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Instants;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.Clock;
import java.time.ZoneOffset;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.JsonNode;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// ACCESS-role-ways; ACCESS-group; ACCESS-suspend: the Users & Groups person projection.
@Repository
public class AccessQueries {
    private final DSLContext dsl;
    private final Clock clock;
    private final JsonMapper json;
    private final IdentityInstances identityInstances;
    private final HeldAccessQueries heldAccess;

    public AccessQueries(DSLContext dsl, Clock clock, JsonMapper json, IdentityInstances identityInstances,
            HeldAccessQueries heldAccess) {
        this.dsl = dsl;
        this.clock = clock;
        this.json = json;
        this.identityInstances = identityInstances;
        this.heldAccess = heldAccess;
    }

    public List<Map<String, Object>> publicUsers() {
        return dsl.select(USERS.ID, USERS.NAME, USERS.KIND, USERS.EMAIL).from(USERS)
            .orderBy(USERS.POSITION).fetch(row -> {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("id", row.get(USERS.ID));
                result.put("name", row.get(USERS.NAME));
                result.put("kind", row.get(USERS.KIND));
                result.put("email", row.get(USERS.EMAIL));
                return result;
            });
    }

    public List<Map<String, Object>> roleNames() {
        return dsl.select(ROLES.ID, ROLES.NAME).from(ROLES).orderBy(ROLES.POSITION).fetch(row -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", row.get(ROLES.ID));
            result.put("name", row.get(ROLES.NAME));
            return result;
        });
    }

    public List<Map<String, Object>> referenceGroups() {
        return dsl.selectFrom(GROUPS).orderBy(GROUPS.POSITION).fetch(row -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", row.getId());
            result.put("name", row.getName());
            result.put("peopleCount", dsl.selectCount().from(GROUP_MEMBERS)
                    .where(GROUP_MEMBERS.GROUP_ID.eq(row.getId())).fetchOne(0, int.class));
            return result;
        });
    }

    public Map<String, Object> index() {
        List<Map<String, Object>> custodies = dsl.selectFrom(REQUEST_CUSTODIES)
            .orderBy(REQUEST_CUSTODIES.IS_FALLBACK.desc(), REQUEST_CUSTODIES.POSITION)
            .fetch(row -> {
                String id = row.getId();
                Map<String, Object> custody = new LinkedHashMap<>();
                custody.put("id", id);
                custody.put("name", row.getName());
                custody.put("description", row.getDescription());
                custody.put("isFallback", row.getIsFallback());
                custody.put("memberIds", dsl.select(REQUEST_CUSTODY_MEMBERS.USER_ID)
                    .from(REQUEST_CUSTODY_MEMBERS).where(REQUEST_CUSTODY_MEMBERS.CUSTODY_ID.eq(id))
                    .orderBy(REQUEST_CUSTODY_MEMBERS.POSITION).fetch(REQUEST_CUSTODY_MEMBERS.USER_ID));
                custody.put("groupIds", dsl.select(REQUEST_CUSTODY_GROUPS.GROUP_ID)
                    .from(REQUEST_CUSTODY_GROUPS).where(REQUEST_CUSTODY_GROUPS.CUSTODY_ID.eq(id))
                    .orderBy(REQUEST_CUSTODY_GROUPS.POSITION).fetch(REQUEST_CUSTODY_GROUPS.GROUP_ID));
                custody.put("openCount", openCount(id, row.getIsFallback()));
                custody.put("placedByIds", ruleIdsForCustody(id));
                return custody;
            });
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("asOf", clock.instant().atOffset(ZoneOffset.UTC).toInstant().toString());
        result.put("users", dsl.select(USERS.ID).from(USERS).orderBy(USERS.POSITION)
            .fetch(row -> user(row.value1())));
        result.put("roles", roles());
        result.put("groups", groups());
        result.put("custodies", custodies);
        result.put("identityInstances", identityInstances.all().stream().map(instance -> {
            IdentityInstances.AccessInstance identity = instance.accessInstance();
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", identity.id());
            entry.put("name", identity.name());
            entry.put("userIdClaim", identity.userIdClaim());
            entry.put("defaultRoleId", identity.defaultRoleId());
            entry.put("mappings", identity.mappings().stream().map(mapping -> Map.of(
                    "claim", mapping.claim(), "roleId", mapping.roleId())).toList());
            entry.put("isLocal", identity.isLocal());
            entry.put("isEnabled", identity.isEnabled());
            return entry;
        }).toList());
        result.put("categoryMemberships", dsl.select(CATEGORY_MEMBERS.CATEGORY_ID,
                CATEGORY_MEMBERS.USER_ID).from(CATEGORY_MEMBERS)
                .orderBy(CATEGORY_MEMBERS.CATEGORY_ID, CATEGORY_MEMBERS.POSITION).fetchGroups(
                        row -> row.get(CATEGORY_MEMBERS.CATEGORY_ID), row -> row.get(CATEGORY_MEMBERS.USER_ID))
                .entrySet().stream().map(entry -> Map.of("categoryId", entry.getKey(),
                        "userIds", entry.getValue())).toList());
        result.put("categories", dsl.selectFrom(CATEGORIES).orderBy(CATEGORIES.POSITION).fetch(row -> {
            Map<String, Object> category = new LinkedHashMap<>();
            category.put("id", row.getId());
            category.put("name", row.getName());
            category.put("parentId", row.getParentId());
            return category;
        }));
        result.put("proposals", proposals());
        result.put("projects", dsl.selectFrom(PROJECTS).orderBy(PROJECTS.POSITION).fetch(row -> {
            Map<String, Object> project = new LinkedHashMap<>();
            project.put("id", row.getId());
            project.put("name", row.getName());
            project.put("managerId", row.getManagerId());
            project.put("memberIds", dsl.select(PROJECT_MEMBERS.USER_ID).from(PROJECT_MEMBERS)
                    .where(PROJECT_MEMBERS.PROJECT_ID.eq(row.getId())).orderBy(PROJECT_MEMBERS.POSITION)
                    .fetch(PROJECT_MEMBERS.USER_ID));
            project.put("memberGroupIds", dsl.select(PROJECT_MEMBER_GROUPS.GROUP_ID)
                    .from(PROJECT_MEMBER_GROUPS).where(PROJECT_MEMBER_GROUPS.PROJECT_ID.eq(row.getId()))
                    .orderBy(PROJECT_MEMBER_GROUPS.POSITION).fetch(PROJECT_MEMBER_GROUPS.GROUP_ID));
            return project;
        }));
        result.put("sharedWatchlists", sharedWatchlists());
        result.put("properties", dsl.selectFrom(PROPERTY_DEFINITIONS).orderBy(PROPERTY_DEFINITIONS.POSITION)
                .fetch(row -> {
                    Map<String, Object> property = new LinkedHashMap<>();
                    property.put("key", row.getKey());
                    property.put("name", json.readTree(row.getNames().data()).path("en").asString());
                    return property;
                }));
        return result;
    }

    private int openCount(String custodyId, boolean isFallback) {
        int placed = dsl.select(countDistinct(REQUESTS.DOCUMENT_ID)).from(REQUESTS)
                .join(REQUEST_PLACEMENTS).on(REQUEST_PLACEMENTS.REQUEST_ID.eq(REQUESTS.ID))
                .where(REQUESTS.DECISION.eq("Pending").and(REQUEST_PLACEMENTS.CUSTODY_ID.eq(custodyId)))
                .fetchOne(0, int.class);
        if (!isFallback) {
            return placed;
        }
        int unplaced = dsl.select(countDistinct(REQUESTS.DOCUMENT_ID)).from(REQUESTS)
                .where(REQUESTS.DECISION.eq("Pending").and(notExists(dsl.selectOne().from(REQUEST_PLACEMENTS)
                        .where(REQUEST_PLACEMENTS.REQUEST_ID.eq(REQUESTS.ID)))))
                .fetchOne(0, int.class);
        return placed + unplaced;
    }

    private List<Map<String, Object>> sharedWatchlists() {
        List<String> userIds = dsl.select(USERS.ID).from(USERS).orderBy(USERS.POSITION)
                .fetch(row -> row.get(USERS.ID));
        return dsl.selectFrom(WATCHLISTS).orderBy(WATCHLISTS.POSITION).fetch(watchlist -> {
            var audience = json.readTree(watchlist.getAudience().data());
            if ("personal".equals(audience.path("kind").asString())) {
                return null;
            }
            List<String> reached = new ArrayList<>();
            List<String> outOfView = new ArrayList<>();
            for (String userId : userIds) {
                var access = heldAccess.heldBy(userId);
                boolean inAudience = "everyone".equals(audience.path("kind").asString())
                        || Permissions.hasPermission(access.grants(), "watchlist.manage_system")
                        || matchesGroupAudience(userId, audience.path("groupIds"))
                        || matchesRoleAudience(access.roleIds(), audience.path("roleIds"));
                if (!inAudience) {
                    continue;
                }
                (canOpenWatchlistView(access.grants(), watchlist.getView())
                        ? reached : outOfView).add(userId);
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("name", watchlist.getName());
            result.put("filter", json.readTree(watchlist.getFilter().data()));
            result.put("view", watchlist.getView());
            result.put("createdAt", Instants.format(watchlist.getCreatedAt().toInstant()));
            result.put("id", watchlist.getId());
            result.put("audience", audience);
            result.put("ownerId", watchlist.getOwnerId());
            result.put("reachedUserIds", reached);
            result.put("outOfViewUserIds", outOfView);
            return result;
        }).stream().filter(java.util.Objects::nonNull).toList();
    }

    private boolean matchesGroupAudience(String userId, JsonNode groupIds) {
        for (JsonNode groupId : groupIds) {
            if (dsl.fetchExists(dsl.selectOne().from(GROUP_MEMBERS)
                    .where(GROUP_MEMBERS.USER_ID.eq(userId)
                            .and(GROUP_MEMBERS.GROUP_ID.eq(groupId.asString()))))) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesRoleAudience(List<String> roleIds, JsonNode audienceRoleIds) {
        for (JsonNode roleId : audienceRoleIds) {
            if (roleIds.contains(roleId.asString())) {
                return true;
            }
        }
        return false;
    }

    private boolean canOpenWatchlistView(List<Grant> grants, String view) {
        return switch (view) {
            case "documents" -> Permissions.hasPermission(grants, "iteration.read");
            case "my-documents" -> Permissions.hasPermission(grants, "request.read_mine");
            case "requests" -> Permissions.hasPermission(grants, "request.read");
            case "validations" -> Permissions.hasPermission(grants, "validation.approve")
                    || Permissions.hasPermission(grants, "validation.deny")
                    || Permissions.hasPermission(grants, "validation.revoke");
            case "lists" -> Permissions.hasPermission(grants, "list.read");
            case "projects" -> Permissions.hasPermission(grants, "project.read");
            case "categories" -> Permissions.hasPermission(grants, "category.read");
            case "mixes" -> Permissions.hasPermission(grants, "mix.read");
            case "intentions" -> Permissions.hasPermission(grants, "intention.read");
            case "tasks" -> Permissions.hasPermission(grants, "task.read_own")
                    || Permissions.hasPermission(grants, "task.read");
            default -> false;
        };
    }

    private List<Map<String, Object>> proposals() {
        Map<String, Set<String>> custodyIdsByDocument = new LinkedHashMap<>();
        dsl.select(REQUESTS.DOCUMENT_ID, REQUEST_CUSTODIES.ID).from(REQUESTS)
                .join(REQUEST_PLACEMENTS).on(REQUEST_PLACEMENTS.REQUEST_ID.eq(REQUESTS.ID))
                .join(REQUEST_CUSTODIES).on(REQUEST_CUSTODIES.ID.eq(REQUEST_PLACEMENTS.CUSTODY_ID))
                .where(REQUESTS.DECISION.eq("Pending"))
                .orderBy(REQUESTS.DOCUMENT_ID, REQUEST_CUSTODIES.POSITION).fetch()
                .forEach(row -> custodyIdsByDocument.computeIfAbsent(row.value1(), ignored -> new LinkedHashSet<>())
                        .add(row.value2()));
        return dsl.select(DOCUMENTS.ID, DOCUMENTS.TITLE).from(DOCUMENTS)
                .where(DOCUMENTS.ID.in(dsl.select(REQUESTS.DOCUMENT_ID).from(REQUESTS)
                        .where(REQUESTS.DECISION.eq("Pending"))))
                .orderBy(DOCUMENTS.ID).fetch(row -> {
                    Map<String, Object> proposal = new LinkedHashMap<>();
                    proposal.put("id", row.get(DOCUMENTS.ID));
                    proposal.put("title", row.get(DOCUMENTS.TITLE));
                    List<String> placements = new ArrayList<>(
                            custodyIdsByDocument.getOrDefault(row.get(DOCUMENTS.ID), Set.of()));
                    if (placements.isEmpty()) {
                        String fallback = dsl.select(REQUEST_CUSTODIES.ID).from(REQUEST_CUSTODIES)
                                .where(REQUEST_CUSTODIES.IS_FALLBACK.isTrue())
                                .fetchOne(REQUEST_CUSTODIES.ID);
                        placements = fallback == null ? List.of() : List.of(fallback);
                    }
                    proposal.put("custodyIds", placements);
                    return proposal;
                });
    }

    public Map<String, Object> user(String userId) {
        var user = dsl.selectFrom(USERS).where(USERS.ID.eq(userId)).fetchOne();
        if (user == null) {
            return null;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", user.getId());
        result.put("name", user.getName());
        result.put("kind", user.getKind());
        result.put("email", user.getEmail());
        result.put("entry", user.getEntry());
        result.put("handRoleIds", dsl.select(USER_HAND_ROLES.ROLE_ID).from(USER_HAND_ROLES)
            .where(USER_HAND_ROLES.USER_ID.eq(userId))
            .orderBy(USER_HAND_ROLES.POSITION)
            .fetch(USER_HAND_ROLES.ROLE_ID));
        result.put("mappedRoles", dsl.selectFrom(USER_MAPPED_ROLES)
            .where(USER_MAPPED_ROLES.USER_ID.eq(userId))
            .orderBy(USER_MAPPED_ROLES.POSITION)
            .fetch(row -> Map.of(
                "roleId", row.getRoleId(),
                "instanceId", row.getInstanceId(),
                "claim", row.getClaim())));
        result.put("groupIds", dsl.select(GROUP_MEMBERS.GROUP_ID).from(GROUP_MEMBERS)
            .where(GROUP_MEMBERS.USER_ID.eq(userId))
            .orderBy(GROUP_MEMBERS.POSITION)
            .fetch(GROUP_MEMBERS.GROUP_ID));
        result.put("identities", dsl.selectFrom(USER_IDENTITIES)
            .where(USER_IDENTITIES.USER_ID.eq(userId))
            .orderBy(USER_IDENTITIES.POSITION)
            .fetch(row -> {
                Map<String, Object> identity = new LinkedHashMap<>();
                identity.put("instanceId", row.getInstanceId());
                identity.put("externalId", row.getExternalId());
                identity.put("lastLoginAt", row.getLastLoginAt() == null
                    ? null
                    : Instants.format(row.getLastLoginAt().toInstant()));
                return identity;
            }));
        result.put("suspendedAt", user.getSuspendedAt() == null
            ? null
            : Instants.format(user.getSuspendedAt().toInstant()));
        return result;
    }

    public Map<String, Object> role(String roleId) {
        var role = dsl.selectFrom(ROLES).where(ROLES.ID.eq(roleId)).fetchOne();
        if (role == null) {
            return null;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", role.getId());
        result.put("name", role.getName());
        result.put("description", role.getDescription());
        result.put("isShipped", role.getIsShipped());
        result.put("grants", dsl.selectFrom(ROLE_GRANTS).where(ROLE_GRANTS.ROLE_ID.eq(roleId))
            .orderBy(ROLE_GRANTS.POSITION)
            .fetch(row -> new Grant(row.getPermission(), row.getScope())));
        result.put("proposalBatchLimit", role.getProposalBatchLimit());
        result.put("proposalDailyLimit", role.getProposalDailyLimit());
        return result;
    }

    public List<Map<String, Object>> roles() {
        Map<String, List<Grant>> grantsByRole = new LinkedHashMap<>();
        var roles = dsl.selectFrom(ROLES).orderBy(ROLES.POSITION).fetch();
        dsl.select(ROLE_GRANTS.ROLE_ID, ROLE_GRANTS.PERMISSION, ROLE_GRANTS.SCOPE)
            .from(ROLE_GRANTS)
            .orderBy(ROLE_GRANTS.ROLE_ID, ROLE_GRANTS.POSITION)
            .fetch()
            .forEach(row -> grantsByRole.computeIfAbsent(
                row.get(ROLE_GRANTS.ROLE_ID), ignored -> new ArrayList<>())
                .add(new Grant(row.get(ROLE_GRANTS.PERMISSION), row.get(ROLE_GRANTS.SCOPE))));
        return roles.map(row -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", row.getId());
            result.put("name", row.getName());
            result.put("description", row.getDescription());
            result.put("isShipped", row.getIsShipped());
            result.put("grants", grantsByRole.getOrDefault(row.getId(), List.of()));
            result.put("proposalBatchLimit", row.getProposalBatchLimit());
            result.put("proposalDailyLimit", row.getProposalDailyLimit());
            return result;
        });
    }

    public Map<String, Object> group(String groupId) {
        var group = dsl.selectFrom(GROUPS).where(GROUPS.ID.eq(groupId)).fetchOne();
        if (group == null) {
            return null;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", group.getId());
        result.put("name", group.getName());
        result.put("description", group.getDescription());
        result.put("memberIds", dsl.select(GROUP_MEMBERS.USER_ID).from(GROUP_MEMBERS)
            .where(GROUP_MEMBERS.GROUP_ID.eq(groupId)).orderBy(GROUP_MEMBERS.POSITION)
            .fetch(GROUP_MEMBERS.USER_ID));
        result.put("categoryIds", dsl.select(GROUP_CATEGORIES.CATEGORY_ID).from(GROUP_CATEGORIES)
            .where(GROUP_CATEGORIES.GROUP_ID.eq(groupId)).orderBy(GROUP_CATEGORIES.POSITION)
            .fetch(GROUP_CATEGORIES.CATEGORY_ID));
        return result;
    }

    public Map<String, Object> custody(String custodyId) {
        var custody = dsl.selectFrom(REQUEST_CUSTODIES)
                .where(REQUEST_CUSTODIES.ID.eq(custodyId)).fetchOne();
        if (custody == null) {
            return null;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", custody.getId());
        result.put("name", custody.getName());
        result.put("description", custody.getDescription());
        result.put("isFallback", custody.getIsFallback());
        result.put("memberIds", dsl.select(REQUEST_CUSTODY_MEMBERS.USER_ID)
                .from(REQUEST_CUSTODY_MEMBERS).where(REQUEST_CUSTODY_MEMBERS.CUSTODY_ID.eq(custodyId))
                .orderBy(REQUEST_CUSTODY_MEMBERS.POSITION).fetch(REQUEST_CUSTODY_MEMBERS.USER_ID));
        result.put("groupIds", dsl.select(REQUEST_CUSTODY_GROUPS.GROUP_ID)
                .from(REQUEST_CUSTODY_GROUPS).where(REQUEST_CUSTODY_GROUPS.CUSTODY_ID.eq(custodyId))
                .orderBy(REQUEST_CUSTODY_GROUPS.POSITION).fetch(REQUEST_CUSTODY_GROUPS.GROUP_ID));
        result.put("openCount", dsl.select(countDistinct(REQUESTS.DOCUMENT_ID)).from(REQUESTS)
                .join(REQUEST_PLACEMENTS).on(REQUEST_PLACEMENTS.REQUEST_ID.eq(REQUESTS.ID))
                .where(REQUESTS.DECISION.eq("Pending").and(REQUEST_PLACEMENTS.CUSTODY_ID.eq(custodyId)))
                .fetchOne(0, int.class));
        result.put("placedByIds", ruleIdsForCustody(custodyId));
        return result;
    }

    public Map<String, Object> custodyImpact(String custodyId) {
        Map<String, Object> custody = custody(custodyId);
        if (custody == null) {
            return null;
        }
        Set<String> documentIds = new LinkedHashSet<>(dsl.selectDistinct(REQUESTS.DOCUMENT_ID).from(REQUESTS)
                .join(REQUEST_PLACEMENTS).on(REQUEST_PLACEMENTS.REQUEST_ID.eq(REQUESTS.ID))
                .where(REQUESTS.DECISION.eq("Pending").and(REQUEST_PLACEMENTS.CUSTODY_ID.eq(custodyId)))
                .fetch(REQUESTS.DOCUMENT_ID));
        if (Boolean.TRUE.equals(custody.get("isFallback"))) {
            documentIds.addAll(dsl.selectDistinct(REQUESTS.DOCUMENT_ID).from(REQUESTS)
                    .where(REQUESTS.DECISION.eq("Pending").and(notExists(dsl.selectOne().from(REQUEST_PLACEMENTS)
                            .where(REQUEST_PLACEMENTS.REQUEST_ID.eq(REQUESTS.ID)))))
                    .fetch(REQUESTS.DOCUMENT_ID));
        }
        int toFallback = 0;
        for (String documentId : documentIds) {
            boolean anotherCustodyHolds = dsl.fetchExists(dsl.selectOne().from(REQUESTS)
                    .join(REQUEST_PLACEMENTS).on(REQUEST_PLACEMENTS.REQUEST_ID.eq(REQUESTS.ID))
                    .join(REQUEST_CUSTODIES).on(REQUEST_CUSTODIES.ID.eq(REQUEST_PLACEMENTS.CUSTODY_ID))
                    .where(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq("Pending"))
                            .and(REQUEST_CUSTODIES.ID.ne(custodyId))
                            .and(REQUEST_CUSTODIES.IS_FALLBACK.isFalse())));
            if (!anotherCustodyHolds) {
                toFallback++;
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("openCount", documentIds.size());
        result.put("toFallbackCount", toFallback);
        result.put("ruleIds", ruleIdsForCustody(custodyId));
        return result;
    }

    private List<String> ruleIdsForCustody(String custodyId) {
        return dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.SETTINGS)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID)))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("Custody"))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION).fetch(row -> {
                    String settings = row.get(PLUGIN_INSTANCES.SETTINGS) == null
                            ? "{}" : row.get(PLUGIN_INSTANCES.SETTINGS).data();
                    return Map.entry(row.get(PLUGIN_INSTANCES.ID),
                            json.readTree(settings).path("custodyId").asString(null));
                }).stream().filter(rule -> custodyId.equals(rule.getValue()))
                .map(Map.Entry::getKey).toList();
    }

    public List<Map<String, Object>> groups() {
        var groups = dsl.selectFrom(GROUPS).orderBy(GROUPS.POSITION).fetch();
        Map<String, List<String>> membersByGroup = new LinkedHashMap<>();
        dsl.select(GROUP_MEMBERS.GROUP_ID, GROUP_MEMBERS.USER_ID).from(GROUP_MEMBERS)
            .orderBy(GROUP_MEMBERS.GROUP_ID, GROUP_MEMBERS.POSITION)
            .fetch().forEach(row -> membersByGroup.computeIfAbsent(
                row.get(GROUP_MEMBERS.GROUP_ID), ignored -> new ArrayList<>())
                .add(row.get(GROUP_MEMBERS.USER_ID)));
        Map<String, List<String>> categoriesByGroup = new LinkedHashMap<>();
        dsl.select(GROUP_CATEGORIES.GROUP_ID, GROUP_CATEGORIES.CATEGORY_ID).from(GROUP_CATEGORIES)
            .orderBy(GROUP_CATEGORIES.GROUP_ID, GROUP_CATEGORIES.POSITION)
            .fetch().forEach(row -> categoriesByGroup.computeIfAbsent(
                row.get(GROUP_CATEGORIES.GROUP_ID), ignored -> new ArrayList<>())
                .add(row.get(GROUP_CATEGORIES.CATEGORY_ID)));
        return groups.map(row -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", row.getId());
            result.put("name", row.getName());
            result.put("description", row.getDescription());
            result.put("memberIds", membersByGroup.getOrDefault(row.getId(), List.of()));
            result.put("categoryIds", categoriesByGroup.getOrDefault(row.getId(), List.of()));
            return result;
        });
    }
}

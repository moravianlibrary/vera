package cz.mzk.vera.access;

import static cz.mzk.vera.db.tables.Tables.GROUP_CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.web.Instants;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// ACCESS-role-ways; ACCESS-group; ACCESS-suspend: the Users & Groups person projection.
@Repository
public class AccessQueries {
    private final DSLContext dsl;

    public AccessQueries(DSLContext dsl) {
        this.dsl = dsl;
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

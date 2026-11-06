package cz.mzk.vera.session;

import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUP_CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBER_GROUPS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.domain.access.Access;
import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.domain.access.MappedRole;
import cz.mzk.vera.domain.access.Role;
import cz.mzk.vera.domain.access.RoleHolder;
import cz.mzk.vera.domain.permissions.Permissions;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// ACCESS-role-ways; ROLE-union: one read model for roles and grants held by a person.
@Repository
public class HeldAccessQueries {
    private final DSLContext dsl;

    public HeldAccessQueries(DSLContext dsl) {
        this.dsl = dsl;
    }

    public HeldAccess heldBy(String userId) {
        var user = dsl.selectFrom(USERS).where(USERS.ID.eq(userId)).fetchOne();
        String suspendedAt = user == null || user.getSuspendedAt() == null
            ? null
            : user.getSuspendedAt().toString();
        List<String> hand = dsl.select(USER_HAND_ROLES.ROLE_ID).from(USER_HAND_ROLES)
            .where(USER_HAND_ROLES.USER_ID.eq(userId))
            .orderBy(USER_HAND_ROLES.POSITION)
            .fetch(USER_HAND_ROLES.ROLE_ID);
        List<MappedRole> mapped = dsl.selectFrom(USER_MAPPED_ROLES)
            .where(USER_MAPPED_ROLES.USER_ID.eq(userId))
            .orderBy(USER_MAPPED_ROLES.POSITION)
            .fetch(row -> new MappedRole(row.getRoleId(), row.getInstanceId(), row.getClaim()));
        RoleHolder holder = new RoleHolder(hand, mapped, suspendedAt);
        List<String> roleIds = Access.isSuspended(holder)
            ? List.of()
            : Access.heldRoleIdsOf(holder);
        List<Role> roles = roles();
        return new HeldAccess(roles, roleIds, Access.grantsOf(roles, roleIds));
    }

    public HeldScopes scopesHeldBy(String userId) {
        HeldAccess held = heldBy(userId);
        List<String> groupIds = dsl.select(GROUP_MEMBERS.GROUP_ID).from(GROUP_MEMBERS)
            .where(GROUP_MEMBERS.USER_ID.eq(userId)).orderBy(GROUP_MEMBERS.POSITION)
            .fetch(GROUP_MEMBERS.GROUP_ID);
        Set<String> custody = new LinkedHashSet<>();
        dsl.select(GROUP_CATEGORIES.CATEGORY_ID).from(GROUP_MEMBERS)
            .join(GROUP_CATEGORIES).on(GROUP_CATEGORIES.GROUP_ID.eq(GROUP_MEMBERS.GROUP_ID))
            .where(GROUP_MEMBERS.USER_ID.eq(userId))
            .orderBy(GROUP_MEMBERS.POSITION, GROUP_CATEGORIES.POSITION)
            .fetch(GROUP_CATEGORIES.CATEGORY_ID).forEach(custody::add);
        dsl.select(CATEGORY_MEMBERS.CATEGORY_ID).from(CATEGORY_MEMBERS)
            .where(CATEGORY_MEMBERS.USER_ID.eq(userId)).orderBy(CATEGORY_MEMBERS.POSITION)
            .fetch(CATEGORY_MEMBERS.CATEGORY_ID).forEach(custody::add);
        Set<String> projects = new LinkedHashSet<>();
        dsl.select(PROJECTS.ID).from(PROJECTS)
            .leftJoin(PROJECT_MEMBERS).on(PROJECT_MEMBERS.PROJECT_ID.eq(PROJECTS.ID))
            .leftJoin(PROJECT_MEMBER_GROUPS).on(PROJECT_MEMBER_GROUPS.PROJECT_ID.eq(PROJECTS.ID))
            .leftJoin(GROUP_MEMBERS).on(GROUP_MEMBERS.GROUP_ID.eq(PROJECT_MEMBER_GROUPS.GROUP_ID))
            .where(PROJECTS.MANAGER_ID.eq(userId).or(PROJECT_MEMBERS.USER_ID.eq(userId))
                .or(GROUP_MEMBERS.USER_ID.eq(userId)))
            .orderBy(PROJECTS.POSITION).fetch(PROJECTS.ID).forEach(projects::add);
        return new HeldScopes(held.grants(), groupIds, List.copyOf(custody), List.copyOf(projects));
    }

    public List<Role> roles() {
        Map<String, List<Grant>> grantsByRole = new LinkedHashMap<>();
        dsl.select(ROLES.ID, ROLE_GRANTS.PERMISSION, ROLE_GRANTS.SCOPE)
                .from(ROLES.leftJoin(ROLE_GRANTS).on(ROLE_GRANTS.ROLE_ID.eq(ROLES.ID)))
                .orderBy(ROLES.POSITION, ROLE_GRANTS.POSITION)
                .fetch()
                .forEach(row -> {
                    List<Grant> grants = grantsByRole.computeIfAbsent(
                            row.get(ROLES.ID), ignored -> new ArrayList<>());
                    if (row.get(ROLE_GRANTS.PERMISSION) != null) {
                        grants.add(new Grant(row.get(ROLE_GRANTS.PERMISSION), row.get(ROLE_GRANTS.SCOPE)));
                    }
                });
        return grantsByRole.entrySet().stream()
                .map(entry -> new Role(entry.getKey(), entry.getValue()))
                .toList();
    }

    public record HeldAccess(List<Role> roles, List<String> roleIds, List<Grant> grants) {
        public HeldAccess {
            roles = List.copyOf(roles);
            roleIds = List.copyOf(roleIds);
            grants = List.copyOf(grants);
        }
    }

    public record HeldScopes(List<Grant> grants, List<String> groupIds,
            List<String> custodyCategoryIds, List<String> projectIds) {
        public HeldScopes {
            grants = List.copyOf(grants);
            groupIds = List.copyOf(groupIds);
            custodyCategoryIds = List.copyOf(custodyCategoryIds);
            projectIds = List.copyOf(projectIds);
        }

        public boolean hasPermission(String permission) {
            return Permissions.hasPermission(grants, permission);
        }

        public List<String> scopesOf(String permission) {
            return grants.stream().filter(grant -> grant.permission().equals(permission))
                .map(grant -> grant.scope() == null ? "own" : grant.scope()).toList();
        }
    }
}

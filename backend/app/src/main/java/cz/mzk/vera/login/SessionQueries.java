package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUP_CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
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
import cz.mzk.vera.session.Caller;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** jOOQ read model for GET /api/session. */
@Repository
public class SessionQueries {
    private final DSLContext dsl;

    public SessionQueries(DSLContext dsl) {
        this.dsl = dsl;
    }

    SessionView session(Caller caller) {
        var user = dsl.selectFrom(USERS).where(USERS.ID.eq(caller.userId())).fetchOne();
        if (user == null) return null;
        List<String> hand = dsl.select(USER_HAND_ROLES.ROLE_ID).from(USER_HAND_ROLES)
                .where(USER_HAND_ROLES.USER_ID.eq(caller.userId())).orderBy(USER_HAND_ROLES.POSITION)
                .fetch(USER_HAND_ROLES.ROLE_ID);
        List<MappedRole> mapped = dsl.selectFrom(USER_MAPPED_ROLES)
                .where(USER_MAPPED_ROLES.USER_ID.eq(caller.userId())).orderBy(USER_MAPPED_ROLES.POSITION)
                .fetch(row -> new MappedRole(row.getRoleId(), row.getInstanceId(), row.getClaim()));
        RoleHolder holder = new RoleHolder(hand, mapped,
                user.getSuspendedAt() == null ? null : user.getSuspendedAt().toString());
        List<String> roleIds = Access.isSuspended(holder) ? List.of() : Access.heldRoleIdsOf(holder);

        Map<String, List<Grant>> grantsByRole = new LinkedHashMap<>();
        dsl.select(ROLE_GRANTS.ROLE_ID, ROLE_GRANTS.PERMISSION, ROLE_GRANTS.SCOPE)
                .from(ROLE_GRANTS.join(ROLES).on(ROLE_GRANTS.ROLE_ID.eq(ROLES.ID)))
                .orderBy(ROLES.POSITION, ROLE_GRANTS.POSITION)
                .fetch().forEach(row -> grantsByRole
                        .computeIfAbsent(row.get(ROLE_GRANTS.ROLE_ID), ignored -> new ArrayList<>())
                        .add(new Grant(row.get(ROLE_GRANTS.PERMISSION), row.get(ROLE_GRANTS.SCOPE))));
        List<Role> roles = dsl.selectFrom(ROLES).orderBy(ROLES.POSITION)
                .fetch(row -> new Role(row.getId(), grantsByRole.getOrDefault(row.getId(), List.of())));

        List<String> groupIds = dsl.select(GROUP_MEMBERS.GROUP_ID).from(GROUP_MEMBERS)
                .where(GROUP_MEMBERS.USER_ID.eq(caller.userId())).orderBy(GROUP_MEMBERS.POSITION)
                .fetch(GROUP_MEMBERS.GROUP_ID);
        Set<String> custody = new LinkedHashSet<>();
        dsl.select(GROUP_CATEGORIES.CATEGORY_ID).from(GROUP_MEMBERS)
                .join(GROUP_CATEGORIES).on(GROUP_CATEGORIES.GROUP_ID.eq(GROUP_MEMBERS.GROUP_ID))
                .where(GROUP_MEMBERS.USER_ID.eq(caller.userId()))
                .orderBy(GROUP_MEMBERS.POSITION, GROUP_CATEGORIES.POSITION)
                .fetch(GROUP_CATEGORIES.CATEGORY_ID).forEach(custody::add);
        dsl.select(CATEGORY_MEMBERS.CATEGORY_ID).from(CATEGORY_MEMBERS)
                .where(CATEGORY_MEMBERS.USER_ID.eq(caller.userId())).orderBy(CATEGORY_MEMBERS.POSITION)
                .fetch(CATEGORY_MEMBERS.CATEGORY_ID).forEach(custody::add);
        return new SessionView(new UserView(user.getId(), user.getName(), user.getKind(), user.getEmail()), roleIds,
                Access.grantsOf(roles, roleIds), List.copyOf(custody), groupIds);
    }

    record UserView(String id, String name, String kind, String email) {}

    record SessionView(UserView user, List<String> roleIds, List<Grant> grants, List<String> custodyCategoryIds,
            List<String> groupIds) {}
}

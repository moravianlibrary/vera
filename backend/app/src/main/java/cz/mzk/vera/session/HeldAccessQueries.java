package cz.mzk.vera.session;

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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
        Map<String, List<Grant>> grantsByRole = new LinkedHashMap<>();
        dsl.select(ROLE_GRANTS.ROLE_ID, ROLE_GRANTS.PERMISSION, ROLE_GRANTS.SCOPE)
            .from(ROLE_GRANTS.join(ROLES).on(ROLE_GRANTS.ROLE_ID.eq(ROLES.ID)))
            .orderBy(ROLES.POSITION, ROLE_GRANTS.POSITION)
            .fetch()
            .forEach(row -> grantsByRole
                .computeIfAbsent(row.get(ROLE_GRANTS.ROLE_ID), ignored -> new ArrayList<>())
                .add(new Grant(row.get(ROLE_GRANTS.PERMISSION), row.get(ROLE_GRANTS.SCOPE))));
        List<Role> roles = dsl.selectFrom(ROLES).orderBy(ROLES.POSITION)
            .fetch(row -> new Role(row.getId(), grantsByRole.getOrDefault(row.getId(), List.of())));
        return new HeldAccess(roles, roleIds, Access.grantsOf(roles, roleIds));
    }

    public record HeldAccess(List<Role> roles, List<String> roleIds, List<Grant> grants) {
        public HeldAccess {
            roles = List.copyOf(roles);
            roleIds = List.copyOf(roleIds);
            grants = List.copyOf(grants);
        }
    }
}

package cz.mzk.vera.access;

import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.web.Instants;
import java.util.LinkedHashMap;
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
}

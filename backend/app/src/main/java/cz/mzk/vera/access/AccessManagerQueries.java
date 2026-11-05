package cz.mzk.vera.access;

import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.domain.access.MappedRole;
import cz.mzk.vera.domain.access.RoleHolder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// ACCESS-last-manager; ACCESS-suspend: read all role holders together for one decision.
@Repository
public class AccessManagerQueries {
    private final DSLContext dsl;

    public AccessManagerQueries(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<UserRoles> allRoleHolders() {
        Map<String, Holder> holders = new LinkedHashMap<>();
        dsl.select(USERS.ID, USERS.SUSPENDED_AT).from(USERS).orderBy(USERS.POSITION)
                .fetch().forEach(row -> holders.put(row.get(USERS.ID), new Holder(
                        row.get(USERS.SUSPENDED_AT) == null ? null : row.get(USERS.SUSPENDED_AT).toString())));
        dsl.select(USER_HAND_ROLES.USER_ID, USER_HAND_ROLES.ROLE_ID)
                .from(USER_HAND_ROLES.join(USERS).on(USER_HAND_ROLES.USER_ID.eq(USERS.ID)))
                .orderBy(USERS.POSITION, USER_HAND_ROLES.POSITION)
                .fetch().forEach(row -> holders.get(row.get(USER_HAND_ROLES.USER_ID))
                        .handRoleIds.add(row.get(USER_HAND_ROLES.ROLE_ID)));
        dsl.select(USER_MAPPED_ROLES.USER_ID, USER_MAPPED_ROLES.ROLE_ID,
                        USER_MAPPED_ROLES.INSTANCE_ID, USER_MAPPED_ROLES.CLAIM)
                .from(USER_MAPPED_ROLES.join(USERS).on(USER_MAPPED_ROLES.USER_ID.eq(USERS.ID)))
                .orderBy(USERS.POSITION, USER_MAPPED_ROLES.POSITION)
                .fetch().forEach(row -> holders.get(row.get(USER_MAPPED_ROLES.USER_ID)).mappedRoles.add(
                        new MappedRole(row.get(USER_MAPPED_ROLES.ROLE_ID), row.get(USER_MAPPED_ROLES.INSTANCE_ID),
                                row.get(USER_MAPPED_ROLES.CLAIM))));
        return holders.entrySet().stream().map(entry ->
                new UserRoles(entry.getKey(), entry.getValue().roleHolder())).toList();
    }

    public record UserRoles(String userId, RoleHolder roles) {}

    private static final class Holder {
        private final String suspendedAt;
        private final List<String> handRoleIds = new ArrayList<>();
        private final List<MappedRole> mappedRoles = new ArrayList<>();

        Holder(String suspendedAt) {
            this.suspendedAt = suspendedAt;
        }

        RoleHolder roleHolder() {
            return new RoleHolder(handRoleIds, mappedRoles, suspendedAt);
        }
    }
}

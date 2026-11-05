package cz.mzk.vera.access;

import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;
import static org.jooq.impl.DSL.trueCondition;

import cz.mzk.vera.domain.access.Access;
import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.domain.access.MappedRole;
import cz.mzk.vera.domain.access.Role;
import cz.mzk.vera.domain.access.RoleHolder;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.RecordIds;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// ACT-role-save; ACT-role-delete; ACCESS-last-manager; PERM-once-per-role;
// PERM-accepted-scopes; PERM-requires.
@Service
class AccessRoleCommands {
    private final DSLContext dsl;
    private final EventRecorder events;
    private final AccessQueries queries;
    private final AccessManagerQueries managers;
    private final HeldAccessQueries heldAccess;

    AccessRoleCommands(DSLContext dsl, EventRecorder events, AccessQueries queries,
            AccessManagerQueries managers, HeldAccessQueries heldAccess) {
        this.dsl = dsl;
        this.events = events;
        this.queries = queries;
        this.managers = managers;
        this.heldAccess = heldAccess;
    }

    @Transactional
    ActResult create(Caller caller, Draft body) {
        ActResult invalid = refusalForGrants(body.grants());
        if (invalid != null) {
            return invalid;
        }
        String name = Access.roleNameOf(body.name());
        if (taken(name, null)) {
            return ActResult.nameTaken(name);
        }
        List<String> ids = heldAccess.roles().stream().map(Role::id).toList();
        String id = ids.contains(name) ? RecordIds.next(name + "-", ids) : name;
        int position = dsl.select(coalesce(max(ROLES.POSITION), -1).add(1))
                .from(ROLES).fetchOne(0, int.class);
        dsl.insertInto(ROLES)
                .set(ROLES.ID, id)
                .set(ROLES.NAME, name)
                .set(ROLES.DESCRIPTION, body.description())
                .set(ROLES.IS_SHIPPED, false)
                .set(ROLES.PROPOSAL_BATCH_LIMIT, body.proposalBatchLimit())
                .set(ROLES.PROPOSAL_DAILY_LIMIT, body.proposalDailyLimit())
                .set(ROLES.POSITION, position)
                .execute();
        insertGrants(id, body.grants());
        events.recordAct(EventCode.ROLE_CREATED, "role", id, caller, List.of(
                EventChanges.change("name", null, name),
                EventChanges.change("description", null, body.description()),
                EventChanges.change("grants", List.of(), body.grants()),
                EventChanges.change("proposalBatchLimit", null, body.proposalBatchLimit()),
                EventChanges.change("proposalDailyLimit", null, body.proposalDailyLimit())));
        return ActResult.ok(queries.role(id));
    }

    @Transactional
    ActResult save(Caller caller, String id, Draft body) {
        Map<String, Object> old = queries.role(id);
        if (old == null) {
            return ActResult.unknown("role");
        }
        ActResult invalid = refusalForGrants(body.grants());
        if (invalid != null) {
            return invalid;
        }
        String name = Access.roleNameOf(body.name());
        if (taken(name, id)) {
            return ActResult.nameTaken(name);
        }
        List<Role> roles = heldAccess.roles().stream().map(role -> role.id().equals(id)
                ? new Role(id, body.grants()) : role).toList();
        List<RoleHolder> holders = managers.allRoleHolders().stream()
                .map(AccessManagerQueries.UserRoles::roles).toList();
        if (Access.managersOf(holders, roles).isEmpty()) {
            return ActResult.refused(409, "Nobody could manage access after this", "access.last_manager");
        }
        Map<String, Object> updated = new LinkedHashMap<>(old);
        updated.put("name", name);
        updated.put("description", body.description());
        updated.put("grants", body.grants());
        updated.put("proposalBatchLimit", body.proposalBatchLimit());
        updated.put("proposalDailyLimit", body.proposalDailyLimit());
        List<Map<String, Object>> changes = new ArrayList<>();
        for (String field : List.of("name", "description", "grants", "proposalBatchLimit", "proposalDailyLimit")) {
            if (!Objects.equals(old.get(field), updated.get(field))) {
                changes.add(EventChanges.change(field, old.get(field), updated.get(field)));
            }
        }
        dsl.update(ROLES)
                .set(ROLES.NAME, name)
                .set(ROLES.DESCRIPTION, body.description())
                .set(ROLES.PROPOSAL_BATCH_LIMIT, body.proposalBatchLimit())
                .set(ROLES.PROPOSAL_DAILY_LIMIT, body.proposalDailyLimit())
                .where(ROLES.ID.eq(id))
                .execute();
        dsl.deleteFrom(ROLE_GRANTS).where(ROLE_GRANTS.ROLE_ID.eq(id)).execute();
        insertGrants(id, body.grants());
        if (!changes.isEmpty()) {
            boolean renamed = changes.stream().allMatch(change ->
                    List.of("name", "description").contains(change.get("field")));
            events.recordAct(renamed ? EventCode.ROLE_RENAMED : EventCode.ROLE_PERMISSIONS_CHANGED,
                    "role", id, caller, changes);
        }
        return ActResult.ok(queries.role(id));
    }

    @Transactional
    ActResult delete(Caller caller, String id) {
        Map<String, Object> old = queries.role(id);
        if (old == null) {
            return ActResult.unknown("role");
        }
        List<Role> roles = heldAccess.roles().stream().filter(role -> !role.id().equals(id)).toList();
        List<RoleHolder> candidates = managers.allRoleHolders().stream().map(holder -> {
            List<String> hand = holder.roles().handRoleIds().stream()
                    .filter(role -> !role.equals(id))
                    .toList();
            List<MappedRole> mapped = holder.roles().mappedRoles().stream()
                    .filter(role -> !role.roleId().equals(id)).toList();
            return new RoleHolder(hand, mapped, holder.roles().suspendedAt());
        }).toList();
        if (Access.managersOf(candidates, roles).isEmpty()) {
            return ActResult.refused(409, "Nobody could manage access after this", "access.last_manager");
        }
        dsl.deleteFrom(USER_HAND_ROLES).where(USER_HAND_ROLES.ROLE_ID.eq(id)).execute();
        dsl.deleteFrom(USER_MAPPED_ROLES).where(USER_MAPPED_ROLES.ROLE_ID.eq(id)).execute();
        dsl.deleteFrom(ROLE_GRANTS).where(ROLE_GRANTS.ROLE_ID.eq(id)).execute();
        dsl.deleteFrom(ROLES).where(ROLES.ID.eq(id)).execute();
        events.recordAct(EventCode.ROLE_DELETED, "role", id, caller,
                List.of(EventChanges.change("name", old.get("name"), null)));
        return ActResult.noContent();
    }

    private ActResult refusalForGrants(List<Grant> grants) {
        if (grants.stream().map(Grant::permission).distinct().count() != grants.size()) {
            return ActResult.refused(422, "Each permission is granted once, at one scope",
                    "role.duplicate_permission");
        }
        for (Grant grant : grants) {
            if (!Permissions.isAcceptedGrant(grant)) {
                String detail = grant.scope() == null
                        ? grant.permission() + " needs a scope"
                        : grant.permission() + " does not take the scope " + grant.scope();
                return ActResult.refused(422, detail, null);
            }
        }
        List<Permissions.Missing> missing = Permissions.missingRequirementsOf(grants);
        if (!missing.isEmpty()) {
            Permissions.Missing first = missing.getFirst();
            String suffix = first.needs().scope() == null ? "" : " at " + first.needs().scope();
            return ActResult.refused(422, first.grant().permission() + " needs "
                    + first.needs().permission() + suffix, "role.requires");
        }
        return null;
    }

    private boolean taken(String name, String except) {
        return dsl.fetchExists(dsl.selectOne().from(ROLES).where(ROLES.NAME.eq(name))
                .and(except == null ? trueCondition() : ROLES.ID.ne(except)));
    }

    private void insertGrants(String roleId, List<Grant> grants) {
        for (int i = 0; i < grants.size(); i++) {
            Grant grant = grants.get(i);
            dsl.insertInto(ROLE_GRANTS)
                    .set(ROLE_GRANTS.ROLE_ID, roleId)
                    .set(ROLE_GRANTS.POSITION, i)
                    .set(ROLE_GRANTS.PERMISSION, grant.permission())
                    .set(ROLE_GRANTS.SCOPE, grant.scope())
                    .execute();
        }
    }

    record Draft(String name, String description, List<Grant> grants,
            Integer proposalBatchLimit, Integer proposalDailyLimit) {}
}

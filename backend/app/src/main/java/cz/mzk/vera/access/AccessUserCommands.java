package cz.mzk.vera.access;

import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.SESSIONS;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.domain.access.Access;
import cz.mzk.vera.domain.access.Role;
import cz.mzk.vera.domain.access.RoleHolder;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.login.IdentityInstances;
import cz.mzk.vera.login.LoginCommands;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.UserIds;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// ACT-local-account; ACT-user-roles; ACT-user-groups; ACT-identity-link; ACT-identity-unlink;
// ACT-identity-default-role; ACT-user-suspend; ACT-user-restore.
@Service
public class AccessUserCommands {
    private final DSLContext dsl;
    private final Clock clock;
    private final JsonMapper json;
    private final EventRecorder events;
    private final AccessQueries users;
    private final AccessManagerQueries managers;
    private final HeldAccessQueries heldAccess;
    private final IdentityInstances instances;
    private final LoginCommands loginCommands;
    private final UserIds userIds;

    public AccessUserCommands(DSLContext dsl, Clock clock, EventRecorder events, JsonMapper json,
            AccessQueries users, AccessManagerQueries managers, HeldAccessQueries heldAccess,
            IdentityInstances instances, LoginCommands loginCommands, UserIds userIds) {
        this.dsl = dsl;
        this.clock = clock;
        this.json = json;
        this.events = events;
        this.users = users;
        this.managers = managers;
        this.heldAccess = heldAccess;
        this.instances = instances;
        this.loginCommands = loginCommands;
        this.userIds = userIds;
    }

    @Transactional
    public Result localAccount(Caller caller, LocalAccount body) {
        String instanceId = instances.firstLocalAccounts();
        if (instanceId == null) {
            return failure(422, "Local accounts are switched off", "access.local_accounts_off");
        }
        if (dsl.fetchExists(dsl.selectOne().from(USER_IDENTITIES)
                .where(USER_IDENTITIES.INSTANCE_ID.eq(instanceId))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(body.username())))) {
            return failure(409, body.username() + " is taken", "access.identity_taken");
        }
        List<String> roleIds = distinct(body.roleIds());
        List<Role> roles = heldAccess.roles();
        List<String> knownRoleIds = roles.stream().map(role -> role.id()).toList();
        if (roleIds.stream().anyMatch(id -> !knownRoleIds.contains(id))) {
            return unknown("role");
        }
        String userId = userIds.next();
        int userPosition = dsl.select(coalesce(max(USERS.POSITION), -1).add(1))
                .from(USERS).fetchOne(0, int.class);
        dsl.insertInto(USERS)
                .set(USERS.ID, userId)
                .set(USERS.NAME, body.name())
                .set(USERS.KIND, "person")
                .set(USERS.EMAIL, body.email().isEmpty() ? null : body.email())
                .set(USERS.ENTRY, (String) null)
                .set(USERS.SUSPENDED_AT, (OffsetDateTime) null)
                .set(USERS.POSITION, userPosition).execute();
        for (int i = 0; i < roleIds.size(); i++) {
            dsl.insertInto(USER_HAND_ROLES)
                    .set(USER_HAND_ROLES.USER_ID, userId)
                    .set(USER_HAND_ROLES.ROLE_ID, roleIds.get(i))
                    .set(USER_HAND_ROLES.POSITION, i)
                    .execute();
        }
        insertIdentity(userId, instanceId, body.username(), null);
        record(EventCode.USER_CREATED, "user", userId, caller, List.of(
                EventChanges.change("how", null, "local_account"),
                EventChanges.change("roleIds", List.of(), roleIds),
                EventChanges.change("instanceId", null, instanceId)), clock.instant());
        return success(users.user(userId));
    }

    @Transactional
    public Result userRoles(Caller caller, String userId, List<String> requested) {
        Map<String, Object> before = users.user(userId);
        if (before == null) {
            return unknown("user");
        }
        List<String> roleIds = distinct(requested);
        List<Role> roles = heldAccess.roles();
        List<String> knownRoleIds = roles.stream().map(role -> role.id()).toList();
        if (roleIds.stream().anyMatch(id -> !knownRoleIds.contains(id))) {
            return unknown("role");
        }
        List<AccessManagerQueries.UserRoles> current = managers.allRoleHolders();
        List<RoleHolder> candidates = current.stream().map(holder -> holder.userId().equals(userId)
                ? new RoleHolder(roleIds, holder.roles().mappedRoles(), holder.roles().suspendedAt())
                : holder.roles()).toList();
        if (Access.managersOf(candidates, roles).isEmpty()) {
            return failure(409, "Nobody could manage access after this", "access.last_manager");
        }
        List<String> oldRoleIds = strings(before.get("handRoleIds"));
        dsl.deleteFrom(USER_HAND_ROLES).where(USER_HAND_ROLES.USER_ID.eq(userId)).execute();
        for (int i = 0; i < roleIds.size(); i++) {
            dsl.insertInto(USER_HAND_ROLES)
                    .set(USER_HAND_ROLES.USER_ID, userId)
                    .set(USER_HAND_ROLES.ROLE_ID, roleIds.get(i))
                    .set(USER_HAND_ROLES.POSITION, i)
                    .execute();
        }
        if (!sameSet(oldRoleIds, roleIds)) {
            record(EventCode.USER_ROLES_CHANGED, "user", userId, caller,
                    List.of(EventChanges.change("handRoleIds", oldRoleIds, roleIds)), clock.instant());
        }
        return success(users.user(userId));
    }

    @Transactional
    public Result userGroups(Caller caller, String userId, List<String> requested) {
        Map<String, Object> before = users.user(userId);
        if (before == null) {
            return unknown("user");
        }
        List<String> groupIds = distinct(requested);
        List<String> knownGroupIds = dsl.select(GROUPS.ID).from(GROUPS).fetch(GROUPS.ID);
        if (groupIds.stream().anyMatch(id -> !knownGroupIds.contains(id))) {
            return unknown("group");
        }
        List<String> oldGroupIds = strings(before.get("groupIds"));
        dsl.deleteFrom(GROUP_MEMBERS).where(GROUP_MEMBERS.USER_ID.eq(userId)).execute();
        for (int i = 0; i < groupIds.size(); i++) {
            String groupId = groupIds.get(i);
            int position = dsl.select(coalesce(max(GROUP_MEMBERS.POSITION), -1).add(1))
                    .from(GROUP_MEMBERS).where(GROUP_MEMBERS.GROUP_ID.eq(groupId)).fetchOne(0, int.class);
            dsl.insertInto(GROUP_MEMBERS)
                    .set(GROUP_MEMBERS.USER_ID, userId)
                    .set(GROUP_MEMBERS.GROUP_ID, groupId)
                    .set(GROUP_MEMBERS.POSITION, position)
                    .execute();
        }
        if (!sameSet(oldGroupIds, groupIds)) {
            record(EventCode.USER_GROUPS_CHANGED, "user", userId, caller,
                    List.of(EventChanges.change("groupIds", oldGroupIds, groupIds)), clock.instant());
        }
        return success(users.user(userId));
    }

    @Transactional
    public Result identityLink(Caller caller, String userId, String instanceId, String externalId) {
        Map<String, Object> user = users.user(userId);
        if (user == null) {
            return unknown("user");
        }
        if ("agent".equals(user.get("kind"))) {
            return failure(422, "An agent never logs in", "access.agent_no_login");
        }
        IdentityInstances.AccessInstance instance = instances.findForAccess(instanceId);
        if (instance == null) {
            return unknown("identity provider");
        }
        var holder = dsl.select(USER_IDENTITIES.USER_ID).from(USER_IDENTITIES)
                .where(USER_IDENTITIES.INSTANCE_ID.eq(instanceId))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(externalId)).fetchOne();
        if (holder != null) {
            Map<String, Object> heldBy = users.user(holder.value1());
            return failure(409, instance.name() + " " + externalId + " is already "
                    + (heldBy == null ? holder.value1() : heldBy.get("name")), "access.identity_taken");
        }
        insertIdentity(userId, instanceId, externalId, null);
        record(EventCode.USER_IDENTITY_LINKED, "user", userId, caller,
                List.of(EventChanges.change("instanceId", null, instanceId)), clock.instant());
        Map<String, Object> identity = new LinkedHashMap<>();
        identity.put("instanceId", instanceId);
        identity.put("externalId", externalId);
        identity.put("lastLoginAt", null);
        return success(identity);
    }

    @Transactional
    public Result identityUnlink(Caller caller, String userId, String instanceId, String externalId) {
        if (users.user(userId) == null) {
            return unknown("user");
        }
        var identity = dsl.select(USER_IDENTITIES.USER_ID).from(USER_IDENTITIES)
                .where(USER_IDENTITIES.USER_ID.eq(userId)).and(USER_IDENTITIES.INSTANCE_ID.eq(instanceId))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(externalId)).fetchOne();
        if (identity == null) {
            return unknown("identity");
        }
        int count = dsl.selectCount().from(USER_IDENTITIES).where(USER_IDENTITIES.USER_ID.eq(userId))
                .fetchOne(0, int.class);
        if (count == 1) {
            return failure(409, "It is their only way in; suspend them instead", "access.last_identity");
        }
        dsl.deleteFrom(USER_IDENTITIES)
                .where(USER_IDENTITIES.USER_ID.eq(userId))
                .and(USER_IDENTITIES.INSTANCE_ID.eq(instanceId))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(externalId))
                .execute();
        record(EventCode.USER_IDENTITY_UNLINKED, "user", userId, caller,
                List.of(EventChanges.change("instanceId", instanceId, null)), clock.instant());
        return new Result(204, null, null, null);
    }

    @Transactional
    public Result identityDefaultRole(Caller caller, String instanceId, String roleId) {
        IdentityInstances.AccessInstance instance = instances.findForAccess(instanceId);
        if (instance == null || !instance.isEnabled()) {
            return unknown("Identity instance");
        }
        if (roleId != null && !dsl.fetchExists(dsl.selectOne().from(ROLES).where(ROLES.ID.eq(roleId)))) {
            return failure(422, "Choose an existing role", "role.not_found");
        }
        String previous = loginCommands.setDefaultRole(instanceId, roleId);
        if (!Objects.equals(previous, roleId)) {
            record(EventCode.PLUGIN_INSTANCE_DEFAULT_ROLE_CHANGED, "plugin_instance", instanceId, caller,
                    List.of(EventChanges.change("defaultRoleId", previous, roleId)), clock.instant());
        }
        return success(instances.findForAccess(instanceId));
    }

    @Transactional
    public Result userSuspend(Caller caller, String userId) {
        Map<String, Object> user = users.user(userId);
        if (user == null) {
            return unknown("user");
        }
        if ("agent".equals(user.get("kind"))) {
            return failure(422, "An agent never logs in", "access.agent_no_login");
        }
        if (user.get("suspendedAt") != null) {
            return failure(409, user.get("name") + " is suspended", "access.suspended");
        }
        Instant now = clock.instant();
        String suspendedAt = Instants.format(now);
        List<Role> roles = heldAccess.roles();
        List<RoleHolder> candidates = managers.allRoleHolders().stream()
                .map(holder -> holder.userId().equals(userId)
                        ? new RoleHolder(holder.roles().handRoleIds(), holder.roles().mappedRoles(), suspendedAt)
                        : holder.roles())
                .toList();
        if (Access.managersOf(candidates, roles).isEmpty()) {
            return failure(409, "Nobody could manage access after this", "access.last_manager");
        }
        dsl.update(USERS)
                .set(USERS.SUSPENDED_AT, now.atOffset(ZoneOffset.UTC))
                .where(USERS.ID.eq(userId))
                .execute();
        dsl.deleteFrom(SESSIONS).where(SESSIONS.USER_ID.eq(userId)).execute();
        record(EventCode.USER_SUSPENDED, "user", userId, caller,
                List.of(EventChanges.change("suspendedAt", null, suspendedAt)), now);
        return success(users.user(userId));
    }

    @Transactional
    public Result userRestore(Caller caller, String userId) {
        Map<String, Object> user = users.user(userId);
        if (user == null) {
            return unknown("user");
        }
        Object suspendedAt = user.get("suspendedAt");
        if (suspendedAt == null) {
            return failure(409, user.get("name") + " is not suspended", "access.not_suspended");
        }
        dsl.update(USERS).setNull(USERS.SUSPENDED_AT).where(USERS.ID.eq(userId)).execute();
        record(EventCode.USER_RESTORED, "user", userId, caller,
                List.of(EventChanges.change("suspendedAt", suspendedAt, null)), clock.instant());
        return success(users.user(userId));
    }

    private void insertIdentity(String userId, String instanceId, String externalId, Instant lastLoginAt) {
        int position = dsl.select(coalesce(max(USER_IDENTITIES.POSITION), -1).add(1))
                .from(USER_IDENTITIES).where(USER_IDENTITIES.USER_ID.eq(userId)).fetchOne(0, int.class);
        dsl.insertInto(USER_IDENTITIES)
                .set(USER_IDENTITIES.USER_ID, userId)
                .set(USER_IDENTITIES.INSTANCE_ID, instanceId)
                .set(USER_IDENTITIES.EXTERNAL_ID, externalId)
                .set(USER_IDENTITIES.LAST_LOGIN_AT, lastLoginAt == null
                        ? null : lastLoginAt.atOffset(ZoneOffset.UTC))
                .set(USER_IDENTITIES.POSITION, position)
                .execute();
    }

    private void record(EventCode code, String kind, String id, Caller caller,
            List<Map<String, Object>> changes, Instant at) {
        events.record(new EventInput(code, kind, id, null, new EventInput.User(caller.userId()),
                Correlation.newId(), at, EventChanges.configurationOf(json, changes), null));
    }

    private static List<String> distinct(List<String> values) {
        return List.copyOf(new LinkedHashSet<>(values));
    }

    private static List<String> strings(Object values) {
        List<?> list = (List<?>) values;
        return list.stream().map(String.class::cast).toList();
    }

    private static boolean sameSet(List<String> left, List<String> right) {
        return new LinkedHashSet<>(left).equals(new LinkedHashSet<>(right));
    }

    private static Result unknown(String what) {
        return failure(404, "No such " + what, "not_found");
    }

    private static Result success(Object body) {
        return new Result(200, null, null, body);
    }

    private static Result failure(int status, String detail, String code) {
        return new Result(status, detail, code, null);
    }

    public record LocalAccount(String name, String username, String email, List<String> roleIds) {}
    public record Result(int status, String detail, String code, Object body) {}
}

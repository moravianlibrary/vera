package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.LOGIN_FLOWS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.login.IdentityInstances.Instance;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.session.UserIds;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

// ACCESS-first-login; ACCESS-mapping-at-login; ACCESS-login-return.
@Service
public class LoginCommands {
    private static final Duration FLOW_LIFETIME = Duration.ofMinutes(10);
    private final DSLContext dsl;
    private final Clock clock;
    private final EventRecorder events;
    private final JsonMapper json;
    private final UserIds userIds;
    private final SecureRandom random = new SecureRandom();

    public LoginCommands(DSLContext dsl, Clock clock, EventRecorder events, JsonMapper json,
            UserIds userIds) {
        this.dsl = dsl;
        this.clock = clock;
        this.events = events;
        this.json = json;
        this.userIds = userIds;
    }

    @Transactional
    public Result logIn(Instance instance, CompleteAnswer answer) {
        Instant now = clock.instant();
        var linked = dsl.select(USER_IDENTITIES.USER_ID).from(USER_IDENTITIES)
                .where(USER_IDENTITIES.INSTANCE_ID.eq(instance.id()))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(answer.externalId())).fetchOne();
        String userId = linked == null ? null : linked.value1();
        if (userId == null && instance.settings().matchByEmail() && answer.emailVerified()
                && answer.email() != null) {
            userId = dsl.select(USERS.ID).from(USERS).where(USERS.KIND.eq("person"))
                    .and(DSL.lower(USERS.EMAIL).eq(answer.email().toLowerCase(Locale.ROOT)))
                    .fetchOne(USERS.ID);
        }
        if (userId != null) {
            var existing = dsl.select(USERS.SUSPENDED_AT).from(USERS).where(USERS.ID.eq(userId)).fetchOne();
            if (existing != null && existing.value1() != null) {
                return new Result(null, "access.suspended");
            }
            boolean hasIdentity = dsl.fetchExists(dsl.selectOne().from(USER_IDENTITIES)
                    .where(USER_IDENTITIES.INSTANCE_ID.eq(instance.id()))
                    .and(USER_IDENTITIES.EXTERNAL_ID.eq(answer.externalId())));
            if (!hasIdentity) {
                insertIdentity(userId, instance.id(), answer.externalId(), now, answer.claims());
            }
        } else {
            userId = createLinkedPerson(instance, answer, now, true);
        }
        List<Mapped> before = mappings(userId, instance.id());
        dsl.deleteFrom(USER_MAPPED_ROLES)
                .where(USER_MAPPED_ROLES.USER_ID.eq(userId))
                .and(USER_MAPPED_ROLES.INSTANCE_ID.eq(instance.id()))
                .and(USER_MAPPED_ROLES.CLAIM.ne("default role"))
                .execute();
        for (var mapping : instance.settings().mappings()) {
            if (answer.claims().contains(mapping.claim())) {
                insertMapped(userId, mapping.roleId(), instance.id(), mapping.claim());
            }
        }
        dsl.deleteFrom(USER_MAPPED_ROLES)
                .where(USER_MAPPED_ROLES.USER_ID.eq(userId))
                .and(USER_MAPPED_ROLES.INSTANCE_ID.in(dsl.select(PLUGIN_INSTANCES.ID).from(PLUGIN_INSTANCES)
                        .where(PLUGIN_INSTANCES.IS_ENABLED.isFalse())
                        .or(PLUGIN_INSTANCES.IS_DELETED.isTrue())))
                .execute();
        List<Mapped> after = mappings(userId, instance.id());
        if (!before.equals(after)) {
            events.record(new EventInput(EventCode.USER_ROLES_CHANGED, "user", userId, null,
                    new EventInput.System(), Correlation.newId(), now,
                    EventChanges.configurationOf(json, List.of(EventChanges.change("mappedRoleIds",
                            before.stream().map(Mapped::roleId).toList(),
                            after.stream().map(Mapped::roleId).toList()))), null));
        }
        dsl.update(USER_IDENTITIES)
                .set(USER_IDENTITIES.LAST_LOGIN_AT, now.atOffset(ZoneOffset.UTC))
                .set(USER_IDENTITIES.CLAIMS, claims(answer.claims()))
                .where(USER_IDENTITIES.USER_ID.eq(userId))
                .and(USER_IDENTITIES.INSTANCE_ID.eq(instance.id()))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(answer.externalId()))
                .execute();
        return new Result(userId, null);
    }

    @Transactional
    public String createLinkedPerson(Instance instance, CompleteAnswer answer, Instant now,
            boolean firstLogin) {
        String userId = userIds.next();
        int userPosition = dsl.select(DSL.coalesce(DSL.max(USERS.POSITION), -1).add(1))
                .from(USERS)
                .fetchOne(0, int.class);
        dsl.insertInto(USERS)
                .set(USERS.ID, userId)
                .set(USERS.NAME, answer.name())
                .set(USERS.KIND, "person")
                .set(USERS.EMAIL, answer.email())
                .set(USERS.POSITION, userPosition)
                .execute();
        insertIdentity(userId, instance.id(), answer.externalId(), now, answer.claims());
        if (instance.settings().defaultRoleId() != null) {
            insertMapped(userId, instance.settings().defaultRoleId(), instance.id(), "default role");
        }
        if (firstLogin) {
            events.record(new EventInput(EventCode.USER_CREATED, "user", userId, null,
                    new EventInput.System(), Correlation.newId(), now, EventChanges.configurationOf(json,
                            List.of(EventChanges.change("how", null, "first_login"),
                                    EventChanges.change("instanceId", null, instance.id()))), null));
        }
        return userId;
    }

    public String startFlow(String instanceId, String returnTo) {
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        String flowId = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        dsl.insertInto(LOGIN_FLOWS)
                .set(LOGIN_FLOWS.ID, flowId)
                .set(LOGIN_FLOWS.INSTANCE_ID, instanceId)
                .set(LOGIN_FLOWS.RETURN_TO, ReturnTo.safe(returnTo))
                .set(LOGIN_FLOWS.CREATED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .execute();
        return flowId;
    }

    public Optional<LoginFlow> takeFlow(String flowId) {
        var row = dsl.deleteFrom(LOGIN_FLOWS)
                .where(LOGIN_FLOWS.ID.eq(flowId))
                .returning(LOGIN_FLOWS.ID, LOGIN_FLOWS.INSTANCE_ID, LOGIN_FLOWS.RETURN_TO, LOGIN_FLOWS.CREATED_AT)
                .fetchOne();
        if (row == null) {
            return Optional.empty();
        }
        return Optional.of(new LoginFlow(row.get(LOGIN_FLOWS.ID), row.get(LOGIN_FLOWS.INSTANCE_ID),
                row.get(LOGIN_FLOWS.RETURN_TO), row.get(LOGIN_FLOWS.CREATED_AT)));
    }

    public boolean expired(LoginFlow flow) {
        // The backend expires login flows after ten minutes.
        return Duration.between(flow.createdAt().toInstant(), clock.instant()).compareTo(FLOW_LIFETIME) > 0;
    }

    private void insertIdentity(String userId, String instanceId, String externalId, Instant now,
            List<String> claims) {
        int position = dsl.select(DSL.coalesce(DSL.max(USER_IDENTITIES.POSITION), -1).add(1))
                .from(USER_IDENTITIES)
                .where(USER_IDENTITIES.USER_ID.eq(userId))
                .fetchOne(0, int.class);
        dsl.insertInto(USER_IDENTITIES)
                .set(USER_IDENTITIES.USER_ID, userId)
                .set(USER_IDENTITIES.INSTANCE_ID, instanceId)
                .set(USER_IDENTITIES.EXTERNAL_ID, externalId)
                .set(USER_IDENTITIES.LAST_LOGIN_AT, now.atOffset(ZoneOffset.UTC))
                .set(USER_IDENTITIES.CLAIMS, claims(claims))
                .set(USER_IDENTITIES.POSITION, position)
                .execute();
    }

    private JSONB claims(List<String> claims) {
        Map<String, List<String>> byName = new LinkedHashMap<>();
        for (String claim : claims) {
            int separator = claim.indexOf(' ');
            String name = separator < 0 ? claim : claim.substring(0, separator);
            String value = separator < 0 ? "" : claim.substring(separator + 1);
            byName.computeIfAbsent(name, ignored -> new ArrayList<>()).add(value);
        }
        return JSONB.valueOf(json.valueToTree(byName).toString());
    }

    private void insertMapped(String userId, String roleId, String instanceId, String claim) {
        int position = dsl.select(DSL.coalesce(DSL.max(USER_MAPPED_ROLES.POSITION), -1).add(1))
                .from(USER_MAPPED_ROLES)
                .where(USER_MAPPED_ROLES.USER_ID.eq(userId))
                .fetchOne(0, int.class);
        dsl.insertInto(USER_MAPPED_ROLES)
                .set(USER_MAPPED_ROLES.USER_ID, userId)
                .set(USER_MAPPED_ROLES.ROLE_ID, roleId)
                .set(USER_MAPPED_ROLES.INSTANCE_ID, instanceId)
                .set(USER_MAPPED_ROLES.CLAIM, claim)
                .set(USER_MAPPED_ROLES.POSITION, position)
                .execute();
    }

    private List<Mapped> mappings(String userId, String instanceId) {
        return dsl.select(USER_MAPPED_ROLES.ROLE_ID, USER_MAPPED_ROLES.CLAIM)
                .from(USER_MAPPED_ROLES)
                .where(USER_MAPPED_ROLES.USER_ID.eq(userId))
                .and(USER_MAPPED_ROLES.INSTANCE_ID.eq(instanceId))
                .and(USER_MAPPED_ROLES.CLAIM.ne("default role"))
                .orderBy(USER_MAPPED_ROLES.POSITION)
                .fetch(row -> new Mapped(row.value1(), row.value2()));
    }

    @Transactional
    public String setDefaultRole(String instanceId, String roleId) {
        var row = dsl.select(PLUGIN_INSTANCES.SETTINGS)
                .from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(instanceId))
                .fetchOne();
        JsonNode current = readSettings(row == null ? null : row.value1());
        ObjectNode settings = current.isObject()
                ? ((ObjectNode) current).deepCopy() : json.createObjectNode();
        JsonNode previousNode = settings.get("defaultRoleId");
        String previous = previousNode == null || previousNode.isNull() ? null : previousNode.asString();
        if (!Objects.equals(previous, roleId)) {
            settings.set("defaultRoleId", roleId == null ? json.nullNode() : json.valueToTree(roleId));
            dsl.update(PLUGIN_INSTANCES)
                    .set(PLUGIN_INSTANCES.SETTINGS, JSONB.valueOf(settings.toString()))
                    .where(PLUGIN_INSTANCES.ID.eq(instanceId))
                    .execute();
        }
        return previous;
    }

    private JsonNode readSettings(Object value) {
        try {
            return value == null ? json.nullNode() : json.readTree(value.toString());
        } catch (Exception exception) {
            throw new IllegalStateException("Invalid JSON stored in Identity instance", exception);
        }
    }

    public record LoginFlow(String id, String instanceId, String returnTo, OffsetDateTime createdAt) {}
    public record Result(String userId, String refusal) {}
    private record Mapped(String roleId, String claim) {}
}

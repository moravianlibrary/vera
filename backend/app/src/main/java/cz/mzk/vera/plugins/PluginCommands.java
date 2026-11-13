package cz.mzk.vera.plugins;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_CURSORS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.SCHEDULES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.RecordIds;
import cz.mzk.vera.tasks.Runs;
import cz.mzk.vera.tasks.TasksQueries;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.jooq.DSLContext;
import org.jooq.Condition;
import org.jooq.JSONB;
import org.jooq.Record;
import org.jooq.Record1;
import org.jooq.SelectConditionStep;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-instance-create; ACT-instance-save; ACT-instance-disable; ACT-instance-delete; ACT-instance-run;
// PLG-triggers; PLG-secrets; PLG-last-identity; ACCESS-last-identity; ACCESS-custody-by-plugins; L8.
@Service
public class PluginCommands {
    private static final List<String> SETTINGS_KINDS = List.of("Identity", "Custody", "Message",
            "Classifier", "Identifier");
    private static final Set<String> SCHEDULABLE_KINDS = Set.of("CatalogAdapter", "Registry", "Harvester",
            "PropertySource", "Validation", "Restriction", "PublicationDetector");

    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final PluginQueries queries;
    private final Runs runs;
    private final TasksQueries tasks;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;

    public PluginCommands(DSLContext dsl, HeldAccessQueries access, PluginQueries queries, Runs runs,
            TasksQueries tasks, EventRecorder events, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.queries = queries;
        this.runs = runs;
        this.tasks = tasks;
        this.events = events;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    public ActResult create(Caller caller, JsonNode body) {
        if (!mayConfigure(caller)) {
            return ActResult.refused(403, "You may not configure plugins", null);
        }
        String implementationId = body.path("implementationId").asString();
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(implementationId)).fetchOne();
        if (implementation == null) {
            return ActResult.refused(404, "No such implementation VERA can run", null);
        }
        JsonNode version = runnableVersion(implementation.get(PLUGIN_IMPLEMENTATIONS.VERSIONS));
        if (version == null) {
            return ActResult.refused(404, "No such implementation VERA can run", null);
        }
        ActResult refusal = draftRefusal(implementation, body, null, version);
        if (refusal != null) {
            return refusal;
        }
        JsonNode sentConfiguration = body.path("configuration");
        Configuration configuration = storedConfiguration(version, sentConfiguration, null);
        if (configuration.refusal() != null) {
            return configuration.refusal();
        }
        JsonNode policy = body.has("policy") ? body.path("policy") : defaultPolicy(version);
        refusal = policyRefusal(policy, version);
        if (refusal != null) {
            return refusal;
        }
        String id = RecordIds.next("pi", dsl.select(PLUGIN_INSTANCES.ID).from(PLUGIN_INSTANCES)
                .fetch(PLUGIN_INSTANCES.ID));
        int position = dsl.select(coalesce(max(PLUGIN_INSTANCES.POSITION), -1).add(1))
                .from(PLUGIN_INSTANCES).fetchOne(0, int.class);
        OffsetDateTime now = now();
        dsl.insertInto(PLUGIN_INSTANCES)
                .set(PLUGIN_INSTANCES.ID, id)
                .set(PLUGIN_INSTANCES.NAME, body.path("names").path("en").asString(body.path("names").path("cs").asString()).trim())
                .set(PLUGIN_INSTANCES.NAMES, JSONB.valueOf(body.path("names").toString()))
                .set(PLUGIN_INSTANCES.IMPLEMENTATION_ID, implementationId)
                .set(PLUGIN_INSTANCES.VERSION, version.path("version").asString())
                .set(PLUGIN_INSTANCES.CONFIGURATION, JSONB.valueOf(json.writeValueAsString(configuration.value())))
                .set(PLUGIN_INSTANCES.SETTINGS, nullableJson(body.path("settings")))
                .set(PLUGIN_INSTANCES.POLICY, JSONB.valueOf(json.writeValueAsString(policy)))
                .set(PLUGIN_INSTANCES.LINKED_CATEGORY_ID, nullableString(body.path("linkedCategoryId")))
                .set(PLUGIN_INSTANCES.TRIGGERS, JSONB.valueOf(triggerValues(version)))
                .set(PLUGIN_INSTANCES.IS_ENABLED, true)
                .set(PLUGIN_INSTANCES.IS_DELETED, false)
                .set(PLUGIN_INSTANCES.IS_PREDEFINED, false)
                .set(PLUGIN_INSTANCES.CREATED_BY, caller.userId())
                .set(PLUGIN_INSTANCES.CREATED_AT, now)
                .set(PLUGIN_INSTANCES.LAST_RUN_AT, (OffsetDateTime) null)
                .set(PLUGIN_INSTANCES.POSITION, position)
                .execute();
        events.recordAct(EventCode.PLUGIN_INSTANCE_CREATED, "plugin_instance", id, caller,
                creationChanges(body, configuration.value(), version, policy));
        return ActResult.ok(queries.detail(id, caller.userId()));
    }

    @Transactional
    public ActResult save(Caller caller, String id, JsonNode body) {
        if (!mayConfigure(caller)) {
            return ActResult.refused(403, "You may not configure plugins", null);
        }
        Record instance = live(id);
        if (instance == null) {
            return ActResult.unknown("plugin instance");
        }
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(instance.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID))).fetchOne();
        JsonNode version = queries.versionOf(implementation.get(PLUGIN_IMPLEMENTATIONS.ID),
                instance.get(PLUGIN_INSTANCES.VERSION));
        ActResult refusal = draftRefusal(implementation, body, instance, version);
        if (refusal != null) {
            return refusal;
        }
        JsonNode oldConfiguration = json.readTree(instance.get(PLUGIN_INSTANCES.CONFIGURATION).data());
        Configuration configuration = storedConfiguration(version, body.path("configuration"), oldConfiguration);
        if (configuration.refusal() != null) {
            return configuration.refusal();
        }
        JsonNode policy = body.has("policy") ? body.path("policy") :
                instance.get(PLUGIN_INSTANCES.POLICY) == null ? defaultPolicy(version)
                        : json.readTree(instance.get(PLUGIN_INSTANCES.POLICY).data());
        refusal = policyRefusal(policy, version);
        if (refusal != null) {
            return refusal;
        }
        JsonNode oldSettings = instance.get(PLUGIN_INSTANCES.SETTINGS) == null ? json.nullNode()
                : json.readTree(instance.get(PLUGIN_INSTANCES.SETTINGS).data());
        JsonNode newSettings = body.path("settings");
        String oldCategory = instance.get(PLUGIN_INSTANCES.LINKED_CATEGORY_ID);
        String newCategory = nullableString(body.path("linkedCategoryId"));
        String oldName = instance.get(PLUGIN_INSTANCES.NAME);
        String newName = body.path("names").path("en").asString(body.path("names").path("cs").asString()).trim();
        String oldNames = instance.get(PLUGIN_INSTANCES.NAMES).data();
        String newNames = body.path("names").toString();
        List<Map<String, Object>> changes = new ArrayList<>();
        if (!oldNames.equals(newNames)) {
            changes.add(EventChanges.change("names", oldNames, newNames));
        }
        Map<String, Object> oldPublic = sanitizedConfiguration(oldConfiguration, version);
        Map<String, Object> newPublic = sanitizedConfiguration(configuration.value(), version);
        if (!oldPublic.equals(newPublic)) {
            changes.add(EventChanges.change("configuration", oldPublic, newPublic));
        }
        if (!sameSecrets(oldConfiguration, configuration.value(), version)) {
            changes.add(EventChanges.change("secrets", secretSet(oldConfiguration, version),
                    secretSet(configuration.value(), version)));
        }
        if (!Objects.equals(oldCategory, newCategory)) {
            changes.add(EventChanges.change("linkedCategoryId", oldCategory, newCategory));
        }
        if (!oldSettings.equals(newSettings)) {
            changes.add(EventChanges.change("settings", values(oldSettings), values(newSettings)));
        }
        JsonNode oldPolicy = instance.get(PLUGIN_INSTANCES.POLICY) == null ? defaultPolicy(version)
                : json.readTree(instance.get(PLUGIN_INSTANCES.POLICY).data());
        if (!oldPolicy.equals(policy)) {
            changes.add(EventChanges.change("policy", values(oldPolicy), values(policy)));
        }
        dsl.update(PLUGIN_INSTANCES)
                .set(PLUGIN_INSTANCES.NAME, newName)
                .set(PLUGIN_INSTANCES.NAMES, JSONB.valueOf(newNames))
                .set(PLUGIN_INSTANCES.CONFIGURATION,
                        JSONB.valueOf(json.writeValueAsString(configuration.value())))
                .set(PLUGIN_INSTANCES.SETTINGS, nullableJson(newSettings))
                .set(PLUGIN_INSTANCES.POLICY, JSONB.valueOf(json.writeValueAsString(policy)))
                .set(PLUGIN_INSTANCES.LINKED_CATEGORY_ID, newCategory)
                .where(PLUGIN_INSTANCES.ID.eq(id))
                .execute();
        events.recordAct(EventCode.PLUGIN_INSTANCE_CONFIGURED, "plugin_instance", id, caller, changes);
        if ("Custody".equals(implementation.get(PLUGIN_IMPLEMENTATIONS.KIND))) {
            runs.startPlacing(caller.userId(), source("Plugins", "/plugins?i=" + id));
        }
        return ActResult.ok(queries.detail(id, caller.userId()));
    }

    @Transactional
    public ActResult setEnabled(Caller caller, String id, boolean enabled) {
        if (!mayConfigure(caller)) {
            return ActResult.refused(403, "You may not configure plugins", null);
        }
        Record instance = live(id);
        if (instance == null) {
            return ActResult.unknown("plugin instance");
        }
        if (instance.get(PLUGIN_INSTANCES.IS_ENABLED) == enabled) {
            return ActResult.refused(409, enabled ? "It is already enabled" : "It is already disabled",
                    "plugin.unchanged");
        }
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(instance.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID))).fetchOne();
        JsonNode version = queries.versionOf(implementation.get(PLUGIN_IMPLEMENTATIONS.ID),
                instance.get(PLUGIN_INSTANCES.VERSION));
        if (enabled && !runnableContract(version.path("contractVersion").asString())) {
            return ActResult.refused(409, "Its version was built for a contract VERA does not run",
                    "plugin.contract");
        }
        if (!enabled && lastWayIn(instance, implementation.get(PLUGIN_IMPLEMENTATIONS.KIND))) {
            return ActResult.refused(409, "It is the last way to log in", "plugin.last_identity");
        }
        dsl.update(PLUGIN_INSTANCES).set(PLUGIN_INSTANCES.IS_ENABLED, enabled)
                .where(PLUGIN_INSTANCES.ID.eq(id)).execute();
        EventCode code = enabled ? EventCode.PLUGIN_INSTANCE_ENABLED : EventCode.PLUGIN_INSTANCE_DISABLED;
        events.recordAct(code, "plugin_instance", id, caller,
                List.of(EventChanges.change("isEnabled", !enabled, enabled)));
        if ("Custody".equals(implementation.get(PLUGIN_IMPLEMENTATIONS.KIND))) {
            runs.startPlacing(caller.userId(), source("Plugins", "/plugins?i=" + id));
        }
        return ActResult.ok(queries.detail(id, caller.userId()));
    }

    // ACT-plugin-reset; harvest is required for every Harvester, not an optional declaration.
    @Transactional
    public ActResult reset(Caller caller, String id) {
        if (!mayConfigure(caller)) {
            return ActResult.refused(403, "You may not configure plugins", "forbidden");
        }
        Record instance = live(id);
        if (instance == null) {
            return ActResult.unknown("plugin instance");
        }
        if (!queries.canReset(instance)) {
            return ActResult.refused(409, "Its version declares no cursor operation", "plugin.no_cursor");
        }
        dsl.deleteFrom(PLUGIN_CURSORS).where(PLUGIN_CURSORS.INSTANCE_ID.eq(id)).execute();
        dsl.update(PLUGIN_INSTANCES).set(PLUGIN_INSTANCES.REBUILD_AFTER, now())
                .where(PLUGIN_INSTANCES.ID.eq(id)).execute();
        events.recordAct(EventCode.PLUGIN_INSTANCE_RESET, "plugin_instance", id, caller, List.of());
        return ActResult.ok(queries.detail(id, caller.userId()));
    }

    @Transactional
    public ActResult delete(Caller caller, String id) {
        if (!mayConfigure(caller)) {
            return ActResult.refused(403, "You may not configure plugins", null);
        }
        Record instance = live(id);
        if (instance == null) {
            return ActResult.unknown("plugin instance");
        }
        if (instance.get(PLUGIN_INSTANCES.IS_PREDEFINED)) {
            return ActResult.refused(409, "A predefined instance is not deleted", "plugin.predefined");
        }
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(instance.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID))).fetchOne();
        String kind = implementation.get(PLUGIN_IMPLEMENTATIONS.KIND);
        if (lastWayIn(instance, kind)) {
            return ActResult.refused(409, "It is the last way to log in", "plugin.last_identity");
        }
        dsl.update(PLUGIN_INSTANCES)
                .set(PLUGIN_INSTANCES.IS_ENABLED, false)
                .set(PLUGIN_INSTANCES.IS_DELETED, true)
                .where(PLUGIN_INSTANCES.ID.eq(id)).execute();
        dsl.deleteFrom(SCHEDULES).where(SCHEDULES.INSTANCE_ID.eq(id)).execute();
        events.recordAct(EventCode.PLUGIN_INSTANCE_DELETED, "plugin_instance", id, caller,
                List.of(EventChanges.change("isDeleted", false, true)));
        if ("Custody".equals(kind)) {
            runs.startPlacing(caller.userId(), source("Plugins", "/plugins?i=" + id));
        }
        return ActResult.noContent();
    }

    @Transactional
    public ActResult runNow(Caller caller, String id) {
        if (!Permissions.hasPermission(access.heldBy(caller.userId()).grants(), "plugin.run")) {
            return ActResult.refused(403, "You may not run plugins", "forbidden");
        }
        Record instance = live(id);
        if (instance == null) {
            return ActResult.unknown("plugin instance");
        }
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(instance.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID))).fetchOne();
        String kind = implementation.get(PLUGIN_IMPLEMENTATIONS.KIND);
        if (!SCHEDULABLE_KINDS.contains(kind)) {
            return ActResult.refused(422, "That plugin runs only while somebody uses it",
                    "plugin.not_runnable");
        }
        if (!instance.get(PLUGIN_INSTANCES.IS_ENABLED)) {
            return ActResult.refused(409, "It is disabled", "plugin.disabled");
        }
        String label = instance.get(PLUGIN_INSTANCES.NAME) + " — run by hand";
        String runId = runs.start(label, id, null,
                trigger("Plugins", "/plugins?i=" + id), caller.userId(), null);
        OffsetDateTime started = now();
        dsl.update(PLUGIN_INSTANCES).set(PLUGIN_INSTANCES.LAST_RUN_AT, started)
                .where(PLUGIN_INSTANCES.ID.eq(id)).execute();
        Record run = dsl.selectFrom(RUNS).where(RUNS.ID.eq(runId)).fetchOne();
        return ActResult.ok(tasks.run(run, started.toInstant()));
    }

    private ActResult draftRefusal(Record implementation, JsonNode body, Record existing, JsonNode version) {
        JsonNode names = body.path("names");
        SelectConditionStep<Record1<Integer>> query = dsl.selectOne().from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(implementation.get(PLUGIN_IMPLEMENTATIONS.ID)))
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse());
        List<String> localizedNames = new ArrayList<>();
        names.properties().forEach(entry -> localizedNames.add(entry.getValue().asString().trim()));
        Condition collision = org.jooq.impl.DSL.falseCondition();
        for (Map.Entry<String, JsonNode> entry : names.properties()) {
            collision = collision.or(org.jooq.impl.DSL.field("lower({0} ->> {1})", String.class,
                            PLUGIN_INSTANCES.NAMES, entry.getKey())
                    .eq(entry.getValue().asString().trim().toLowerCase(java.util.Locale.ROOT)));
        }
        query = query.and(collision);
        if (existing != null) {
            query = query.and(PLUGIN_INSTANCES.ID.ne(existing.get(PLUGIN_INSTANCES.ID)));
        }
        if (dsl.fetchExists(query)) {
            return ActResult.refused(409, "Another instance of it has that name", "plugin.name_taken");
        }
        String categoryId = nullableString(body.path("linkedCategoryId"));
        if (categoryId != null && !dsl.fetchExists(dsl.selectOne().from(CATEGORIES)
                .where(CATEGORIES.ID.eq(categoryId)))) {
            return ActResult.refused(422, "No such category", "plugin.no_such_category");
        }
        JsonNode settings = body.path("settings");
        String kind = implementation.get(PLUGIN_IMPLEMENTATIONS.KIND);
        boolean needsSettings = SETTINGS_KINDS.contains(kind);
        if (needsSettings != !settings.isNull() || (!settings.isNull()
                && !kind.equals(settings.path("kind").asString()))) {
            return ActResult.refused(422, "A " + kind + " instance takes its own settings", "plugin.settings");
        }
        if ("Custody".equals(kind)) {
            String custodyId = settings.path("custodyId").asString();
            boolean valid = dsl.fetchExists(dsl.selectOne().from(REQUEST_CUSTODIES)
                    .where(REQUEST_CUSTODIES.ID.eq(custodyId)).and(REQUEST_CUSTODIES.IS_FALLBACK.isFalse()));
            if (!valid) {
                return ActResult.refused(422, "Pick a request custody", "plugin.no_such_custody");
            }
        }
        if ("Identity".equals(kind)) {
            List<String> roleIds = new ArrayList<>();
            if (!settings.path("defaultRoleId").isNull()) {
                roleIds.add(settings.path("defaultRoleId").asString());
            }
            settings.path("mappings").forEach(mapping -> roleIds.add(mapping.path("roleId").asString()));
            if (roleIds.stream().anyMatch(roleId -> !dsl.fetchExists(dsl.selectOne().from(ROLES)
                    .where(ROLES.ID.eq(roleId))))) {
                return ActResult.refused(422, "No such role", "plugin.no_such_role");
            }
            if (existing != null && queries.hasIdentityUsers(existing.get(PLUGIN_INSTANCES.ID))) {
                JsonNode old = existing.get(PLUGIN_INSTANCES.SETTINGS) == null ? null
                        : json.readTree(existing.get(PLUGIN_INSTANCES.SETTINGS).data());
                if (old != null && !old.path("userIdClaim").asString()
                        .equals(settings.path("userIdClaim").asString())) {
                    return ActResult.refused(409,
                            "The user id claim is fixed once people sign in through it",
                            "plugin.user_claim_fixed");
                }
            }
        }
        return null;
    }

    private Configuration storedConfiguration(JsonNode version, JsonNode sent, JsonNode previous) {
        Set<String> allowed = new LinkedHashSet<>();
        for (JsonNode field : version.path("configFields")) {
            allowed.add(field.path("key").asString());
        }
        for (Map.Entry<String, JsonNode> entry : sent.properties()) {
            if (!allowed.contains(entry.getKey())) {
                return new Configuration(null, ActResult.refused(422,
                        entry.getKey() + " is not a field of this version", "plugin.config_unknown"));
            }
        }
        ObjectNode config = json.createObjectNode();
        for (JsonNode field : version.path("configFields")) {
            String key = field.path("key").asString();
            boolean secret = field.path("isSecret").asBoolean();
            JsonNode value = sent.has(key) ? sent.path(key) : secret && previous != null ? previous.path(key) : null;
            String trimmed = value == null || value.isMissingNode() || value.isNull() ? null
                    : value.asString().trim();
            if (trimmed == null || trimmed.isEmpty()) {
                if (field.path("isRequired").asBoolean()) {
                    return new Configuration(null, ActResult.refused(422, key + " is required",
                            "plugin.config_missing"));
                }
            } else {
                config.put(key, trimmed);
            }
        }
        return new Configuration(config, null);
    }

    private ActResult policyRefusal(JsonNode policy, JsonNode version) {
        List<String> declared = new ArrayList<>();
        version.path("declares").path("properties").forEach(property ->
                declared.add(property.path("key").asString()));
        List<String> configured = new ArrayList<>();
        policy.path("tiers").forEach(tier -> configured.add(tier.path("key").asString()));
        declared.sort(String::compareTo);
        configured.sort(String::compareTo);
        if (!declared.equals(configured)) {
            return ActResult.refused(422, "Give a tier to each property it supplies, and only those",
                    "plugin.policy");
        }
        Set<String> raw = new LinkedHashSet<>();
        version.path("declares").path("rawStates").forEach(state -> raw.add(state.path("raw").asString()));
        for (JsonNode copy : policy.path("copyStates")) {
            if (!raw.contains(copy.asString())) {
                return ActResult.refused(422, "Only a state the registry reports can count as a copy",
                        "plugin.policy");
            }
        }
        boolean hasAgent = !version.path("declares").path("agent").isNull();
        if (hasAgent != !policy.path("agent").isNull()) {
            return ActResult.refused(422, hasAgent ? "Name its agent" : "It proposes nothing, so it has no agent",
                    "plugin.policy");
        }
        return null;
    }

    private List<Map<String, Object>> creationChanges(JsonNode body, JsonNode configuration,
            JsonNode version, JsonNode policy) {
        List<Map<String, Object>> changes = new ArrayList<>();
        changes.add(EventChanges.change("names", null, values(body.path("names"))));
        changes.add(EventChanges.change("implementationId", null, body.path("implementationId").asString()));
        changes.add(EventChanges.change("version", null, version.path("version").asString()));
        changes.add(EventChanges.change("configuration", null, sanitizedConfiguration(configuration, version)));
        changes.add(EventChanges.change("secrets", List.of(), secretSet(configuration, version)));
        changes.add(EventChanges.change("linkedCategoryId", null, nullableString(body.path("linkedCategoryId"))));
        changes.add(EventChanges.change("settings", null, values(body.path("settings"))));
        changes.add(EventChanges.change("policy", null, values(policy)));
        return changes;
    }

    private Map<String, Object> sanitizedConfiguration(JsonNode configuration, JsonNode version) {
        Map<String, Object> result = new LinkedHashMap<>();
        configuration.properties().forEach(entry -> {
            if (!isSecret(version, entry.getKey())) {
                result.put(entry.getKey(), entry.getValue().asString());
            }
        });
        return result;
    }

    private Map<String, Object> sanitizedConfiguration(ObjectNode configuration, JsonNode version) {
        return sanitizedConfiguration((JsonNode) configuration, version);
    }

    private List<String> secretSet(JsonNode configuration, JsonNode version) {
        List<String> result = new ArrayList<>();
        for (JsonNode field : version.path("configFields")) {
            String key = field.path("key").asString();
            if (field.path("isSecret").asBoolean() && configuration.has(key)
                    && !configuration.path(key).asString().isBlank()) {
                result.add(key);
            }
        }
        return result;
    }

    private boolean sameSecrets(JsonNode before, JsonNode after, JsonNode version) {
        return secretSet(before, version).equals(secretSet(after, version));
    }

    private boolean isSecret(JsonNode version, String key) {
        for (JsonNode field : version.path("configFields")) {
            if (field.path("key").asString().equals(key)) {
                return field.path("isSecret").asBoolean();
            }
        }
        return false;
    }

    private JsonNode defaultPolicy(JsonNode version) {
        ObjectNode policy = json.createObjectNode();
        ArrayNode tiers = policy.putArray("tiers");
        version.path("declares").path("properties").forEach(property -> {
            ObjectNode tier = tiers.addObject();
            tier.put("key", property.path("key").asString());
            tier.put("tier", property.path("tier").asInt());
        });
        ArrayNode copyStates = policy.putArray("copyStates");
        version.path("declares").path("rawStates").forEach(state -> {
            if (state.path("isExistingCopy").asBoolean()) {
                copyStates.add(state.path("raw").asString());
            }
        });
        policy.set("agent", version.path("declares").path("agent").deepCopy());
        return policy;
    }

    private JsonNode runnableVersion(JSONB versions) {
        JsonNode candidates = json.readTree(versions.data());
        for (JsonNode candidate : candidates) {
            if (runnableContract(candidate.path("contractVersion").asString())) {
                return candidate;
            }
        }
        return null;
    }

    private boolean runnableContract(String contractVersion) {
        return contractVersion.startsWith("1.");
    }

    private String triggerValues(JsonNode version) {
        ArrayNode triggers = json.createArrayNode();
        version.path("triggers").forEach(trigger -> {
            if (!"OnSchedule".equals(trigger.asString())) {
                triggers.add(trigger.asString());
            }
        });
        return triggers.toString();
    }

    private boolean lastWayIn(Record instance, String kind) {
        if (!"Identity".equals(kind) || !instance.get(PLUGIN_INSTANCES.IS_ENABLED)) {
            return false;
        }
        return !dsl.fetchExists(dsl.selectOne().from(PLUGIN_INSTANCES)
                .join(PLUGIN_IMPLEMENTATIONS).on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("Identity"))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .and(PLUGIN_INSTANCES.ID.ne(instance.get(PLUGIN_INSTANCES.ID))));
    }

    private Record live(String id) {
        return dsl.selectFrom(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(id)).and(PLUGIN_INSTANCES.IS_DELETED.isFalse()).fetchOne();
    }

    private boolean mayConfigure(Caller caller) {
        return Permissions.hasPermission(access.heldBy(caller.userId()).grants(), "plugin.configure");
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }

    private JSONB nullableJson(JsonNode value) {
        return value == null || value.isNull() ? null : JSONB.valueOf(json.writeValueAsString(value));
    }

    private String nullableString(JsonNode value) {
        return value == null || value.isNull() || value.isMissingNode() ? null : value.asString();
    }

    private Map<String, Object> source(String label, String path) {
        Map<String, Object> from = new LinkedHashMap<>();
        from.put("label", label);
        from.put("path", path);
        return from;
    }

    private Map<String, Object> trigger(String label, String path) {
        Map<String, Object> from = source(label, path);
        Map<String, Object> trigger = new LinkedHashMap<>();
        trigger.put("kind", "manual");
        trigger.put("from", from);
        return trigger;
    }

    private Object values(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) {
            return null;
        }
        if (value.isObject()) {
            Map<String, Object> result = new LinkedHashMap<>();
            value.properties().forEach(entry -> result.put(entry.getKey(), values(entry.getValue())));
            return result;
        }
        if (value.isArray()) {
            List<Object> result = new ArrayList<>();
            value.forEach(item -> result.add(values(item)));
            return result;
        }
        if (value.isString()) {
            return value.asString();
        }
        if (value.isBoolean()) {
            return value.asBoolean();
        }
        return value.isIntegralNumber() ? value.asLong() : value.asDouble();
    }

    private record Configuration(ObjectNode value, ActResult refusal) { }
}

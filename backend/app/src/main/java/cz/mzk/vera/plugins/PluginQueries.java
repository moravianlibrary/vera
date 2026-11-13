package cz.mzk.vera.plugins;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_SYNC;
import static cz.mzk.vera.db.tables.Tables.HOOKS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.SCHEDULES;
import static cz.mzk.vera.db.tables.Tables.TASK_RETENTION;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;

import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.tasks.TasksQueries;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-model; PLG-secrets; PLG-delete; PLG-disable; PLG-delivery-hooks; PLG-run-items.
@Repository
public class PluginQueries {
    private static final List<String> KIND_ORDER = List.of("Identity", "Input", "Identifier", "Harvester",
            "CatalogAdapter", "PropertySource", "Registry", "Validation", "Restriction", "Custody",
            "Classifier", "ListGenerator", "Link", "PublicationDetector", "Message", "DeliveryChannel");
    private static final int RECENT_RUNS = 5;

    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final TasksQueries tasks;
    private final Clock clock;
    private final JsonMapper json;

    public PluginQueries(DSLContext dsl, HeldAccessQueries access, TasksQueries tasks,
            Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.tasks = tasks;
        this.clock = clock;
        this.json = json;
    }

    public boolean canRead(String userId) {
        return Permissions.hasPermission(access.heldBy(userId).grants(), "plugin.read");
    }

    public Map<String, Object> index(String userId) {
        Instant now = clock.instant();
        List<Map<String, Object>> implementations = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS).fetch()
                .stream().map(this::implementation).sorted(Comparator
                        .comparingInt((Map<String, Object> value) -> KIND_ORDER.indexOf((String) value.get("kind")))
                        .thenComparing(value -> (String) value.get("name")))
                .toList();
        boolean canReadHooks = Permissions.hasPermission(access.heldBy(userId).grants(), "hook.read");
        List<Map<String, Object>> instances = dsl.selectFrom(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION)
                .fetch(row -> detail(row, now, canReadHooks));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("asOf", Instants.format(now));
        result.put("implementations", implementations);
        result.put("instances", instances);
        return result;
    }

    public List<Map<String, Object>> instances() {
        List<Map<String, Object>> result = dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME,
                        PLUGIN_IMPLEMENTATIONS.NAME,
                        PLUGIN_IMPLEMENTATIONS.KIND, PLUGIN_INSTANCES.IS_ENABLED)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION)
                .fetch(row -> summary(row));
        return result;
    }

    public Map<String, Object> detail(String id, String userId) {
        Record instance = dsl.selectFrom(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(id)).and(PLUGIN_INSTANCES.IS_DELETED.isFalse()).fetchOne();
        if (instance == null) {
            return null;
        }
        boolean canReadHooks = Permissions.hasPermission(access.heldBy(userId).grants(), "hook.read");
        return detail(instance, clock.instant(), canReadHooks);
    }

    public Map<String, Object> impact(String id, String userId) {
        Record instance = dsl.selectFrom(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(id)).and(PLUGIN_INSTANCES.IS_DELETED.isFalse()).fetchOne();
        if (instance == null) {
            return null;
        }
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(instance.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID))).fetchOne();
        String kind = implementation.get(PLUGIN_IMPLEMENTATIONS.KIND);
        JsonNode version = versionOf(implementation.get(PLUGIN_IMPLEMENTATIONS.VERSIONS),
                instance.get(PLUGIN_INSTANCES.VERSION));
        List<String> operations = strings(version.path("declares").path("operations"));
        List<? extends Record> otherInstances = dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_IMPLEMENTATIONS.KIND,
                        PLUGIN_IMPLEMENTATIONS.VERSIONS, PLUGIN_INSTANCES.VERSION)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .and(PLUGIN_IMPLEMENTATIONS.KIND.eq(kind))
                .and(PLUGIN_INSTANCES.ID.ne(id)).fetch();
        long otherCount = otherInstances.stream().filter(other -> {
            if (!"Input".equals(kind)) {
                return true;
            }
            JsonNode otherVersion = versionOf(other.get(PLUGIN_IMPLEMENTATIONS.VERSIONS),
                    other.get(PLUGIN_INSTANCES.VERSION));
            return strings(otherVersion.path("declares").path("operations")).stream()
                    .anyMatch(operations::contains);
        }).count();
        int scheduleCount = dsl.fetchCount(SCHEDULES, SCHEDULES.INSTANCE_ID.eq(id));
        int runCount = keptRunCount(id);
        int userCount = dsl.fetchCount(USER_IDENTITIES, USER_IDENTITIES.INSTANCE_ID.eq(id));
        JsonNode settings = node(instance.get(PLUGIN_INSTANCES.SETTINGS));
        int openProposalCount = 0;
        if ("Custody".equals(kind) && settings != null && settings.path("custodyId").isString()) {
            openProposalCount = dsl.fetchCount(REQUEST_PLACEMENTS
                    .join(REQUESTS).on(REQUESTS.ID.eq(REQUEST_PLACEMENTS.REQUEST_ID)),
                    REQUEST_PLACEMENTS.CUSTODY_ID.eq(settings.path("custodyId").asString())
                            .and(REQUESTS.DECISION.eq("Pending")));
        }
        List<? extends Record> stoppedHooks = dsl.select(HOOKS.ID, HOOKS.NAME)
                .from(HOOKS).where(HOOKS.CHANNEL_ID.eq(id)).and(HOOKS.STATE.eq("active"))
                .orderBy(HOOKS.POSITION).fetch();
        int hookCount = stoppedHooks.size();
        boolean canReadHooks = Permissions.hasPermission(access.heldBy(userId).grants(), "hook.read");
        List<Map<String, Object>> hooks = canReadHooks ? stoppedHooks.stream().map(hook -> {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("id", hook.get(HOOKS.ID));
            value.put("name", hook.get(HOOKS.NAME));
            return value;
        }).toList() : List.of();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("kind", kind);
        result.put("otherEnabledCount", otherCount);
        result.put("scheduleCount", scheduleCount);
        result.put("runCount", runCount);
        result.put("userCount", userCount);
        result.put("openProposalCount", openProposalCount);
        result.put("hookCount", hookCount);
        result.put("hooks", hooks);
        return result;
    }

    public JsonNode versionOf(String implementationId, String version) {
        JSONB versions = dsl.select(PLUGIN_IMPLEMENTATIONS.VERSIONS).from(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(implementationId)).fetchOne(PLUGIN_IMPLEMENTATIONS.VERSIONS);
        return versions == null ? null : versionOf(versions, version);
    }

    public Map<String, Object> instanceSummary(String id) {
        Record row = dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME, PLUGIN_IMPLEMENTATIONS.NAME,
                        PLUGIN_IMPLEMENTATIONS.KIND, PLUGIN_INSTANCES.IS_ENABLED)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_INSTANCES.ID.eq(id)).fetchOne();
        return row == null ? null : summary(row);
    }

    public boolean hasIdentityUsers(String id) {
        return dsl.fetchExists(dsl.selectOne().from(USER_IDENTITIES).where(USER_IDENTITIES.INSTANCE_ID.eq(id)));
    }

    public int keptRunCount(String id) {
        Instant now = clock.instant();
        Record retention = dsl.select(TASK_RETENTION.DAYS, TASK_RETENTION.FAILED_DAYS)
                .from(TASK_RETENTION).where(TASK_RETENTION.ID.eq(1)).fetchOne();
        OffsetDateTime regularCutoff = now.minusSeconds(retention.get(TASK_RETENTION.DAYS) * 86_400L)
                .atOffset(ZoneOffset.UTC);
        OffsetDateTime failureCutoff = now.minusSeconds(retention.get(TASK_RETENTION.FAILED_DAYS) * 86_400L)
                .atOffset(ZoneOffset.UTC);
        return dsl.fetchCount(RUNS, RUNS.INSTANCE_ID.eq(id)
                .and(RUNS.STARTED_AT.ge(regularCutoff).or(RUNS.STATE.in("Failed", "Cancelled")
                        .and(RUNS.STARTED_AT.ge(failureCutoff)))));
    }

    private Map<String, Object> implementation(Record row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.get(PLUGIN_IMPLEMENTATIONS.ID));
        result.put("descriptorId", row.get(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID));
        result.put("name", row.get(PLUGIN_IMPLEMENTATIONS.NAME));
        result.put("kind", row.get(PLUGIN_IMPLEMENTATIONS.KIND));
        result.put("description", row.get(PLUGIN_IMPLEMENTATIONS.DESCRIPTION));
        result.put("versions", values(node(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS))));
        return result;
    }

    private Map<String, Object> detail(Record row, Instant now, boolean canReadHooks) {
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(row.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID))).fetchOne();
        JsonNode version = versionOf(implementation.get(PLUGIN_IMPLEMENTATIONS.VERSIONS),
                row.get(PLUGIN_INSTANCES.VERSION));
        Map<String, String> stored = stringMap(node(row.get(PLUGIN_INSTANCES.CONFIGURATION)));
        List<String> secrets = new ArrayList<>();
        Map<String, String> publicConfiguration = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : stored.entrySet()) {
            if (Set.of("catalog_base", "opac_url").contains(entry.getKey())) {
                continue;
            }
            if (isSecret(version, entry.getKey())) {
                if (!entry.getValue().isBlank()) {
                    secrets.add(entry.getKey());
                }
            } else {
                publicConfiguration.put(entry.getKey(), entry.getValue());
            }
        }
        List<? extends Record> runRows = dsl.selectFrom(RUNS).where(RUNS.INSTANCE_ID.eq(row.get(PLUGIN_INSTANCES.ID)))
                .orderBy(RUNS.STARTED_AT.desc(), RUNS.ID.desc()).fetch();
        List<? extends Record> kept = runRows.stream().filter(run -> isKept(run, now)).toList();
        List<Map<String, Object>> recentRuns = kept.stream().limit(RECENT_RUNS)
                .map(run -> tasks.run(run, now)).map(this::recentRun).toList();
        OffsetDateTime lastRun = row.get(PLUGIN_INSTANCES.LAST_RUN_AT);
        if (!kept.isEmpty() && (lastRun == null || kept.getFirst().get(RUNS.STARTED_AT).isAfter(lastRun))) {
            lastRun = kept.getFirst().get(RUNS.STARTED_AT);
        }
        List<Map<String, Object>> schedules = dsl.selectFrom(SCHEDULES)
                .where(SCHEDULES.INSTANCE_ID.eq(row.get(PLUGIN_INSTANCES.ID))).fetch(schedule -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("id", schedule.get(SCHEDULES.ID));
                    value.put("name", schedule.get(SCHEDULES.NAME));
                    value.put("cadence", values(node(schedule.get(SCHEDULES.CADENCE))));
                    value.put("isPaused", schedule.get(SCHEDULES.PAUSED_BY) != null);
                    return value;
                });
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.get(PLUGIN_INSTANCES.ID));
        result.put("name", row.get(PLUGIN_INSTANCES.NAME));
        result.put("implementationId", implementation.get(PLUGIN_IMPLEMENTATIONS.ID));
        result.put("kind", implementation.get(PLUGIN_IMPLEMENTATIONS.KIND));
        result.put("version", row.get(PLUGIN_INSTANCES.VERSION));
        result.put("isEnabled", row.get(PLUGIN_INSTANCES.IS_ENABLED));
        result.put("configuration", publicConfiguration);
        result.put("secretsSet", secrets);
        result.put("linkedCategoryId", row.get(PLUGIN_INSTANCES.LINKED_CATEGORY_ID));
        result.put("triggers", values(node(row.get(PLUGIN_INSTANCES.TRIGGERS))));
        result.put("settings", values(node(row.get(PLUGIN_INSTANCES.SETTINGS))));
        result.put("isPredefined", row.get(PLUGIN_INSTANCES.IS_PREDEFINED));
        result.put("policy", policy(row, version));
        result.put("createdBy", row.get(PLUGIN_INSTANCES.CREATED_BY));
        result.put("createdAt", row.get(PLUGIN_INSTANCES.CREATED_AT).toLocalDate().toString());
        result.put("schedules", schedules);
        List<Map<String, Object>> hooks = dsl.selectFrom(HOOKS)
                .where(HOOKS.CHANNEL_ID.eq(row.get(PLUGIN_INSTANCES.ID)))
                .orderBy(HOOKS.POSITION).fetch(hook -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("id", hook.get(HOOKS.ID));
                    value.put("name", hook.get(HOOKS.NAME));
                    value.put("state", hook.get(HOOKS.STATE));
                    return value;
                });
        result.put("hooks", canReadHooks ? hooks : List.of());
        result.put("recentRuns", recentRuns);
        result.put("runCount", kept.size());
        result.put("lastRunAt", lastRun == null ? null : Instants.format(lastRun.toInstant()));
        result.put("mirror", strings(version.path("declares").path("operations")).contains("sync")
                ? mirror(row.get(PLUGIN_INSTANCES.ID)) : null);
        result.put("canReset", canReset(row));
        return result;
    }

    public boolean canReset(Record instance) {
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(instance.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID))).fetchOne();
        JsonNode version = versionOf(implementation.get(PLUGIN_IMPLEMENTATIONS.VERSIONS),
                instance.get(PLUGIN_INSTANCES.VERSION));
        List<String> operations = strings(version.path("declares").path("operations"));
        return "Harvester".equals(implementation.get(PLUGIN_IMPLEMENTATIONS.KIND))
                || operations.contains("changes") || operations.contains("sync");
    }

    private Map<String, Object> mirror(String id) {
        OffsetDateTime syncedAt = dsl.select(CATALOG_MIRROR_SYNC.SYNCED_AT).from(CATALOG_MIRROR_SYNC)
                .where(CATALOG_MIRROR_SYNC.INSTANCE_ID.eq(id)).fetchOne(CATALOG_MIRROR_SYNC.SYNCED_AT);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("syncedAt", syncedAt == null ? null : Instants.format(syncedAt.toInstant()));
        result.put("records", dsl.fetchCount(CATALOG_MIRROR, CATALOG_MIRROR.INSTANCE_ID.eq(id)));
        return result;
    }

    private Map<String, Object> summary(Record row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.get(PLUGIN_INSTANCES.ID));
        result.put("name", row.get(PLUGIN_INSTANCES.NAME));
        result.put("plugin", row.get(PLUGIN_IMPLEMENTATIONS.NAME));
        result.put("kind", row.get(PLUGIN_IMPLEMENTATIONS.KIND));
        result.put("isEnabled", row.get(PLUGIN_INSTANCES.IS_ENABLED));
        return result;
    }

    private Map<String, Object> recentRun(Map<String, Object> run) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String key : List.of("id", "what", "state", "startedAt", "errorCount", "changes")) {
            result.put(key, run.get(key));
        }
        return result;
    }

    private Map<String, Object> policy(Record row, JsonNode version) {
        JsonNode stored = node(row.get(PLUGIN_INSTANCES.POLICY));
        if (stored != null) {
            return objectMap(stored);
        }
        JsonNode declares = version.path("declares");
        List<Map<String, Object>> tiers = new ArrayList<>();
        declares.path("properties").forEach(property -> {
            Map<String, Object> tier = new LinkedHashMap<>();
            tier.put("key", property.path("key").asString());
            tier.put("tier", property.path("tier").asInt());
            tiers.add(tier);
        });
        List<String> copyStates = new ArrayList<>();
        declares.path("rawStates").forEach(state -> {
            if (state.path("isExistingCopy").asBoolean()) {
                copyStates.add(state.path("raw").asString());
            }
        });
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tiers", tiers);
        result.put("copyStates", copyStates);
        result.put("agent", values(declares.path("agent")));
        return result;
    }

    private boolean isKept(Record row, Instant now) {
        Record retention = dsl.select(TASK_RETENTION.DAYS, TASK_RETENTION.FAILED_DAYS)
                .from(TASK_RETENTION).where(TASK_RETENTION.ID.eq(1)).fetchOne();
        int days = Set.of("Failed", "Cancelled").contains(row.get(RUNS.STATE))
                ? retention.get(TASK_RETENTION.FAILED_DAYS) : retention.get(TASK_RETENTION.DAYS);
        return row.get(RUNS.STARTED_AT).toInstant().isAfter(now.minusSeconds(days * 86_400L));
    }

    private JsonNode versionOf(JSONB versions, String version) {
        JsonNode entries = node(versions);
        for (JsonNode entry : entries) {
            if (entry.path("version").asString().equals(version)) {
                return entry;
            }
        }
        return entries.isEmpty() ? json.createObjectNode() : entries.get(0);
    }

    private boolean isSecret(JsonNode version, String key) {
        for (JsonNode field : version.path("configFields")) {
            if (field.path("key").asString().equals(key)) {
                return field.path("isSecret").asBoolean();
            }
        }
        return false;
    }

    private JsonNode node(JSONB value) {
        return value == null ? null : json.readTree(value.data());
    }

    private Object values(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) {
            return null;
        }
        if (value.isObject()) {
            return objectMap(value);
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
        double number = value.asDouble();
        if (number == Math.rint(number)) {
            return value.asLong();
        }
        return number;
    }

    private Map<String, Object> objectMap(JsonNode value) {
        Map<String, Object> result = new LinkedHashMap<>();
        value.properties().forEach(property -> result.put(property.getKey(), values(property.getValue())));
        return result;
    }

    private Map<String, String> stringMap(JsonNode value) {
        Map<String, String> result = new LinkedHashMap<>();
        if (value != null) {
            value.properties().forEach(property -> result.put(property.getKey(), property.getValue().asString()));
        }
        return result;
    }

    private List<String> strings(JsonNode array) {
        List<String> result = new ArrayList<>();
        array.forEach(value -> result.add(value.asString()));
        return result;
    }
}

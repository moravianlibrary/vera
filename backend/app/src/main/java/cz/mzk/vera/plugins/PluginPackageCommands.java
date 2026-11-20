package cz.mzk.vera.plugins;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.pluginhost.PluginDeclarations;
import cz.mzk.vera.pluginhost.PluginLoader;
import cz.mzk.vera.pluginhost.InstalledPlugins;
import cz.mzk.vera.pluginhost.PluginSignatures;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.RecordIds;
import cz.mzk.vera.web.Instants;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-upload; PLG-upgrade; B6 Signed.
@Service
public class PluginPackageCommands {
    private final DSLContext dsl;
    private final JdbcTemplate jdbc;
    private final HeldAccessQueries access;
    private final PluginQueries queries;
    private final PluginDeclarations declarations;
    private final PluginSignatures signatures;
    private final InstalledPlugins installed;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;

    public PluginPackageCommands(DSLContext dsl, JdbcTemplate jdbc, HeldAccessQueries access,
            PluginQueries queries, PluginDeclarations declarations, PluginSignatures signatures,
            InstalledPlugins installed, EventRecorder events, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.jdbc = jdbc;
        this.access = access;
        this.queries = queries;
        this.declarations = declarations;
        this.signatures = signatures;
        this.installed = installed;
        this.events = events;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    public ActResult upload(Caller caller, String fileName, String implementationId, byte[] jar) {
        if (!mayUpload(caller)) {
            return ActResult.refused(403, "You may not upload plugin code", "forbidden");
        }
        jdbc.update("DELETE FROM plugin_uploads WHERE uploaded_at <= ?",
                OffsetDateTime.ofInstant(clock.instant().minusSeconds(86_400), ZoneOffset.UTC));
        if (jar == null || jar.length == 0) {
            return ActResult.refused(422, "Choose a plugin package", "plugin.package_missing");
        }
        if (fileName == null || !fileName.toLowerCase(java.util.Locale.ROOT).endsWith(".jar")) {
            return ActResult.refused(422, "A plugin comes as a .jar package", "plugin.not_a_package");
        }
        String signer;
        try {
            signer = signatures.verify(jar);
        } catch (SecurityException exception) {
            return ActResult.refused(422, exception.getMessage(), "plugin.package_missing");
        }
        JsonNode descriptor;
        try {
            descriptor = declarations.read(jar);
        } catch (IllegalArgumentException exception) {
            String code = exception.getMessage().contains("no META-INF")
                    ? "plugin.no_descriptor" : "plugin.not_a_package";
            return ActResult.refused(422, "VERA found no plugin descriptor in it", code);
        }
        String descriptorId = descriptor.path("implementation").asString();
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID.eq(descriptorId)).fetchOne();
        if (implementationId != null && !implementationId.isBlank()
                && (implementation == null || !implementation.get(PLUGIN_IMPLEMENTATIONS.ID).equals(implementationId))) {
            return ActResult.refused(422, "That is a package of another implementation",
                    "plugin.other_implementation");
        }
        JsonNode versions = implementation == null ? json.createArrayNode()
                : json.readTree(implementation.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
        String version = descriptor.path("version").asString();
        if (hasVersion(versions, version)) {
            return ActResult.refused(409, "Version " + version + " is installed already", "plugin.version_installed");
        }
        JsonNode current = versions.isEmpty() ? null : versions.get(0);
        JsonNode versionEntry = versionEntry(descriptor, signer);
        Map<String, Object> difference = current == null ? null : difference(current, versionEntry);
        String id = RecordIds.next("up", dsl.selectFrom(org.jooq.impl.DSL.table("plugin_uploads"))
                .fetch(r -> r.get("id", String.class)));
        String sha;
        try {
            sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(jar));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
        Map<String, Object> answer = uploadAnswer(id, fileName, descriptor, versionEntry,
                implementation, current, difference);
        jdbc.update("INSERT INTO plugin_uploads(id,file_name,uploaded_by,uploaded_at,sha256,package,jar) "
                        + "VALUES (?,?,?,?,?,?::jsonb,?)",
                id, fileName, caller.userId(), OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC), sha,
                json.writeValueAsString(answer), jar);
        return ActResult.ok(answer);
    }

    @Transactional
    public ActResult install(Caller caller, String uploadId) {
        if (!mayUpload(caller)) {
            return ActResult.refused(403, "You may not upload plugin code", "forbidden");
        }
        Map<String, Object> row = jdbc.query("SELECT file_name,package::text,jar,sha256,uploaded_by "
                + "FROM plugin_uploads WHERE id=? AND uploaded_at > ?", (result, index) -> {
                    Map<String, Object> value = new LinkedHashMap<>();
                    value.put("fileName", result.getString(1));
                    value.put("package", json.readTree(result.getString(2)));
                    value.put("jar", result.getBytes(3));
                    value.put("sha", result.getString(4));
                    value.put("uploadedBy", result.getString(5));
                    return value;
                }, uploadId, OffsetDateTime.ofInstant(clock.instant().minusSeconds(86_400), ZoneOffset.UTC))
                .stream().findFirst().orElse(null);
        if (row == null) {
            return ActResult.refused(404, "No such upload; upload the package again", "not_found");
        }
        JsonNode answer = (JsonNode) row.get("package");
        String implementationId = answer.path("implementationId").isNull() ? null
                : answer.path("implementationId").asString();
        String descriptorId = answer.path("descriptorId").asString();
        byte[] jar = (byte[]) row.get("jar");
        JsonNode descriptor = declarations.read(jar);
        try {
            PluginLoader.LoadedPlugin loaded = installed.install(jar);
            if (!loaded.descriptorId().equals(descriptorId)) {
                throw new IllegalArgumentException("Package descriptor changed during installation.");
            }
            if (implementationId == null) {
                implementationId = RecordIds.next("pt", dsl.select(PLUGIN_IMPLEMENTATIONS.ID)
                        .from(PLUGIN_IMPLEMENTATIONS).fetch(PLUGIN_IMPLEMENTATIONS.ID));
                dsl.insertInto(PLUGIN_IMPLEMENTATIONS)
                        .set(PLUGIN_IMPLEMENTATIONS.ID, implementationId)
                        .set(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID, descriptorId)
                        .set(PLUGIN_IMPLEMENTATIONS.NAME, answer.path("name").asString())
                        .set(PLUGIN_IMPLEMENTATIONS.KIND, answer.path("kind").asString())
                        .set(PLUGIN_IMPLEMENTATIONS.DESCRIPTION, answer.path("description").asString())
                        .set(PLUGIN_IMPLEMENTATIONS.POSITION, dsl.select(org.jooq.impl.DSL.coalesce(
                                org.jooq.impl.DSL.max(PLUGIN_IMPLEMENTATIONS.POSITION), -1).add(1))
                                .from(PLUGIN_IMPLEMENTATIONS).fetchOne(0, int.class))
                        .set(PLUGIN_IMPLEMENTATIONS.VERSIONS, JSONB.valueOf("[]"))
                        .execute();
            }
            jdbc.update("INSERT INTO plugin_packages(implementation_id,version,sha256,jar,signer) VALUES (?,?,?,?,?)",
                    implementationId, answer.path("version").path("version").asString(), row.get("sha"), jar,
                    answer.path("version").path("signer").asString());
            Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                    .where(PLUGIN_IMPLEMENTATIONS.ID.eq(implementationId)).fetchOne();
            JsonNode prior = json.readTree(implementation.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
            List<JsonNode> versions = new ArrayList<>();
            versions.add(installedVersion(answer.path("version"), caller.userId()));
            prior.forEach(versions::add);
            dsl.update(PLUGIN_IMPLEMENTATIONS).set(PLUGIN_IMPLEMENTATIONS.VERSIONS,
                    JSONB.valueOf(json.writeValueAsString(versions)))
                    .where(PLUGIN_IMPLEMENTATIONS.ID.eq(implementationId)).execute();
        } catch (IllegalArgumentException exception) {
            return ActResult.refused(422, "Plugin declarations do not match its implementation", "plugin.no_descriptor");
        }
        jdbc.update("DELETE FROM plugin_uploads WHERE id=?", uploadId);
        events.recordAct(EventCode.PLUGIN_UPLOADED, "plugin", descriptorId, caller,
                List.of(EventChanges.change("version", null, answer.path("version").path("version").asString())));
        String installedId = implementationId;
        return ActResult.ok(queries.index(caller.userId()).get("implementations") instanceof List<?> values
                ? values.stream().filter(value -> ((Map<?, ?>) value).get("id").equals(installedId))
                        .findFirst().orElseThrow() : Map.of());
    }

    // INST-first-install: a shipped package, verified as an upload is, installed with nobody acting.
    @Transactional
    public String installTrustedPackage(String fileName, byte[] jar) {
        if (jar == null || jar.length == 0 || fileName == null || !fileName.endsWith(".jar")) {
            throw new IllegalArgumentException("Invalid shipped plugin package: " + fileName);
        }
        String signer = signatures.verify(jar);
        JsonNode descriptor = declarations.read(jar);
        String descriptorId = descriptor.path("implementation").asString();
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID.eq(descriptorId)).fetchOne();
        JsonNode versions = implementation == null ? json.createArrayNode()
                : json.readTree(implementation.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
        String version = descriptor.path("version").asString();
        if (hasVersion(versions, version)) return implementation.get(PLUGIN_IMPLEMENTATIONS.ID);
        PluginLoader.LoadedPlugin loaded = installed.install(jar);
        if (!loaded.descriptorId().equals(descriptorId) || !loaded.version().equals(version)) {
            throw new IllegalArgumentException("Shipped plugin package does not match its descriptor: " + fileName);
        }
        String implementationId;
        if (implementation == null) {
            implementationId = RecordIds.next("pt", dsl.select(PLUGIN_IMPLEMENTATIONS.ID)
                    .from(PLUGIN_IMPLEMENTATIONS).fetch(PLUGIN_IMPLEMENTATIONS.ID));
            dsl.insertInto(PLUGIN_IMPLEMENTATIONS).set(PLUGIN_IMPLEMENTATIONS.ID, implementationId)
                    .set(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID, descriptorId)
                    // The descriptor names neither; the loaded class and its kind interface do.
                    .set(PLUGIN_IMPLEMENTATIONS.NAME, loaded.implementation().getClass().getSimpleName())
                    .set(PLUGIN_IMPLEMENTATIONS.KIND, loaded.kind().getSimpleName())
                    .set(PLUGIN_IMPLEMENTATIONS.DESCRIPTION, "")
                    .set(PLUGIN_IMPLEMENTATIONS.POSITION, dsl.select(org.jooq.impl.DSL.coalesce(
                            org.jooq.impl.DSL.max(PLUGIN_IMPLEMENTATIONS.POSITION), -1).add(1))
                            .from(PLUGIN_IMPLEMENTATIONS).fetchOne(0, int.class))
                    .set(PLUGIN_IMPLEMENTATIONS.VERSIONS, JSONB.valueOf("[]")).execute();
            implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                    .where(PLUGIN_IMPLEMENTATIONS.ID.eq(implementationId)).fetchOne();
            versions = json.createArrayNode();
        } else {
            implementationId = implementation.get(PLUGIN_IMPLEMENTATIONS.ID);
        }
        String sha;
        try {
            sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(jar));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
        jdbc.update("INSERT INTO plugin_packages(implementation_id,version,sha256,jar,signer) VALUES (?,?,?,?,?)",
                implementationId, version, sha, jar, signer);
        List<JsonNode> updated = new ArrayList<>();
        updated.add(installedVersion(versionEntry(descriptor, signer), null));
        versions.forEach(updated::add);
        dsl.update(PLUGIN_IMPLEMENTATIONS).set(PLUGIN_IMPLEMENTATIONS.VERSIONS,
                JSONB.valueOf(json.writeValueAsString(updated)))
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(implementationId)).execute();
        return implementationId;
    }

    public ActResult upgradeRead(Caller caller, String instanceId) {
        if (!Permissions.hasPermission(access.heldBy(caller.userId()).grants(), "plugin.configure")) {
            return ActResult.refused(403, "You may not configure plugins", "forbidden");
        }
        Record instance = dsl.selectFrom(PLUGIN_INSTANCES).where(PLUGIN_INSTANCES.ID.eq(instanceId))
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse()).fetchOne();
        if (instance == null) return ActResult.unknown("plugin instance");
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(instance.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID))).fetchOne();
        JsonNode versions = json.readTree(implementation.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
        JsonNode current = findVersion(versions, instance.get(PLUGIN_INSTANCES.VERSION));
        JsonNode target = newestRunnable(versions);
        if (target == null || compareVersion(target.path("version").asString(),
                instance.get(PLUGIN_INSTANCES.VERSION)) <= 0) {
            return ActResult.refused(409, "It runs the newest version VERA can run", "plugin.up_to_date");
        }
        Map<String, Object> difference = difference(current, target);
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("fromVersion", instance.get(PLUGIN_INSTANCES.VERSION));
        answer.put("toVersion", target.path("version").asString());
        answer.put("difference", difference);
        answer.put("coveredApprovalCount", coveredApprovalCount(instance.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID),
                retiredNames(current.path("declares"), target.path("declares"))));
        return ActResult.ok(answer);
    }

    @Transactional
    public ActResult upgrade(Caller caller, String instanceId) {
        ActResult preview = upgradeRead(caller, instanceId);
        if (preview.detail() != null) return preview;
        Record instance = dsl.selectFrom(PLUGIN_INSTANCES).where(PLUGIN_INSTANCES.ID.eq(instanceId))
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse()).fetchOne();
        Record implementation = dsl.selectFrom(PLUGIN_IMPLEMENTATIONS)
                .where(PLUGIN_IMPLEMENTATIONS.ID.eq(instance.get(PLUGIN_INSTANCES.IMPLEMENTATION_ID))).fetchOne();
        String targetVersion = (String) ((Map<?, ?>) preview.body()).get("toVersion");
        JsonNode versions = json.readTree(implementation.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
        JsonNode target = findVersion(versions, targetVersion);
        byte[] jar = jdbc.query("SELECT jar FROM plugin_packages WHERE implementation_id=? AND version=?",
                result -> result.next() ? result.getBytes(1) : null,
                implementation.get(PLUGIN_IMPLEMENTATIONS.ID), targetVersion);
        if (jar == null) {
            return ActResult.refused(409, "VERA cannot run this plugin version", "plugin.contract");
        }
        PluginLoader.LoadedPlugin loaded = installed.find(implementation.get(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID),
                targetVersion);
        if (loaded == null) {
            try {
                loaded = installed.install(jar);
            } catch (IllegalArgumentException exception) {
                return ActResult.refused(409, "VERA cannot run this plugin version", "plugin.contract");
            }
        }
        if (!loaded.version().equals(targetVersion)) {
            return ActResult.refused(409, "Plugin package version does not match its declaration",
                    "plugin.contract");
        }
        JsonNode configuration = json.readTree(instance.get(PLUGIN_INSTANCES.CONFIGURATION).data());
        List<String> configKeys = strings(target.path("configFields"), "key");
        Map<String, Object> keptConfiguration = new LinkedHashMap<>();
        configuration.properties().forEach(property -> {
            if (configKeys.contains(property.getKey())) {
                keptConfiguration.put(property.getKey(), property.getValue().asString());
            }
        });
        JsonNode policy = upgradePolicy(instance.get(PLUGIN_INSTANCES.POLICY), target.path("declares"));
        dsl.update(PLUGIN_INSTANCES)
                .set(PLUGIN_INSTANCES.VERSION, targetVersion)
                .set(PLUGIN_INSTANCES.CONFIGURATION, JSONB.valueOf(json.writeValueAsString(keptConfiguration)))
                .set(PLUGIN_INSTANCES.POLICY, JSONB.valueOf(json.writeValueAsString(policy)))
                .where(PLUGIN_INSTANCES.ID.eq(instanceId)).execute();
        events.recordAct(EventCode.PLUGIN_INSTANCE_UPGRADED, "plugin_instance", instanceId, caller,
                List.of(EventChanges.change("version", instance.get(PLUGIN_INSTANCES.VERSION), targetVersion)));
        return ActResult.ok(queries.detail(instanceId, caller.userId()));
    }

    private JsonNode newestRunnable(JsonNode versions) {
        for (JsonNode version : versions) {
            if (version.path("contractVersion").asString().startsWith("1.")) return version;
        }
        return null;
    }

    private JsonNode findVersion(JsonNode versions, String version) {
        for (JsonNode candidate : versions) {
            if (candidate.path("version").asString().equals(version)) return candidate;
        }
        return versions.isEmpty() ? json.createObjectNode() : versions.get(0);
    }

    private int compareVersion(String first, String second) {
        String[] a = first.split("\\.");
        String[] b = second.split("\\.");
        for (int index = 0; index < Math.min(a.length, b.length); index++) {
            int compared = Integer.compare(Integer.parseInt(a[index]), Integer.parseInt(b[index]));
            if (compared != 0) return compared;
        }
        return Integer.compare(a.length, b.length);
    }

    private int coveredApprovalCount(String implementationId, List<Map<String, Object>> retired) {
        List<String> rules = retired.stream().filter(item -> "rule".equals(item.get("kind")))
                .map(item -> (String) item.get("name")).toList();
        if (rules.isEmpty()) return 0;
        String placeholders = String.join(",", java.util.Collections.nCopies(rules.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(implementationId);
        args.addAll(rules);
        Integer count = jdbc.queryForObject("SELECT count(DISTINCT d.key) FROM iteration_defects d "
                + "JOIN iteration_verdicts v ON v.iteration_id=d.iteration_id AND v.verdict='Approved' "
                + "AND d.key=ANY(v.defect_keys) JOIN plugin_instances pi ON pi.id=d.instance_id "
                + "WHERE pi.implementation_id=? AND d.rule_code IN (" + placeholders + ")", Integer.class,
                args.toArray());
        return count == null ? 0 : count;
    }

    private JsonNode upgradePolicy(org.jooq.JSONB oldPolicy, JsonNode declares) {
        JsonNode old = oldPolicy == null ? json.createObjectNode() : json.readTree(oldPolicy.data());
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> tiers = new ArrayList<>();
        Map<String, Integer> oldTiers = new LinkedHashMap<>();
        old.path("tiers").forEach(value -> oldTiers.put(value.path("key").asString(), value.path("tier").asInt()));
        declares.path("properties").forEach(value -> {
            String key = value.path("key").asString();
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", key);
            item.put("tier", oldTiers.getOrDefault(key, value.path("tier").asInt()));
            tiers.add(item);
        });
        result.put("tiers", tiers);
        List<String> copyStates = new ArrayList<>();
        declares.path("rawStates").forEach(value -> {
            if (value.path("isExistingCopy").asBoolean()
                    && old.path("copyStates").toString().contains(value.path("raw").asString())) {
                copyStates.add(value.path("raw").asString());
            }
        });
        result.put("copyStates", copyStates);
        result.put("agent", json.treeToValue(declares.path("agent"), Object.class));
        return json.valueToTree(result);
    }

    private boolean mayUpload(Caller caller) {
        return Permissions.hasPermission(access.heldBy(caller.userId()).grants(), "plugin.upload_code");
    }

    private JsonNode versionEntry(JsonNode descriptor, String signer) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("version", descriptor.path("version").asString());
        value.put("contractVersion", descriptor.path("contractVersion").asString());
        value.put("signer", signer);
        value.put("triggers", json.treeToValue(descriptor.path("triggers"), Object.class));
        value.put("declares", json.treeToValue(descriptor.path("declares"), Object.class));
        value.put("configFields", json.treeToValue(descriptor.path("configFields"), Object.class));
        return json.valueToTree(value);
    }

    private Map<String, Object> uploadAnswer(String id, String fileName, JsonNode descriptor, JsonNode version,
            Record implementation, JsonNode current, Map<String, Object> difference) {
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("descriptorId", descriptor.path("implementation").asString());
        answer.put("name", implementation == null ? descriptor.path("name").asString()
                : implementation.get(PLUGIN_IMPLEMENTATIONS.NAME));
        answer.put("kind", implementation == null ? descriptor.path("kind").asString()
                : implementation.get(PLUGIN_IMPLEMENTATIONS.KIND));
        answer.put("description", implementation == null ? descriptor.path("description").asString()
                : implementation.get(PLUGIN_IMPLEMENTATIONS.DESCRIPTION));
        answer.put("version", json.treeToValue(version, Object.class));
        answer.put("implementationId", implementation == null ? null : implementation.get(PLUGIN_IMPLEMENTATIONS.ID));
        answer.put("currentVersion", current == null ? null : current.path("version").asString());
        answer.put("difference", difference);
        answer.put("isRunnable", version.path("contractVersion").asString().startsWith("1."));
        answer.put("id", id);
        answer.put("fileName", fileName);
        return answer;
    }

    private JsonNode installedVersion(JsonNode version, String userId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("version", version.path("version").asString());
        result.put("contractVersion", version.path("contractVersion").asString());
        result.put("signer", version.path("signer").asString());
        result.put("installedAt", clock.instant().atOffset(ZoneOffset.UTC).toLocalDate().toString());
        result.put("installedBy", userId);
        result.put("triggers", json.treeToValue(version.path("triggers"), Object.class));
        result.put("declares", json.treeToValue(version.path("declares"), Object.class));
        result.put("configFields", json.treeToValue(version.path("configFields"), Object.class));
        return json.valueToTree(result);
    }

    private Map<String, Object> difference(JsonNode previous, JsonNode next) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> oldNames = declaredNames(previous.path("declares"));
        List<Map<String, Object>> newNames = declaredNames(next.path("declares"));
        List<Map<String, Object>> added = newNames.stream().filter(item -> !hasName(oldNames, item)).toList();
        List<Map<String, Object>> retired = oldNames.stream().filter(item -> !hasName(newNames, item)).toList();
        result.put("added", added);
        result.put("retired", retired);
        List<String> oldKeys = strings(previous.path("configFields"), "key");
        List<String> newKeys = strings(next.path("configFields"), "key");
        result.put("configAdded", newKeys.stream().filter(key -> !oldKeys.contains(key)).toList());
        result.put("configDropped", oldKeys.stream().filter(key -> !newKeys.contains(key)).toList());
        return result;
    }

    private List<Map<String, Object>> declaredNames(JsonNode declares) {
        List<Map<String, Object>> names = new ArrayList<>();
        for (String field : List.of("rules", "properties", "rawStates", "identifierTypes")) {
            String kind = switch (field) {
                case "rules" -> "rule";
                case "properties" -> "property";
                case "rawStates" -> "rawState";
                default -> "identifierType";
            };
            declares.path(field).forEach(item -> {
                Map<String, Object> named = new LinkedHashMap<>();
                named.put("kind", kind);
                String name = item.path(switch (field) {
                    case "rules" -> "code";
                    case "properties" -> "key";
                    case "rawStates" -> "raw";
                    default -> "";
                }).asString();
                if (field.equals("identifierTypes")) name = item.asString();
                named.put("name", name);
                named.put("label", item.path("label").isString() ? item.path("label").asString() : null);
                names.add(named);
            });
        }
        return names;
    }

    private boolean hasName(List<Map<String, Object>> values, Map<String, Object> item) {
        return values.stream().anyMatch(value -> Objects.equals(value.get("kind"), item.get("kind"))
                && Objects.equals(value.get("name"), item.get("name")));
    }

    private List<Map<String, Object>> retiredNames(JsonNode previous, JsonNode next) {
        List<Map<String, Object>> oldNames = declaredNames(previous);
        List<Map<String, Object>> newNames = declaredNames(next);
        return oldNames.stream().filter(item -> !hasName(newNames, item)).toList();
    }

    private List<String> strings(JsonNode array, String key) {
        List<String> result = new ArrayList<>();
        array.forEach(item -> result.add(item.path(key).asString()));
        return result;
    }

    private boolean hasVersion(JsonNode versions, String version) {
        for (JsonNode installed : versions) {
            if (installed.path("version").asString().equals(version)) {
                return true;
            }
        }
        return false;
    }
}

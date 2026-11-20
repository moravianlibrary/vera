package cz.mzk.vera.installation;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.ROLES;

import cz.mzk.vera.access.AccessUserCommands;
import cz.mzk.vera.login.LocalPasswordStore;
import cz.mzk.vera.login.Passwords;
import cz.mzk.vera.plugins.PluginPackageCommands;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.impl.DSL;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// INST-first-install. Applies the installation once under a database-wide lock.
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class InstallationSetup implements ApplicationRunner {
    private final DSLContext dsl;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final JsonMapper json;
    private final InstallationCollectionsWriter collections;
    private final PluginPackageCommands packages;
    private final AccessUserCommands users;
    private final LocalPasswordStore localPasswords;
    private final Passwords passwords;
    private final Clock clock;
    private final boolean enabled;
    private final String role;
    private final Path seed;
    private final Path plugins;
    private final String email;
    private final String password;

    public InstallationSetup(DSLContext dsl, JdbcTemplate jdbc, TransactionTemplate transactions, JsonMapper json,
            InstallationCollectionsWriter collections, PluginPackageCommands packages, AccessUserCommands users,
            LocalPasswordStore localPasswords, Passwords passwords, Clock clock,
            @Value("${vera.installation.enabled:true}") boolean enabled,
            @Value("${vera.role:${VERA_ROLE:all}}") String role,
            @Value("${vera.installation.seed:/app/installation.json}") String seed,
            @Value("${vera.installation.plugins:/app/plugins}") String plugins,
            @Value("${VERA_FIRST_ADMIN_EMAIL:}") String email,
            @Value("${VERA_FIRST_ADMIN_PASSWORD:}") String password) {
        this.dsl = dsl;
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.json = json;
        this.collections = collections;
        this.packages = packages;
        this.users = users;
        this.localPasswords = localPasswords;
        this.passwords = passwords;
        this.clock = clock;
        this.enabled = enabled;
        this.role = role;
        this.seed = Path.of(seed);
        this.plugins = Path.of(plugins);
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (!enabled || !List.of("api", "all").contains(role)) return;
        transactions.executeWithoutResult(status -> {
            jdbc.execute("SELECT pg_advisory_xact_lock(731942110)");
            if (dsl.fetchExists(dsl.selectOne().from(ROLES))) return;
            if (email.isBlank() || password.isBlank()) {
                throw new IllegalStateException("VERA_FIRST_ADMIN_EMAIL and VERA_FIRST_ADMIN_PASSWORD are required for an empty database");
            }
            JsonNode data;
            try {
                data = json.readTree(Files.readString(seed));
            } catch (Exception exception) {
                throw new IllegalStateException("Cannot read installation seed " + seed, exception);
            }
            if (password.length() < localPasswordMinimum(data)) {
                throw new IllegalStateException("VERA_FIRST_ADMIN_PASSWORD must meet the Local accounts password_min");
            }
            collections.write(dsl, data);
            installPackages(data);
            var created = users.localAccount(null, new AccessUserCommands.LocalAccount(
                    "Administrator", email, email, List.of("admin")));
            if (created.detail() != null) throw new IllegalStateException(created.detail());
            String instance = dsl.select(PLUGIN_INSTANCES.ID).from(PLUGIN_INSTANCES)
                    .join(PLUGIN_IMPLEMENTATIONS).on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                    .where(PLUGIN_IMPLEMENTATIONS.NAME.eq("LocalAccounts")).fetchOne(PLUGIN_INSTANCES.ID);
            if (instance == null) throw new IllegalStateException("The Local accounts instance was not installed");
            localPasswords.save(instance, email, passwords.hash(password));
            recordInstaller(instance);
        });
    }

    // The installation is done on the first administrator's behalf: the shipped versions and instances
    // name them as who installed and created them, as an administrator's upload would.
    private void recordInstaller(String localAccountsInstance) {
        String adminId = jdbc.queryForObject(
                "SELECT user_id FROM user_identities WHERE instance_id = ? AND external_id = ?",
                String.class, localAccountsInstance, email);
        dsl.update(PLUGIN_INSTANCES).set(PLUGIN_INSTANCES.CREATED_BY, adminId)
                .where(PLUGIN_INSTANCES.CREATED_BY.isNull()).execute();
        for (var implementation : dsl.selectFrom(PLUGIN_IMPLEMENTATIONS).fetch()) {
            JsonNode versions = json.readTree(implementation.getVersions().data());
            for (JsonNode version : versions) {
                if (version.path("installedBy").isNull() || version.path("installedBy").isMissingNode()) {
                    ((tools.jackson.databind.node.ObjectNode) version).put("installedBy", adminId);
                }
            }
            dsl.update(PLUGIN_IMPLEMENTATIONS)
                    .set(PLUGIN_IMPLEMENTATIONS.VERSIONS, JSONB.valueOf(json.writeValueAsString(versions)))
                    .where(PLUGIN_IMPLEMENTATIONS.ID.eq(implementation.getId())).execute();
        }
    }

    private String packageVersion(String fileName, String packageName) {
        return fileName.substring(packageName.length() + 1, fileName.length() - 4);
    }

    private int compareVersions(String left, String right) {
        String[] leftParts = left.split("\\.");
        String[] rightParts = right.split("\\.");
        for (int i = 0; i < Math.max(leftParts.length, rightParts.length); i++) {
            int leftPart = i < leftParts.length ? Integer.parseInt(leftParts[i]) : 0;
            int rightPart = i < rightParts.length ? Integer.parseInt(rightParts[i]) : 0;
            int compared = Integer.compare(leftPart, rightPart);
            if (compared != 0) return compared;
        }
        return 0;
    }

    private int localPasswordMinimum(JsonNode seedData) {
        for (JsonNode plugin : seedData.path("shippedPlugins")) {
            if (plugin.path("package").asString().equals("local-accounts")) {
                return plugin.path("instances").path(0).path("configuration").path("password_min").asInt(12);
            }
        }
        return 12;
    }

    private void installPackages(JsonNode seedData) {
        int position = 0;
        for (JsonNode group : seedData.path("shippedPlugins")) {
            String packageName = group.path("package").asString();
            Path jar;
            try (var files = Files.list(plugins)) {
                jar = files.filter(path -> path.getFileName().toString().matches(
                                java.util.regex.Pattern.quote(packageName) + "-[0-9]+(\\.[0-9]+)*\\.jar"))
                        .max(Comparator.comparing(path -> path.getFileName().toString(),
                                (left, right) -> compareVersions(packageVersion(left, packageName), packageVersion(right, packageName))))
                        .orElseThrow(() -> new IllegalStateException("No shipped plugin package found: " + packageName));
            } catch (java.io.IOException exception) {
                throw new IllegalStateException("Cannot read shipped plugin packages from " + plugins, exception);
            }
            String implementationId;
            try {
                implementationId = packages.installTrustedPackage(jar.getFileName().toString(), Files.readAllBytes(jar));
            } catch (java.io.IOException exception) {
                throw new IllegalStateException("Cannot read shipped plugin package " + jar, exception);
            } catch (RuntimeException exception) {
                throw new IllegalStateException("Cannot install shipped plugin package " + packageName, exception);
            }
            JsonNode implementation = json.readTree(dsl.select(PLUGIN_IMPLEMENTATIONS.VERSIONS)
                    .from(PLUGIN_IMPLEMENTATIONS).where(PLUGIN_IMPLEMENTATIONS.ID.eq(implementationId))
                    .fetchOne(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
            String version = implementation.path(0).path("version").asString();
            for (JsonNode instance : group.path("instances")) {
                dsl.insertInto(PLUGIN_INSTANCES).set(PLUGIN_INSTANCES.ID, instance.path("id").asString())
                        .set(PLUGIN_INSTANCES.NAME, instance.path("names").path("en").asString())
                        .set(PLUGIN_INSTANCES.NAMES, JSONB.valueOf(instance.path("names").toString()))
                        .set(PLUGIN_INSTANCES.IMPLEMENTATION_ID, implementationId)
                        .set(PLUGIN_INSTANCES.CONFIGURATION, JSONB.valueOf(instance.path("configuration").toString()))
                        .set(PLUGIN_INSTANCES.SETTINGS, JSONB.valueOf(instance.path("settings").toString()))
                        .set(PLUGIN_INSTANCES.VERSION, version).set(PLUGIN_INSTANCES.POLICY, (JSONB) null)
                        .set(PLUGIN_INSTANCES.LINKED_CATEGORY_ID, (String) null)
                        .set(PLUGIN_INSTANCES.IS_PREDEFINED, true).set(PLUGIN_INSTANCES.CREATED_BY, (String) null)
                        .set(PLUGIN_INSTANCES.TRIGGERS, JSONB.valueOf(instance.path("triggers").toString()))
                        .set(PLUGIN_INSTANCES.IS_ENABLED, instance.path("isEnabled").asBoolean())
                        .set(PLUGIN_INSTANCES.IS_DELETED, false)
                        .set(PLUGIN_INSTANCES.CREATED_AT, OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC))
                        .set(PLUGIN_INSTANCES.POSITION, position++).execute();
            }
        }
    }
}

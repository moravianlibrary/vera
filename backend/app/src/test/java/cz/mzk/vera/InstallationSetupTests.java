package cz.mzk.vera;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import cz.mzk.vera.access.AccessUserCommands;
import cz.mzk.vera.installation.InstallationCollectionsWriter;
import cz.mzk.vera.installation.InstallationSetup;
import cz.mzk.vera.login.LocalPasswordStore;
import cz.mzk.vera.login.Passwords;
import cz.mzk.vera.plugins.PluginPackageCommands;
import java.nio.file.Path;
import java.time.Clock;
import java.util.List;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class InstallationSetupTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

    @DynamicPropertySource
    static void trustedCertificate(DynamicPropertyRegistry properties) {
        properties.add("vera.plugins.trusted-certificates", () -> Path.of("../testing/src/main/resources/test-plugin-cert.pem")
                .toAbsolutePath().toString());
    }

    @Autowired DSLContext dsl;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate transactions;
    @Autowired JsonMapper json;
    @Autowired InstallationCollectionsWriter writer;
    @Autowired PluginPackageCommands packages;
    @Autowired AccessUserCommands users;
    @Autowired LocalPasswordStore localPasswords;
    @Autowired Passwords passwords;
    @Autowired Clock clock;
    @Autowired RestTestClient http;

    @Test
    void setsUpAnEmptyDatabaseOnceAndCreatesALogin() throws Exception {
        Path root = Path.of("..").toAbsolutePath().normalize();
        String seed = root.resolve("../seeds/installation.json").toString();
        String pluginPath = root.resolve("plugins/build/packages").toString();
        var missingAdmin = new InstallationSetup(dsl, jdbc, transactions, json, writer, packages, users,
                localPasswords, passwords, clock, true, "api", seed, pluginPath, "", "long-installation-password");
        assertThatThrownBy(() -> missingAdmin.run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("VERA_FIRST_ADMIN_EMAIL");
        PluginPackageCommands untrustedPackages = mock(PluginPackageCommands.class);
        doThrow(new SecurityException("untrusted certificate"))
                .when(untrustedPackages).installTrustedPackage(org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any());
        var rejected = new InstallationSetup(dsl, jdbc, transactions, json, writer, untrustedPackages, users,
                localPasswords, passwords, clock, true, "api", seed, pluginPath,
                "admin@example.org", "long-installation-password");
        assertThatThrownBy(() -> rejected.run(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("local-accounts");
        assertThat(dsl.selectCount().from(ROLES).fetchOne(0, int.class)).isZero();
        var setup = new InstallationSetup(dsl, jdbc, transactions, json, writer, packages, users,
                localPasswords, passwords, clock, true, "api", seed, pluginPath,
                "admin@example.org", "long-installation-password");
        setup.run(null);
        assertThat(dsl.selectCount().from(ROLES).fetchOne(0, int.class)).isEqualTo(6);
        assertThat(dsl.selectCount().from(PLUGIN_INSTANCES).fetchOne(0, int.class)).isEqualTo(2);
        assertThat(dsl.selectCount().from(PLUGIN_INSTANCES).where(PLUGIN_INSTANCES.CREATED_BY.isNull())
                .fetchOne(0, int.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM plugin_implementations "
                + "WHERE versions::text LIKE '%\"installedBy\": null%'", Integer.class)).isZero();
        int usersBefore = jdbc.queryForObject("SELECT count(*) FROM users", Integer.class);
        setup.run(null);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(usersBefore);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM plugin_packages", Integer.class)).isEqualTo(9);
        http.post().uri("/api/login/local-accounts-installation")
                .body(java.util.Map.of("username", "admin@example.org", "password", "long-installation-password"))
                .exchange().expectStatus().isNoContent();
    }
}

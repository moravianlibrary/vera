package cz.mzk.vera;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.SCHEDULES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.access.AccessUserCommands;
import cz.mzk.vera.installation.InstallationCollectionsWriter;
import cz.mzk.vera.installation.InstallationSetup;
import cz.mzk.vera.login.LocalPasswordStore;
import cz.mzk.vera.login.Passwords;
import cz.mzk.vera.plugins.PluginPackageCommands;
import cz.mzk.vera.tasks.ScheduleQueue;
import java.nio.file.Path;
import java.time.Clock;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
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
@ActiveProfiles("test")
@Testcontainers
// PLG-api-record-change, PLG-api-mirror: MZK's installation seed extends the shipped one.
class MzkInstallationTests {
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
    @Autowired ScheduleQueue queue;
    @Autowired Clock clock;

    @Test
    void installsMzksTwoCatalogsWithTheirMirrorsPaused() throws Exception {
        Path root = Path.of("..").toAbsolutePath().normalize();
        var setup = new InstallationSetup(dsl, jdbc, transactions, json, writer, packages, users,
                localPasswords, passwords, queue, clock, true, "api",
                root.resolve("../seeds/installation-mzk.json").toString(),
                root.resolve("plugins/build/packages").toString(),
                "admin@example.org", "long-installation-password");
        setup.run(null);

        assertThat(dsl.selectCount().from(ROLES).fetchOne(0, int.class)).isEqualTo(6);
        assertThat(dsl.select(PLUGIN_INSTANCES.ID).from(PLUGIN_INSTANCES).orderBy(PLUGIN_INSTANCES.POSITION)
                .fetch(PLUGIN_INSTANCES.ID)).containsExactly("local-accounts-installation",
                        "mailto-message-installation", "smtp-mailer-installation", "aleph-mzk01", "aleph-mzk03");
        assertThat(json.readTree(dsl.select(PLUGIN_INSTANCES.CONFIGURATION).from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq("aleph-mzk03")).fetchOne(PLUGIN_INSTANCES.CONFIGURATION).data())
                .path("set").asString()).isEqualTo("MZK03-VDK");

        String admin = jdbc.queryForObject("SELECT user_id FROM user_identities WHERE external_id = ?",
                String.class, "admin@example.org");
        var schedules = dsl.selectFrom(SCHEDULES).orderBy(SCHEDULES.POSITION).fetch();
        assertThat(schedules).extracting(row -> row.get(SCHEDULES.INSTANCE_ID))
                .containsExactly("aleph-mzk01", "aleph-mzk03");
        assertThat(schedules).allSatisfy(row -> {
            assertThat(row.get(SCHEDULES.CREATED_BY)).isEqualTo(admin);
            assertThat(row.get(SCHEDULES.PAUSED_BY)).isEqualTo(admin);
            assertThat(row.get(SCHEDULES.PAUSE_REASON)).isNotBlank();
            assertThat(row.get(SCHEDULES.NEXT_AT)).isNull();
        });
        assertThat(jdbc.queryForObject("SELECT count(*) FROM jobs WHERE kind = 'schedule.fire'",
                Integer.class)).isZero();
    }
}

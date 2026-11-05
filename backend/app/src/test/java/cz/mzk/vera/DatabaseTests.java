package cz.mzk.vera;

import static cz.mzk.vera.db.tables.Tables.AUDIT_OUTBOX;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import java.sql.DriverManager;
import java.util.List;
import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

// EVENT-shape; EVENT-destinations; OBS-audit-delivery.
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class DatabaseTests {
    private static final String CHANGELOG = "db/changelog/db.changelog-master.yaml";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

    @Autowired
    private DSLContext dsl;

    @Autowired
    private EventRecorder eventRecorder;

    @Autowired
    private PlatformTransactionManager transactions;

    @Test
    void changelogAppliesRollsBackAndAppliesAgain() throws Exception {
        try (var adminConnection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            adminConnection.createStatement().execute("CREATE DATABASE vera_rollback");
        }
        String rollbackUrl = postgres.getJdbcUrl().replace(postgres.getDatabaseName(), "vera_rollback");
        try (var connection = DriverManager.getConnection(
                rollbackUrl, postgres.getUsername(), postgres.getPassword())) {
            var database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (Liquibase liquibase = new Liquibase(CHANGELOG, new ClassLoaderResourceAccessor(), database)) {
                liquibase.update(new Contexts("test"), new LabelExpression());
                assertThat(connection.getMetaData().getTables(null, "public", "test_clock", null).next())
                        .isTrue();
                liquibase.rollback(7, new Contexts("test"), new LabelExpression());
                assertThat(connection.getMetaData().getTables(null, "public", "users", null).next())
                        .isFalse();
                liquibase.update(new Contexts("test"), new LabelExpression());
                assertThat(connection.getMetaData().getTables(null, "public", "users", null).next())
                        .isTrue();
            }
        }
    }

    @Test
    void recordsHistoryAndAuditIntoTheirDestinations() {
        dsl.deleteFrom(EVENTS).execute();
        dsl.deleteFrom(AUDIT_OUTBOX).execute();
        var mapper = JsonMapper.builder().build();
        eventRecorder.record(new EventInput(EventCode.REQUEST_WITHDRAWN, "request", "r-1", null,
                new EventInput.System(), "corr-1", null, mapper.createObjectNode(), null));
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(1);
        assertThat(dsl.selectFrom(EVENTS).fetchOne().getCorrelationId()).isEqualTo("corr-1");
        assertThat(dsl.selectCount().from(AUDIT_OUTBOX).fetchOne(0, int.class)).isEqualTo(1);
        dsl.deleteFrom(EVENTS).execute();
        dsl.deleteFrom(AUDIT_OUTBOX).execute();

        assertThatThrownBy(() -> eventRecorder.record(new EventInput(EventCode.REQUEST_CREATED, "request", "r-bad", null,
                new EventInput.System(), "corr-invalid", null, mapper.createObjectNode(), null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Invalid event data for request.created");
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isZero();
        assertThat(dsl.selectCount().from(AUDIT_OUTBOX).fetchOne(0, int.class)).isZero();

        var changes = mapper.createObjectNode().set("changes", mapper.createArrayNode()
                .add(mapper.createObjectNode().put("field", "suspended").putNull("from").put("to", true)));
        eventRecorder.record(new EventInput(EventCode.USER_SUSPENDED, "user", "u1", null,
                new EventInput.Undisclosed(), "corr-2", null, changes, null));
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isZero();
        assertThat(dsl.selectCount().from(AUDIT_OUTBOX).fetchOne(0, int.class)).isEqualTo(1);
        dsl.deleteFrom(AUDIT_OUTBOX).execute();

        dsl.insertInto(USERS).set(USERS.ID, "event-admin").set(USERS.NAME, "Ada")
                .set(USERS.KIND, "person").set(USERS.POSITION, 20).execute();
        dsl.insertInto(ROLES).set(ROLES.ID, "event-admin-role").set(ROLES.NAME, "Administrator")
                .set(ROLES.DESCRIPTION, "Staff").set(ROLES.IS_SHIPPED, false).set(ROLES.POSITION, 20).execute();
        dsl.insertInto(ROLES).set(ROLES.ID, "reader").set(ROLES.NAME, "Reader")
                .set(ROLES.DESCRIPTION, "Read only").set(ROLES.IS_SHIPPED, false).set(ROLES.POSITION, 21).execute();
        dsl.insertInto(USERS).set(USERS.ID, "event-reader").set(USERS.NAME, "Rory")
                .set(USERS.KIND, "person").set(USERS.POSITION, 21).execute();
        dsl.insertInto(USER_HAND_ROLES)
                .set(USER_HAND_ROLES.USER_ID, "event-admin")
                .set(USER_HAND_ROLES.ROLE_ID, "event-admin-role")
                .set(USER_HAND_ROLES.POSITION, 0).execute();
        dsl.insertInto(USER_HAND_ROLES)
                .set(USER_HAND_ROLES.USER_ID, "event-reader")
                .set(USER_HAND_ROLES.ROLE_ID, "reader")
                .set(USER_HAND_ROLES.POSITION, 0).execute();
        eventRecorder.record(new EventInput(EventCode.USER_SUSPENDED, "user", "event-admin", null,
                new EventInput.User("event-admin"), "corr-admin", null, changes, null));
        var adminRecord = mapper.readTree(dsl.selectFrom(AUDIT_OUTBOX).fetchOne().getRecord().data());
        assertThat(adminRecord.path("actor").path("name").asString()).isEqualTo("Ada");
        dsl.deleteFrom(AUDIT_OUTBOX).execute();
        eventRecorder.record(new EventInput(EventCode.USER_SUSPENDED, "user", "event-reader", null,
                new EventInput.User("event-reader"), "corr-reader", null, changes, null));
        var readerRecord = mapper.readTree(dsl.selectFrom(AUDIT_OUTBOX).fetchOne().getRecord().data());
        assertThat(readerRecord.path("actor").path("kind").asString()).isEqualTo("reader");
        assertThat(readerRecord.path("actor").has("name")).isFalse();
        assertThat(readerRecord.path("subject").path("name").isNull()).isTrue();
        dsl.deleteFrom(AUDIT_OUTBOX).execute();

        assertThatThrownBy(() -> eventRecorder.record(new EventInput(EventCode.LIST_STARTED, "list", "l1", null,
                new EventInput.System(), "corr-3", null, mapper.createObjectNode(), null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Event list.started cannot be recorded");
        assertThatThrownBy(() -> eventRecorder.record(new EventInput(EventCode.REQUEST_WITHDRAWN, "list", "l1", null,
                new EventInput.System(), "corr-3", null, mapper.createObjectNode(), null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Subject kind must match event code");
        assertThatThrownBy(() -> new TransactionTemplate(transactions).execute(status -> {
            eventRecorder.record(new EventInput(EventCode.REQUEST_WITHDRAWN, "request", "r-2", null,
                    new EventInput.System(), "corr-4", null, mapper.createObjectNode(), null));
            throw new IllegalStateException("rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isZero();
        assertThat(dsl.selectCount().from(AUDIT_OUTBOX).fetchOne(0, int.class)).isZero();
    }

    @Test
    void generatedTablesReadAndWritePeopleAndOrderedGrants() {
        dsl.insertInto(USERS).set(USERS.ID, "u1").set(USERS.NAME, "Ada")
                .set(USERS.KIND, "person").set(USERS.POSITION, 0).execute();
        dsl.insertInto(ROLES).set(ROLES.ID, "r1").set(ROLES.NAME, "Reader")
                .set(ROLES.DESCRIPTION, "Can read").set(ROLES.IS_SHIPPED, false)
                .set(ROLES.POSITION, 0).execute();
        dsl.insertInto(ROLE_GRANTS).set(ROLE_GRANTS.ROLE_ID, "r1").set(ROLE_GRANTS.POSITION, 1)
                .set(ROLE_GRANTS.PERMISSION, "request.read").set(ROLE_GRANTS.SCOPE, "any")
                .execute();
        dsl.insertInto(ROLE_GRANTS).set(ROLE_GRANTS.ROLE_ID, "r1").set(ROLE_GRANTS.POSITION, 0)
                .set(ROLE_GRANTS.PERMISSION, "user.read").set(ROLE_GRANTS.SCOPE, "any")
                .execute();

        assertThat(dsl.selectFrom(USERS).where(USERS.ID.eq("u1")).fetchOne().getName()).isEqualTo("Ada");
        assertThat(dsl.selectFrom(ROLES).where(ROLES.ID.eq("r1")).fetchOne().getName()).isEqualTo("Reader");
        List<String> permissions = dsl.select(ROLE_GRANTS.PERMISSION).from(ROLE_GRANTS)
                .where(ROLE_GRANTS.ROLE_ID.eq("r1")).orderBy(ROLE_GRANTS.POSITION)
                .fetch(ROLE_GRANTS.PERMISSION);
        assertThat(permissions).containsExactly("user.read", "request.read");
    }
}

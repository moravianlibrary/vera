package cz.mzk.vera;

import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;

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
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

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

    @Test
    void changelogAppliesRollsBackAndAppliesAgain() throws Exception {
        try (var adminConnection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            adminConnection.createStatement().execute("CREATE DATABASE vera_rollback");
        }
        String rollbackUrl = postgres.getJdbcUrl().replace(postgres.getDatabaseName(), "vera_rollback");
        try (var connection = DriverManager.getConnection(
                rollbackUrl, postgres.getUsername(), postgres.getPassword())) {
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            try (Liquibase liquibase = new Liquibase(CHANGELOG, new ClassLoaderResourceAccessor(), database)) {
                liquibase.update(new Contexts("test"), new LabelExpression());
                assertThat(connection.getMetaData().getTables(null, "public", "test_clock", null).next())
                        .isTrue();
                liquibase.rollback(4, new Contexts("test"), new LabelExpression());
                assertThat(connection.getMetaData().getTables(null, "public", "users", null).next())
                        .isFalse();
                liquibase.update(new Contexts("test"), new LabelExpression());
                assertThat(connection.getMetaData().getTables(null, "public", "users", null).next())
                        .isTrue();
            }
        }
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

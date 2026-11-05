package cz.mzk.vera.testing.seeds;

import com.zaxxer.hikari.HikariDataSource;
import cz.mzk.vera.testing.control.StoredClock;
import cz.mzk.vera.testing.fakes.identity.FakeWorld;
import cz.mzk.vera.testing.fakes.FakeRecords;
import liquibase.command.CommandScope;
import liquibase.command.core.UpdateCommandStep;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.command.core.helpers.DbUrlConnectionArgumentsCommandStep;
import liquibase.resource.ClassLoaderResourceAccessor;
import liquibase.resource.ResourceAccessor;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import org.jooq.DSLContext;
import org.jooq.SQLDialect;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class TemplateResetService {
    private static final String CHANGELOG = "db/changelog/db.changelog-master.yaml";

    private final HikariDataSource pool;
    private final SeedReader reader;
    private final SeedLoader loader;
    private final StoredClock clock;
    private final FakeWorld fakeWorld;
    private final FakeRecords fakeRecords;

    public TemplateResetService(
            HikariDataSource pool,
            SeedReader reader,
            SeedLoader loader,
            StoredClock clock,
            FakeWorld fakeWorld,
            FakeRecords fakeRecords) {
        this.pool = pool;
        this.reader = reader;
        this.loader = loader;
        this.clock = clock;
        this.fakeWorld = fakeWorld;
        this.fakeRecords = fakeRecords;
    }

    public Instant reset(String seedName, boolean frozen) {
        var seed = reader.read(seedName);
        fakeWorld.reset(seed);
        fakeRecords.reset(seed);
        String hash = reader.contentHash(seedName);
        String appDatabase = databaseName(pool.getJdbcUrl());
        String maintenanceUrl = maintenanceUrl(pool.getJdbcUrl());
        String template = "vera_tpl_" + seedName;
        String username = pool.getUsername();
        String password = pool.getPassword();

        try (Connection maintenance = DriverManager.getConnection(maintenanceUrl, username, password)) {
            if (!hash.equals(databaseComment(maintenance, template))) {
                rebuildTemplate(maintenance, maintenanceUrl, username, password, template, hash, seed);
            }
            replaceApplicationDatabase(maintenance, appDatabase, template);
        } catch (SQLException exception) {
            throw new IllegalStateException("Could not reset database from template " + template + ".", exception);
        }

        Instant now = Instant.parse(seed.path("now").asString());
        clock.reset(now, frozen);
        return now;
    }

    private void rebuildTemplate(
            Connection maintenance,
            String maintenanceUrl,
            String username,
            String password,
            String template,
            String hash,
            JsonNode seed) throws SQLException {
        String templateIdentifier = quoteIdentifier(template);
        try (Statement statement = maintenance.createStatement()) {
            if (databaseComment(maintenance, template) != null) {
                statement.execute("ALTER DATABASE " + templateIdentifier + " WITH IS_TEMPLATE false");
            }
            statement.execute("DROP DATABASE IF EXISTS " + templateIdentifier + " WITH (FORCE)");
            statement.execute("CREATE DATABASE " + templateIdentifier);
        }

        String templateUrl = databaseUrl(maintenanceUrl, template);
        applyChangelog(templateUrl, username, password);
        try (Connection seedConnection = DriverManager.getConnection(templateUrl, username, password)) {
            DSLContext target = DSL.using(seedConnection, SQLDialect.POSTGRES);
            loader.load(target, seed);
        }

        try (Statement statement = maintenance.createStatement()) {
            statement.execute("COMMENT ON DATABASE " + templateIdentifier + " IS " + quoteLiteral(hash));
            statement.execute("ALTER DATABASE " + templateIdentifier + " WITH IS_TEMPLATE true");
        }
    }

    private void applyChangelog(String templateUrl, String username, String password) {
        ClassLoaderResourceAccessor resources =
                new ClassLoaderResourceAccessor(TemplateResetService.class.getClassLoader());
        try (Connection connection = DriverManager.getConnection(templateUrl, username, password)) {
            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            new CommandScope("update")
                    .addArgumentValue(UpdateCommandStep.CHANGELOG_FILE_ARG, CHANGELOG)
                    .addArgumentValue(UpdateCommandStep.CONTEXTS_ARG, "test")
                    .addArgumentValue(DbUrlConnectionArgumentsCommandStep.URL_ARG, templateUrl)
                    .addArgumentValue(DbUrlConnectionArgumentsCommandStep.USERNAME_ARG, username)
                    .addArgumentValue(DbUrlConnectionArgumentsCommandStep.PASSWORD_ARG, password)
                    .provideDependency(Database.class, database)
                    .provideDependency(ResourceAccessor.class, resources)
                    .execute();
        } catch (Exception exception) {
            throw new IllegalStateException("Could not apply the test changelog to a seed template.", exception);
        } finally {
            try {
                resources.close();
            } catch (Exception exception) {
                throw new IllegalStateException("Could not close the test changelog resources.", exception);
            }
        }
    }

    private String databaseComment(Connection connection, String database) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = ?")) {
            statement.setString(1, database);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getString(1) : null;
            }
        }
    }

    private void replaceApplicationDatabase(Connection maintenance, String appDatabase, String template)
            throws SQLException {
        String appIdentifier = quoteIdentifier(appDatabase);
        String templateIdentifier = quoteIdentifier(template);
        pool.getHikariPoolMXBean().suspendPool();
        try (Statement statement = maintenance.createStatement()) {
            statement.execute("DROP DATABASE " + appIdentifier + " WITH (FORCE)");
            statement.execute("CREATE DATABASE " + appIdentifier + " TEMPLATE " + templateIdentifier);
        } finally {
            pool.getHikariPoolMXBean().resumePool();
            pool.getHikariPoolMXBean().softEvictConnections();
        }
    }

    private String databaseName(String jdbcUrl) {
        int pathStart = jdbcUrl.lastIndexOf('/') + 1;
        int queryStart = jdbcUrl.indexOf('?', pathStart);
        return queryStart < 0 ? jdbcUrl.substring(pathStart) : jdbcUrl.substring(pathStart, queryStart);
    }

    private String maintenanceUrl(String jdbcUrl) {
        int pathStart = jdbcUrl.lastIndexOf('/') + 1;
        int queryStart = jdbcUrl.indexOf('?', pathStart);
        String query = queryStart < 0 ? "" : jdbcUrl.substring(queryStart);
        return jdbcUrl.substring(0, pathStart) + "postgres" + query;
    }

    private String databaseUrl(String jdbcUrl, String database) {
        int pathStart = jdbcUrl.lastIndexOf('/') + 1;
        int queryStart = jdbcUrl.indexOf('?', pathStart);
        String query = queryStart < 0 ? "" : jdbcUrl.substring(queryStart);
        return jdbcUrl.substring(0, pathStart) + database + query;
    }

    private String quoteIdentifier(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private String quoteLiteral(String value) {
        return "'" + value.replace("'", "''") + "'";
    }

}

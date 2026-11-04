package cz.mzk.vera.codegen;

import java.nio.file.Path;
import java.sql.DriverManager;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.DirectoryResourceAccessor;
import org.jooq.codegen.GenerationTool;
import org.jooq.meta.jaxb.Configuration;
import org.jooq.meta.jaxb.Database;
import org.jooq.meta.jaxb.Generate;
import org.jooq.meta.jaxb.Generator;
import org.jooq.meta.jaxb.Jdbc;
import org.jooq.meta.jaxb.Target;
import org.testcontainers.postgresql.PostgreSQLContainer;

public final class GenerateJooq {
    private GenerateJooq() {}

    public static void main(String[] args) throws Exception {
        Path output = Path.of(args[0]);
        Path changelogResources = Path.of(args[1]);
        String changelog = args[2];
        try (PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18")) {
            postgres.start();
            try (var connection = DriverManager.getConnection(
                    postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
                var database = DatabaseFactory.getInstance()
                        .findCorrectDatabaseImplementation(new JdbcConnection(connection));
                try (Liquibase liquibase = new Liquibase(changelog,
                        new DirectoryResourceAccessor(changelogResources), database)) {
                    liquibase.update(new Contexts("test"), new LabelExpression());
                }
            }
            GenerationTool.generate(new Configuration()
                    .withJdbc(new Jdbc().withDriver("org.postgresql.Driver")
                            .withUrl(postgres.getJdbcUrl()).withUser(postgres.getUsername())
                            .withPassword(postgres.getPassword()))
                    .withGenerator(new Generator()
                            .withName("org.jooq.codegen.DefaultGenerator")
                            .withDatabase(new Database().withName("org.jooq.meta.postgres.PostgresDatabase")
                                    .withInputSchema("public"))
                            .withGenerate(new Generate().withPojos(false).withDaos(false)
                                    .withImplicitJoinPathsToMany(false))
                            .withTarget(new Target().withPackageName("cz.mzk.vera.db.tables")
                                    .withDirectory(output.toString()))));
        }
    }
}

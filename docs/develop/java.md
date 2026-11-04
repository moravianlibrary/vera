# Java conventions

These conventions describe the backend at step 1. Each item points to its source.

- **Modules and packages:** `backend/settings.gradle.kts` includes `plugin-api`, `domain`, `app`
  and `testing`. `backend/app/src/main/java/cz/mzk/vera/login/` is a feature package; shared HTTP
  code is under `web`, and test controls under `testing/control`. The module and package roles
  are set out in `docs/develop/backend.md` B9.
- **Feature files:** the endpoints are declared in `contract/src/endpoints.ts`; a thin controller
  per endpoint (`backend/app/src/main/java/cz/mzk/vera/login/LoginController.java`,
  `SessionController.java`) calls a query class that reads with jOOQ (`LoginQueries.java`,
  `SessionQueries.java`). Put future writes in feature command classes and persistence access in feature
  repositories, beside those files; step 1 has no login commands or repository classes yet.
- **Libraries:** `backend/gradle/libs.versions.toml` and `backend/app/build.gradle.kts` use Spring
  Boot 4.1.2, Spring Modulith 2.1.2, jOOQ 3.21.9, Liquibase, Jackson 3 and networknt's JSON
  Schema validator. `backend/testing/build.gradle.kts` adds Testcontainers PostgreSQL and
  `RestTestClient`; `backend/app/build.gradle.kts` uses Boot's `webmvc` starter.
- **Compiler and generated SQL:** `backend/build.gradle.kts` sets Java 25, `-Xlint:all` and
  `-Werror`; dependencies belong in the version catalog. `backend/app/build.gradle.kts` generates
  jOOQ classes from the Liquibase schema during compilation. Queries use those generated tables,
  as in `LoginQueries.java`, rather than SQL strings.
- **Tests:** `backend/testing/src/test/java/cz/mzk/vera/testing/control/ControlEndpointTests.java`
  shows `RestTestClient` with Testcontainers; `backend/domain/src/test/java/cz/mzk/vera/domain/cases/SharedCasesTests.java`
  runs the shared rule cases. Test and boot tasks receive `VERA_CONTRACT_DIR` and `VERA_SEEDS_DIR`
  in `backend/build.gradle.kts`.
- **Rule comments:** cite the rule ID in a short `//` comment when it explains a rule's
  implementation, as required by `docs/develop/backend.md` B3 and checked by
  `docs/tools/docs.ts`.
- **API boundaries:** `backend/app/src/main/java/cz/mzk/vera/web/ContractFilter.java` validates
  request and response bodies; `RouteCheck.java` verifies routes at startup. Keep the hand-written
  Java types aligned with `contract/openapi.json`, the generated contract from
  `contract/tools/openapi.ts`.
- **Library traps:** with Boot 4 use `spring-boot-starter-webmvc`, `tools.jackson.*` and
  `RestTestClient` with `@AutoConfigureRestTestClient`; `TestRestTemplate` is not registered by
  itself (`backend/app/build.gradle.kts`, `ControlEndpointTests.java`). Testcontainers 2 uses
  `testcontainers-postgresql` and `org.testcontainers.postgresql.PostgreSQLContainer`
  (`backend/testing/build.gradle.kts`, `ControlEndpointTests.java`). Gradle 9 tests need the
  JUnit platform launcher (`backend/domain/build.gradle.kts`). Avoid deprecated APIs because
  `backend/build.gradle.kts` treats warnings as errors. jOOQ compilation needs
  `jakarta.xml.bind-api` as `compileOnly` (`backend/testing/build.gradle.kts`).
- **Resources and time:** read packaged resources from the classpath; use the configured
  `VERA_CONTRACT_DIR` and `VERA_SEEDS_DIR` for the external `contract/` and `engine/seeds/`
  directories (`backend/build.gradle.kts`, `backend/testing/src/main/java/cz/mzk/vera/testing/seeds/SeedReader.java`).
  Inject `Clock`, do not call `Instant.now()` (`backend/app/src/main/java/cz/mzk/vera/clock/SystemClockConfiguration.java`),
  and format wire instants with milliseconds and `Z` (`backend/app/src/main/java/cz/mzk/vera/web/Instants.java`).
- **Module and database details:** feature modules use only `spring-modulith-api`
  (`backend/app/build.gradle.kts`); `domain` and `plugin-api` stay framework-free
  (`backend/domain/build.gradle.kts`, `backend/plugin-api/build.gradle.kts`). A bean another
  module may replace is an auto-configuration with `@ConditionalOnMissingBean`, never a scanned
  `@Configuration`: the system clock is one, so the `testing` module's stored clock replaces it
  (`backend/app/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`).

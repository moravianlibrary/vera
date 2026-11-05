# Java conventions

These conventions describe the backend at step 2. Each item points to its source.

- **Modules and packages:** `backend/settings.gradle.kts` includes `plugin-api`, `domain`, `app`
  and `testing`. `backend/app/src/main/java/cz/mzk/vera/login/` is a feature package; shared code
  lives in `session`, `events` and `web`, with test controls in `testing/control`. B9 describes
  the module roles in `docs/develop/backend.md`. A module's base package is its API: name modules
  plainly in `allowedDependencies`, without `@NamedInterface` on a base package or an `api`
  subpackage (`backend/app/src/main/java/cz/mzk/vera/login/package-info.java`,
  `backend/app/src/main/java/cz/mzk/vera/access/package-info.java`).
- **Feature files:** endpoints are declared in `contract/src/endpoints.ts`. Each act has a command
  class with one `@Transactional` method per act, such as `LoginCommands`, `SignUpCommands`,
  `AccessUserCommands`, `AccessRoleCommands` and `AccessGroupCommands`; reads belong in `*Queries`
  (`backend/app/src/main/java/cz/mzk/vera/login/`,
  `backend/app/src/main/java/cz/mzk/vera/access/`). Controllers stay thin: no `DSLContext`,
  generated tables, clock or randomness. They call commands and map an act's outcome to HTTP status
  (`backend/app/src/main/java/cz/mzk/vera/login/LoginController.java`,
  `backend/app/src/main/java/cz/mzk/vera/access/AccessUsersController.java`,
  `backend/app/src/main/java/cz/mzk/vera/access/ActResult.java`).
- **Transactions and events:** `EventRecorder` writes in the command's transaction and opens no
  transaction of its own. Record acts with `EventRecorder.recordAct`; build their changes with
  `EventChanges` (`backend/app/src/main/java/cz/mzk/vera/events/EventRecorder.java`,
  `backend/app/src/main/java/cz/mzk/vera/events/EventChanges.java`).
- **One of each:** hash session tokens with `SessionFilter.hashOf`; read Identity instances through
  `IdentityInstances`; held roles and grants through `HeldAccessQueries`; allocate IDs through
  `RecordIds` and `UserIds`; represent an act with `ActResult`; and use `Passwords` for password
  operations (`backend/app/src/main/java/cz/mzk/vera/session/SessionFilter.java`,
  `backend/app/src/main/java/cz/mzk/vera/login/IdentityInstances.java`,
  `backend/app/src/main/java/cz/mzk/vera/session/HeldAccessQueries.java`,
  `backend/app/src/main/java/cz/mzk/vera/session/RecordIds.java`,
  `backend/app/src/main/java/cz/mzk/vera/session/UserIds.java`,
  `backend/app/src/main/java/cz/mzk/vera/access/ActResult.java`,
  `backend/app/src/main/java/cz/mzk/vera/login/Passwords.java`).
- **Style:** use imports, never inline qualified names; put one statement on each line; every `if`
  has braces and its body on its own line, never `if (...) return ...;`; do not put several fields
  or assignments on one line. Wrap jOOQ chains with one `.set` or `.and` per line when they do not
  fit (`backend/app/src/main/java/cz/mzk/vera/access/AccessUserCommands.java`). Put a short `//`
  rule comment at the top of a class, not Javadoc, when it cites a rule
  (`backend/app/src/main/java/cz/mzk/vera/access/AccessUserCommands.java`). Keep lines to about
  110 characters. Use two-space indentation in `domain` and four spaces in `app` and `testing`
  (`backend/domain/src/main/java/cz/mzk/vera/domain/access/Access.java`,
  `backend/app/src/main/java/cz/mzk/vera/login/SignUpQueries.java`,
  `backend/testing/src/test/java/cz/mzk/vera/login/SignUpTests.java`).
- **Shared rule cases:** register each ported rule's cases in both Java and TypeScript:
  `SharedCasesTests` reads the files in `domain/cases/`, and `domain/src/cases.test.ts` runs them
  on the TypeScript side. Add a case file when a ported rule has none
  (`backend/domain/src/test/java/cz/mzk/vera/domain/cases/SharedCasesTests.java`,
  `domain/src/cases.test.ts`).
- **Libraries and compilation:** `backend/gradle/libs.versions.toml` sets Spring Boot 4.1.2,
  Spring Modulith 2.1.2 and jOOQ 3.21.9. Boot 4 uses `spring-boot-starter-webmvc` and `tools.jackson.*`;
  `RestTestClient` needs `@AutoConfigureRestTestClient`. `TestRestTemplate` is not registered by
  itself. Testcontainers 2 uses `testcontainers-postgresql` and
  `org.testcontainers.postgresql.PostgreSQLContainer`; Gradle 9 tests need the JUnit platform
  launcher. jOOQ compilation needs `jakarta.xml.bind-api` as `compileOnly`
  (`backend/app/build.gradle.kts`, `backend/testing/build.gradle.kts`,
  `backend/domain/build.gradle.kts`). Dependencies belong in the version catalog.
- **Compiler and generated SQL:** `backend/build.gradle.kts` sets Java 25, `-Xlint:all` and
  `-Werror`. Avoid deprecated APIs. `backend/app/build.gradle.kts` generates jOOQ classes from the
  Liquibase schema during compilation; queries use generated tables, not SQL strings
  (`backend/app/src/main/java/cz/mzk/vera/login/SignUpQueries.java`).
- **API boundaries:** `ContractFilter` validates request and response bodies; `RouteCheck` verifies
  routes at startup. Keep hand-written Java types aligned with `contract/openapi.json`, generated
  from `contract/tools/openapi.ts` (`backend/app/src/main/java/cz/mzk/vera/web/ContractFilter.java`,
  `backend/app/src/main/java/cz/mzk/vera/web/RouteCheck.java`).
- **Jackson and JSON Schema:** Boot 4 manages Jackson 3 (`tools.jackson.*`): use `asString()` for
  `asText()`, `stringValue()` for `textValue()`, and `properties()` for `fields()`. The networknt
  3 API uses `SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12)`, `Schema`,
  and `List<Error> validate(JsonNode)` (`backend/app/src/main/java/cz/mzk/vera/web/ContractFilter.java`,
  `backend/app/src/main/java/cz/mzk/vera/events/EventRecorder.java`).
- **Liquibase:** formatted SQL starts with `--liquibase formatted sql`. Use Liquibase's
  `CommandScope` command API, not deprecated `Liquibase` methods
  (`backend/app/src/main/resources/db/changelog/0001-people.sql`,
  `backend/testing/src/main/java/cz/mzk/vera/testing/seeds/TemplateResetService.java`).
- **Tests:** HTTP tests use `@SpringBootTest(webEnvironment = RANDOM_PORT)` and
  `@AutoConfigureRestTestClient`. `ControlEndpointTests` shows `RestTestClient` with Testcontainers;
  `SharedCasesTests` runs the shared rule cases. Test and boot tasks receive `VERA_CONTRACT_DIR` and
  `VERA_SEEDS_DIR` (`backend/testing/src/test/java/cz/mzk/vera/testing/control/ControlEndpointTests.java`,
  `backend/domain/src/test/java/cz/mzk/vera/domain/cases/SharedCasesTests.java`,
  `backend/build.gradle.kts`). Move the test clock between steps when testing a time window
  (`backend/testing/src/test/java/cz/mzk/vera/login/SignUpTests.java`). Add `.limit(1)` before
  `fetchOne` when a query can match several rows
  (`backend/app/src/main/java/cz/mzk/vera/login/SignUpQueries.java`).
- **Rule comments:** cite rule IDs in short `//` comments when they explain implementation, as
  `docs/tools/docs.ts` checks them (`backend/app/src/main/java/cz/mzk/vera/access/AccessUserCommands.java`).
- **Resources and time:** read packaged resources from the classpath; use configured
  `VERA_CONTRACT_DIR` and `VERA_SEEDS_DIR` for external `contract/` and `engine/seeds/` resources.
  Inject `Clock`, never call `Instant.now()`, and format wire instants with milliseconds and `Z`
  (`backend/build.gradle.kts`,
  `backend/testing/src/main/java/cz/mzk/vera/testing/seeds/SeedReader.java`,
  `backend/app/src/main/java/cz/mzk/vera/clock/SystemClockConfiguration.java`,
  `backend/app/src/main/java/cz/mzk/vera/web/Instants.java`).
- **Framework boundaries:** feature modules use only `spring-modulith-api`; `domain` and
  `plugin-api` stay framework-free. A replaceable bean is an auto-configuration with
  `@ConditionalOnMissingBean`, never a scanned `@Configuration`; the system clock follows this
  rule (`backend/app/build.gradle.kts`, `backend/domain/build.gradle.kts`,
  `backend/plugin-api/build.gradle.kts`,
  `backend/app/src/main/java/cz/mzk/vera/clock/SystemClockConfiguration.java`).

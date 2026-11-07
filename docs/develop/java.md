# Java conventions

These conventions describe the backend at step 4. Each item points to its source.

- **Modules and packages:** `backend/settings.gradle.kts` includes `plugin-api`, `domain`, `app`
  and `testing`. `backend/app/src/main/java/cz/mzk/vera/login/` is a feature package; shared
  code lives in `session`, `events` and `web`, with test controls in `testing/control`. The
  shared list package is `listing`; features include `documents`, `requests`, `proposals`,
  `iterations`, `validations`, `ingest` and `jobs`. B9 describes module roles in
  `docs/develop/backend.md`. A module's base package is
  its API: name modules plainly in `allowedDependencies`, without `@NamedInterface` on a base
  package or an `api` subpackage
  (`backend/app/src/main/java/cz/mzk/vera/login/package-info.java`,
  `backend/app/src/main/java/cz/mzk/vera/access/package-info.java`,
  `backend/app/src/main/java/cz/mzk/vera/documents/package-info.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/package-info.java`).
- **Feature files:** endpoints are declared in `contract/src/endpoints.ts`. Each act has a command
  class with one `@Transactional` method per act; reads belong in `*Queries`. Examples include
  `LoginCommands`, `SignUpCommands`, `AccessUserCommands`, `AccessRoleCommands`,
  `AccessGroupCommands`, `RequestDecisions` and `ProposalSubmit`. Controllers stay thin: no
  `DSLContext`, generated tables, clock or randomness. They call commands and map an act's
  outcome to HTTP status
  (`backend/app/src/main/java/cz/mzk/vera/login/LoginController.java`,
  `backend/app/src/main/java/cz/mzk/vera/access/AccessUsersController.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestsController.java`,
  `backend/app/src/main/java/cz/mzk/vera/proposals/ProposalController.java`).
- **Transactions and events:** `EventRecorder` writes in the command's transaction and opens no
  transaction of its own. Record acts with `EventRecorder.recordAct`; build their changes with
  `EventChanges` (`backend/app/src/main/java/cz/mzk/vera/events/EventRecorder.java`,
  `backend/app/src/main/java/cz/mzk/vera/events/EventChanges.java`).
- **Reads and stored values:** reads are SQL over stored values. `DocumentStates.recompute` stores
  status and recomputes it in the act's transaction; the seed loader computes it as it loads
  (`backend/app/src/main/java/cz/mzk/vera/documents/DocumentStates.java`,
  `backend/testing/src/main/java/cz/mzk/vera/testing/seeds/RecordsSeedLoader.java`). Property
  values in use are stored in `document_property_values`
  (`backend/app/src/main/java/cz/mzk/vera/documents/DocumentStates.java`). A plugin's answer at
  write time is stored, including custody placements and a classifier's suggestion. Runs ask
  again when those values need refreshing; reads do not call the plugins
  (`backend/app/src/main/java/cz/mzk/vera/requests/RequestPlacements.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestSuggestions.java`).
- **Reads across features:** a query may join another feature's tables read-only; writes go through
  the owning feature's commands. Dependencies point from `proposals` to `requests` to `documents`,
  never back. `BatchQueries` lives in `documents` to keep that direction
  (`backend/app/src/main/java/cz/mzk/vera/documents/package-info.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/package-info.java`,
  `backend/app/src/main/java/cz/mzk/vera/proposals/package-info.java`,
  `backend/app/src/main/java/cz/mzk/vera/documents/BatchQueries.java`).
- **The list layer:** `ListFilter`, `Filters.allBut`, `FacetSource`, `Facets` and `ListQuery` are
  shared by Documents and Requests; `domain/listing/Listing` supplies slices, first-appearance
  facet value order and group headers. A page uses one ordered-ids query, one grouped query per
  facet, then reads records for the slice only. Facet values follow first appearance in
  `documents.position` order. `localeCompare` ordering uses PostgreSQL's ICU collation
  (`backend/app/src/main/java/cz/mzk/vera/listing/ListFilter.java`,
  `backend/app/src/main/java/cz/mzk/vera/listing/Filters.java`,
  `backend/app/src/main/java/cz/mzk/vera/listing/FacetSource.java`,
  `backend/app/src/main/java/cz/mzk/vera/listing/Facets.java`,
  `backend/app/src/main/java/cz/mzk/vera/listing/ListQuery.java`,
  `backend/domain/src/main/java/cz/mzk/vera/domain/listing/Listing.java`,
  `backend/app/src/main/java/cz/mzk/vera/documents/DocumentQueries.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestQueries.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestGrouping.java`).
- **One of each:** hash session tokens with `SessionFilter.hashOf`; read Identity instances through
  `IdentityInstances`; held roles and grants through `HeldAccessQueries`; allocate IDs through
  `RecordIds` and `UserIds`; represent an act with `ActResult`; use `Passwords` for password
  operations. `DocumentRecords.recordsOf` reads records; `DocumentRedaction` redacts them;
  `DocumentHistory` reads their events. `RequestRows` defines a row and its asks and custodies;
  `RequestReach` defines its reach; `RequestPluginInput` builds plugin inputs. `ProposalCheck`
  checks proposed items. `RequestDecisions.insertIteration` and `approveRow` share iteration
  insertion and approval. `BatchQueries` reads batches; `Categories` provides category lineage.
  Permission and refusal names live in `DocumentCodes` and `ProposalCodes`
  (`backend/app/src/main/java/cz/mzk/vera/session/SessionFilter.java`,
  `backend/app/src/main/java/cz/mzk/vera/login/IdentityInstances.java`,
  `backend/app/src/main/java/cz/mzk/vera/session/HeldAccessQueries.java`,
  `backend/app/src/main/java/cz/mzk/vera/session/RecordIds.java`,
  `backend/app/src/main/java/cz/mzk/vera/session/UserIds.java`,
  `backend/app/src/main/java/cz/mzk/vera/access/ActResult.java`,
  `backend/app/src/main/java/cz/mzk/vera/login/Passwords.java`,
  `backend/app/src/main/java/cz/mzk/vera/documents/DocumentRecords.java`,
  `backend/app/src/main/java/cz/mzk/vera/documents/DocumentRedaction.java`,
  `backend/app/src/main/java/cz/mzk/vera/documents/DocumentHistory.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestRows.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestReach.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestPluginInput.java`,
  `backend/app/src/main/java/cz/mzk/vera/proposals/ProposalCheck.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestDecisions.java`,
  `backend/app/src/main/java/cz/mzk/vera/documents/BatchQueries.java`,
  `backend/domain/src/main/java/cz/mzk/vera/domain/categories/Categories.java`,
  `backend/app/src/main/java/cz/mzk/vera/documents/DocumentCodes.java`,
  `backend/app/src/main/java/cz/mzk/vera/proposals/ProposalCodes.java`).
- **Step 4's shared operations:** `HeldScopes.reachesIteration` is the iteration reach;
  `IterationAccess.actionableIteration` checks the current attempt and reach. `IterationCheckRun`
  calls Validation and Restriction for ingest and recheck alike. `IngestQueue.queue` writes the
  ingest job, and `RequestDecisions.insertIteration` queues it in the creating transaction
  (`backend/app/src/main/java/cz/mzk/vera/session/HeldAccessQueries.java`,
  `backend/app/src/main/java/cz/mzk/vera/iterations/IterationAccess.java`,
  `backend/app/src/main/java/cz/mzk/vera/iterations/IterationCheckRun.java`,
  `backend/app/src/main/java/cz/mzk/vera/ingest/IngestQueue.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestDecisions.java`).
- **Jobs:** `Jobs.enqueue` uses the caller's transaction. A kind is a typed `JobKind<T>`; its
  plugin calls happen in `call` outside a transaction and its writes happen in `apply`. A stale
  job writes nothing. The worker polls under `vera.jobs.poll` and reads the role once as
  `VeraRole`; tests run jobs through the controls
  (`backend/app/src/main/java/cz/mzk/vera/jobs/Jobs.java`,
  `backend/app/src/main/java/cz/mzk/vera/jobs/JobKind.java`,
  `backend/app/src/main/java/cz/mzk/vera/jobs/JobRunner.java`,
  `backend/app/src/main/java/cz/mzk/vera/jobs/JobWorker.java`,
  `backend/app/src/main/java/cz/mzk/vera/jobs/VeraRole.java`,
  `backend/app/src/main/java/cz/mzk/vera/ingest/IngestJob.java`,
  `backend/testing/src/main/java/cz/mzk/vera/testing/control/ControlController.java`).
- **The reference without an engine:** the mock's functions are held to the pure rules by the
  shared case files in `domain/cases/iterations/` and `domain/cases/validations/`
  (`frontend/src/mocks/iterations.ts`, `frontend/src/mocks/validations.ts`,
  `domain/src/iterations.ts`, `domain/src/validations.ts`,
  `domain/cases/iterations/`, `domain/cases/validations/`).
- **Fakes:** they answer from the seed as `fakes.md` says. Tests arrange a case through seed data
  (a seed patch in test resources), never by editing a row a plugin would answer again. Production
  code never names the test profile or carries a test-only header
  (`docs/develop/fakes.md`,
  `backend/testing/src/main/java/cz/mzk/vera/testing/fakes/FakeIngest.java`,
  `backend/testing/src/main/java/cz/mzk/vera/testing/seeds/SeedReader.java`,
  `backend/testing/src/test/resources/`).
- **Problems:** `ProblemShapeAdvice` writes the problem shape without an `instance`, as the
  engine does (`backend/app/src/main/java/cz/mzk/vera/web/ProblemShapeAdvice.java`).
- **Style:** use imports, never inline qualified names; put one statement on each line; every `if`
  has braces and its body on its own line. Do not write `if (...) return ...;` or put several
  fields or assignments on one line. Wrap jOOQ chains with one `.set` or `.and` per line when they
  do not fit. Put a short `//` rule comment at the top of a class, not Javadoc, when it cites a
  rule. Keep lines to about 110 characters. Use two-space indentation in `domain` and four spaces
  in `app` and `testing`
  (`backend/app/src/main/java/cz/mzk/vera/access/AccessUserCommands.java`,
  `backend/domain/src/main/java/cz/mzk/vera/domain/access/Access.java`,
  `backend/app/src/main/java/cz/mzk/vera/login/SignUpQueries.java`,
  `backend/app/src/main/java/cz/mzk/vera/requests/RequestDecisions.java`,
  `backend/testing/src/test/java/cz/mzk/vera/requests/RequestDecisionTests.java`).
- **Shared rule cases:** register each ported rule's cases in both Java and TypeScript.
  `SharedCasesTests` reads files in `domain/cases/`; `domain/src/cases.test.ts` runs them on the
  TypeScript side. Add a case file when a ported rule has none
  (`backend/domain/src/test/java/cz/mzk/vera/domain/cases/SharedCasesTests.java`,
  `domain/src/cases.test.ts`).
- **Migrations:** each migration applies to the persistent development database and its rows;
  do not add `NOT NULL` to a column the loader fills later. Sessions running side by side use
  disjoint migration number ranges
  (`backend/app/src/main/resources/db/changelog/db.changelog-master.yaml`,
  `backend/testing/src/main/java/cz/mzk/vera/testing/seeds/RecordsSeedLoader.java`).
- **Tests:** compare a recorded call list as whole bodies in one parameterized test. A refused act
  writes nothing: no row and no event. The library day is `Europe/Prague`. HTTP tests use
  `@SpringBootTest(webEnvironment = RANDOM_PORT)` and `@AutoConfigureRestTestClient`;
  `TestRestTemplate` is not registered by itself. Move the test clock between steps when testing a
  time window. Add `.limit(1)` before `fetchOne` when a query can match several rows. Test and boot
  tasks receive `VERA_CONTRACT_DIR` and `VERA_SEEDS_DIR`
  (`backend/testing/src/test/java/cz/mzk/vera/requests/RequestReadTests.java`,
  `backend/testing/src/test/java/cz/mzk/vera/requests/RequestDecisionTests.java`,
  `backend/app/src/main/java/cz/mzk/vera/proposals/ProposalSettings.java`,
  `backend/testing/src/test/java/cz/mzk/vera/testing/control/ControlEndpointTests.java`,
  `backend/testing/src/test/java/cz/mzk/vera/login/SignUpTests.java`,
  `backend/app/src/main/java/cz/mzk/vera/login/SignUpQueries.java`,
  `backend/build.gradle.kts`). `SharedCasesTests` also runs the shared rule cases
  (`backend/domain/src/test/java/cz/mzk/vera/domain/cases/SharedCasesTests.java`).
- **Rule comments:** cite rule IDs in short `//` comments when they explain implementation;
  `docs/tools/docs.ts` checks them
  (`backend/app/src/main/java/cz/mzk/vera/access/AccessUserCommands.java`).
- **Libraries and compilation:** `backend/gradle/libs.versions.toml` sets Spring Boot 4.1.2,
  Spring Modulith 2.1.2 and jOOQ 3.21.9. Boot 4 uses `spring-boot-starter-webmvc` and
  `tools.jackson.*`; `RestTestClient` needs `@AutoConfigureRestTestClient`. Testcontainers 2 uses
  `testcontainers-postgresql` and `org.testcontainers.postgresql.PostgreSQLContainer`; Gradle 9
  tests need the JUnit platform launcher. jOOQ compilation needs `jakarta.xml.bind-api` as
  `compileOnly` (`backend/app/build.gradle.kts`, `backend/testing/build.gradle.kts`,
  `backend/domain/build.gradle.kts`). Dependencies belong in the version catalog.
- **Compiler and generated SQL:** `backend/build.gradle.kts` sets Java 25, `-Xlint:all` and
  `-Werror`. Avoid deprecated APIs. `backend/app/build.gradle.kts` generates jOOQ classes from
  Liquibase during compilation; queries use generated tables, not SQL strings
  (`backend/app/src/main/java/cz/mzk/vera/documents/DocumentQueries.java`).
- **API boundaries:** `ContractFilter` validates request and response bodies; `RouteCheck`
  verifies routes at startup. Keep hand-written Java types aligned with `contract/openapi.json`,
  generated from `contract/tools/openapi.ts`
  (`backend/app/src/main/java/cz/mzk/vera/web/ContractFilter.java`,
  `backend/app/src/main/java/cz/mzk/vera/web/RouteCheck.java`).
- **Jackson and JSON Schema:** Boot 4 manages Jackson 3 (`tools.jackson.*`): use `asString()` for
  `asText()`, `stringValue()` for `textValue()`, and `properties()` for `fields()`. The networknt
  3 API uses `SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12)`, `Schema`,
  and `List<Error> validate(JsonNode)`
  (`backend/app/src/main/java/cz/mzk/vera/web/ContractFilter.java`,
  `backend/app/src/main/java/cz/mzk/vera/events/EventRecorder.java`).
- **Liquibase:** formatted SQL starts with `--liquibase formatted sql`. Use Liquibase's
  `CommandScope` command API, not deprecated `Liquibase` methods
  (`backend/app/src/main/resources/db/changelog/0001-people.sql`,
  `backend/testing/src/main/java/cz/mzk/vera/testing/seeds/TemplateResetService.java`).
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
- **Spring proxies:** a class annotated `@Transactional` is not `final`, because Spring proxies
  it with CGLIB (`backend/app/src/main/java/cz/mzk/vera/requests/BatchRetry.java`).
- **Builds:** run one Gradle build at a time per worktree. A `NoSuchFileException` or
  `EOFException` on `test-results/.../binary` means an earlier run was interrupted; delete that
  directory and rerun (`backend/build.gradle.kts`).

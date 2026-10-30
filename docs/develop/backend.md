# The Java backend

> **Proposal.** Drafted on 2026-10-30; B1, B2, B6 and where it lives settled the same day,
> the rest not yet. The backend starts once the engine runs every user journey ([engine.md](engine.md),
> step 8). Each choice below is numbered `B1`… so it can be settled, changed or rejected one at a
> time, as the engine's `E1`… were.

## What it is for

The backend is VERA in production: the engine's API, rules and jobs, on PostgreSQL, with real
plugins in place of the fakes. It is done when:
- the contract tests and the user-journey tests pass against it **unchanged**, as they pass
  against the engine ([engine.md](engine.md#tests));
- the real plugins of the [plugin catalog](plugin-catalog.md) run in it;
- it is deployed beside the old VERA, the old data is moved by hand, and the old VERA is
  switched off.

The engine stays after that: the frontend's development server, the executable spec, and the
yardstick a backend change is checked against.

What it is not: a redesign. Where the backend would like to differ from the engine, the engine
changes first, with its tests, and the backend follows.

## Shape

```mermaid
flowchart LR
  FE["frontend (static files)"] --> PROXY["reverse proxy"]
  PROXY -->|"/api"| API
  subgraph app ["one image, two roles"]
    API["api: HTTP boundary → commands, queries"]
    WORKER["worker: jobs, schedules, deliveries"]
    API --> CORE["core: rules ported from domain/, citing IDs"]
    WORKER --> CORE
    WORKER --> PLUGINS["plugins: one class loader per version"]
    API --> PLUGINS
  end
  CORE --> PG[("PostgreSQL")]
  WORKER --> PG
  PLUGINS --> OUT["catalogs, registries, Keycloak, Google, Seznam,<br/>SMTP, Slack, SFTP, MARC comparator"]
  API -. OTLP .-> OTEL["collector"]
  WORKER -. OTLP .-> OTEL
```

The layers are the engine's, one for one: the boundary checks the contract; a **command** per
act checks permission, scope and state and writes the change, its log entries and its hook
events in one transaction; a **query** per page read model; **jobs** on a clock. A file in the
engine has a counterpart in the backend under the same name, so a rule is found in both by its
ID.

## Load

VERA is small ([prod-profile.md](prod-profile.md)): 16 staff users, about 20 proposals a day per
proposer in scanner bursts of up to 35 a minute, 17 000 documents, a few hundred runs a month,
and public requests growing towards a few a day. One API process and one worker hold this with
room to spare. Nothing below is there for scale: no message broker, no cache, no search engine,
no second database.

## Proposed

### B1. Stack

Settled on 2026-10-30. Java 25 (LTS), Spring Boot 4 on virtual threads, Spring MVC, Gradle with the Kotlin DSL.

- Spring Boot for what comes with it: Actuator's health probes, RFC 9457 `ProblemDetail`
  (which the contract's problem already is), the OpenTelemetry Java agent's coverage, and
  people who know it.
- **No Spring Security.** Sessions, login and permissions are VERA's own (E14, E15, the
  [permissions](../reference/access/permissions.md)); Spring Security's session and OAuth2
  client models would have to be bent to fit, and an Identity instance is configured at runtime,
  not in application properties. A servlet filter reads the session cookie; commands check
  permissions with the ported rules. Password hashing takes `spring-security-crypto` alone
  (Argon2id).

Rejected: Quarkus (its gain is native images and start-up time, which VERA does not need);
Javalin or Helidon SE (closest to the engine's plain `Bun.serve`, but each piece Spring brings
would be written by hand).

### B2. The contract: an OpenAPI document, and the API layer by hand

Settled on 2026-10-30. The contract stays in TypeScript and stays the source. From the endpoint table
(`contract/src/endpoints.ts`), a script writes:
- `contract/openapi.json`: zod 4's `z.toJSONSchema` per schema, one operation per entry, its
  refusal codes as an extension (`x-vera-codes`), `public` and `redirects` likewise;
- the check in `make docs-check`'s manner, that the file is not stale.

The backend **does not generate code** from it. It:
1. writes its request and answer types by hand, as Java records and sealed interfaces;
2. checks every request against the document's schema at the boundary, with a JSON Schema
   validator (`networknt/json-schema-validator`), answering 400 or 422 exactly as E11 says, and
   applying the schema's defaults as zod's parse does;
3. checks every answer against the schema too, in development and tests, answering 500
   `contract.response` as the engine does; in production it logs the mismatch and answers;
4. at start-up, compares the routes it serves with the document's operations and refuses to
   start if they differ, as the engine "serves exactly the table".

Why not generate: the contract leans on what OpenAPI generators handle badly, 25 unions and
discriminated unions (a cadence, a filter, a scope), nullable against optional, defaults; and 7
refinements and transforms that JSON Schema cannot carry at all. Generated Java for those is
worse than written Java, and what keeps the two sides together is not the types but the checks:
the boundary validation above, the contract tests, and Schemathesis generating cases from the
same document. The refinements a schema cannot carry are listed in the document's descriptions
and enforced in the backend by hand, each with a test.

### B3. The rules: ported, held together by shared cases

`domain/src` is TypeScript, shared by the frontend and the engine. The backend ports what it
uses (permissions and scopes, status and the badge, schedules and cadences, value ranges,
counting and mixes, properties) to plain Java with no framework, in a `core` module.

To keep the two from drifting, the domain's tests move their cases into JSON files
(`domain/cases/*.json`: input, expected output, the rule ID), read by the Bun tests and by JUnit
alike. A rule changed in TypeScript breaks the Java build until it is ported. Java code cites rule
IDs as the engine does, and `make docs-check` reads `backend/` for cited IDs too.

### B4. PostgreSQL, with migrations

PostgreSQL 18, run by CloudNativePG in production. The schema is new; nothing of the old VERA's
is kept, and no code moves its data (decided on 2026-10-30: people move what is needed by hand).
The engine's schema files (`engine/schema/`,
one per area) are the starting point, translated once: JSON columns to `jsonb`, ISO text times to
`timestamptz`, the `CHECK` lists kept, text IDs kept (the contract's IDs are strings, and seeds
name rows by them).

From the first production deploy, E9 no longer holds: every schema change is a migration,
written by hand, reviewed, never edited once applied, with its rollback. Liquibase with SQL
changelogs, because it carries the rollback beside the change.

Data access with jOOQ, its classes generated from the migrated schema at build time: typed SQL,
joins written out, no lazy loading. Lists, facets and the overview pages are queries over indexes;
`pg_trgm` for the text filters. At 17 000 documents there is no case for a search engine; the old
VERA's reindex runs (4 000 of its 4 862 runs) go away with it.

### B5. Jobs: one table, claimed with `SKIP LOCKED`

The engine's job model, unchanged in meaning (E10): a job is due at a moment of the clock, runs
once, and each kind sets its own next attempt
([HOOK-retry](../reference/integrations/hooks.md#hook-retry)); runs show on Tasks; a job keeps the
trace context of the act that queued it.

What changes is how a job holds the database. In the engine a job runs in one transaction,
plugin calls included, which is fine for fakes that answer at once. Real plugins hang: the old
VERA's failures took minutes to hours. So a job runs in two parts:
1. **call:** outside any transaction, each plugin call with its instance's timeout;
2. **apply:** one short transaction that writes what the calls answered, or marks the run failed
   and writes nothing else.

Workers claim due jobs with `SELECT … FOR UPDATE SKIP LOCKED` and a lease, so a worker that dies
leaves its job to be claimed again. The clock is a `java.time.Clock` bean: the wall clock in
production, a stored, movable one under the test profile (B8). Schedules fall on the library's
wall clock, `Europe/Prague`, through daylight saving
([ROLE-library-day](../reference/access/roles.md#role-library-day)).

Rejected: Quartz, JobRunr, db-scheduler. Each brings its own tables and retry model, and VERA's
runs, with their items, outcomes and per-kind next attempts, would sit beside them rather than in
them.

### B6. Plugins: a plugin API, and one class loader per version

A `plugin-api` module is the plugin contract, 1.x
([PLG-contract](../reference/integrations/plugins.md#plg-contract)): one interface per kind
([PLG-kinds](../reference/integrations/plugins.md#plg-kinds)), the value types they take and
answer, and a context giving an instance its configuration, its secrets, an HTTP client, a
logger and the clock. It depends on nothing but the JDK, and its versions follow semver: a minor
version only adds.

A plugin is a JAR with `META-INF/vera-plugin.json`: the implementation, its version, the contract
version, and everything it declares ([PLG-declares](../reference/integrations/plugins.md#plg-declares)).
- **Upload** ([PLG-upload](../reference/integrations/plugins.md#plg-upload)) reads only that file,
  never runs the code, and shows what the version adds and retires. The JAR is stored in the
  database by its SHA-256.
- **Loading:** each installed version gets its own class loader, parent-last except for
  `plugin-api` and the JDK, so two versions, and two plugins' libraries, never clash.
- **Calls** go through one wrapper: the timeout, the span
  ([OBS-trace-through](../reference/integrations/observability.md#obs-trace-through)), the
  outcome *answered*, *unavailable* or *refused*, secrets passed in and never logged
  ([PLG-secrets](../reference/integrations/plugins.md#plg-secrets)).
- **The shipped implementations** of the [plugin catalog](plugin-catalog.md) are built as the same
  JARs, from `backend/plugins/`, and installed by the installation seed. They get no privilege an
  uploaded plugin would not.

**Signed** (settled on 2026-10-30). An uploaded plugin runs inside VERA with VERA's rights, so
the administrator's permission is not enough on its own:
- a plugin is signed with `jarsigner`, the JDK's own JAR signing: a Gradle task in
  `backend/plugins/`, MZK's key in CI;
- the installation's trusted certificates come from its deployment (a Helm secret), never from a
  page in VERA, so an administrator's account alone cannot add one;
- upload opens the JAR verified and refuses it unless every entry, the declarations file
  included, is signed by a trusted certificate; the signer is shown beside the version;
- an outside author's plugin is either reviewed and signed by MZK, or their certificate is added
  to the deployment.

Signing proves where a plugin came from, not that it is safe: it stops a stolen administrator
session from installing code, not a trusted signer's mistake.

### B7. Login and sessions

E14, E15 and E16 carry over as they are: the `vera_session` cookie, its SHA-256 stored, the
sliding limits, flows of 10 minutes, the return within VERA, sign-up and reset tokens stored by
hash.
- `OidcIdentity` uses the Nimbus OAuth 2.0 / OpenID Connect SDK: discovery, the authorization code
  flow with PKCE, ID token checks. One instance per provider (Keycloak, Google, Seznam), each
  configured on Plugins.
- `LocalAccounts` hashes with Argon2id; its mail goes through the Delivery channel named by
  `mail_channel`.
- Writing acts are protected by `SameSite=Lax` and by refusing a body that is not
  `application/json`, as the engine does.

### B8. Tests: the engine's tests, over HTTP

The backend is accepted by tests it did not write:

| Tests | How they reach the backend |
|---|---|
| contract | `bun test` with `VERA_API_URL` set, over HTTP |
| user journeys | Playwright: the frontend's live mode with `VITE_API_PROXY_TARGET` at the backend |
| API fuzzing | Schemathesis over `contract/openapi.json` |
| the shared rule cases (B3) | JUnit |
| the backend's own | JUnit with Testcontainers PostgreSQL: migrations, jobs, plugin loading, the real plugins against recorded answers |

For that, the backend serves the control endpoints of [engine.md](engine.md#control-endpoints)
(`/_engine/reset`, `clock`, `outbox`, `jobs/run`, `sessions`, `identity`) and loads the same seeds
from `engine/seeds/`. They live in a `testing` module, wired only under the `test` profile, and
the production image does not contain it.

It also needs the **fakes**: a fake per plugin kind, driven by the seed's data, behaving as the
engine's. They are built as plugins (B6), so loading them exercises the same path the real ones
take.

A reset per test is fast enough with PostgreSQL's template databases: the seed is loaded once
into a template, and a reset drops the database and creates it again from the template.
Tests running in parallel get one backend each, on its own database.

## What the engine has to do first

These are cheap now and expensive later. Each is a step of the engine's, not of the backend's:

1. **Contract tests over HTTP only.** Today they call `engine.fetch` in process, and some read
   `engine.db` with SQL (`engine/src/access/acts.test.ts`). The contract tests move to a package
   of their own that speaks only to `/api` and `/_engine`, at a base URL; whatever needs the
   database stays an engine test. Only the former can pass "unchanged" against the backend.
2. **The OpenAPI document** (B2), from the endpoint table, once step 3's endpoints are in, as
   E1 already plans.
3. **Rule cases as data** (B3), starting with permissions, status and schedules.
4. **The seed format written down**: a JSON Schema for a seed (E13), since a second loader will
   read it.
5. **The fakes' behaviour written down** per kind, in the engine's terms: what each answers from
   which seed data, and how it fails. The backend's fakes are written from that.
6. **The 422 body**: the field paths in `errors` named one way (JSON Pointer), so both sides
   produce the same ones. Tests compare codes and fields, never message texts.

## Repository and build

Settled on 2026-10-30. The backend lives in this repository, under `backend/`, so a change to the contract and its
backend change are one commit:

```text
backend/
  settings.gradle.kts
  plugin-api/      the plugin contract 1.x; no dependencies
  core/            the ported rules (B3); no framework
  app/             boundary, commands, queries, jobs, persistence, plugin host; api and worker roles
  testing/         control endpoints, seed loader, fakes; test profile only
  plugins/         the shipped implementations, one Gradle project each
```

`make backend`, `make backend-test`, `make backend-contract` (the contract tests against a running
backend) and `make backend-journeys` sit beside the engine's targets. A coding conventions layer
for Java is part of the conventions step ([structure](../structure.md)); until then the backend
follows the backend, API, persistence and Helm layers.

## Running it

- **One image, two roles**: `VERA_ROLE=api`, `worker`, or `all` for a small installation. The
  worker runs jobs, schedules, hook deliveries and watchlist sends; the API never waits on them.
- **A Helm chart** in `deploy/helm/vera/`: the API, the worker, the frontend's static files
  behind the proxy, CloudNativePG for PostgreSQL, migrations as a pre-upgrade hook job.
- **Telemetry**: the OpenTelemetry Java agent, logs as JSON through its Logback appender, the act,
  job or run on each record ([OBS-streams](../reference/integrations/observability.md#obs-streams)).
  The agent records more than VERA allows by default; it is configured so that no query string,
  header, cookie or SQL parameter is recorded, and a span processor drops attributes outside an
  allow-list ([OBS-who](../reference/integrations/observability.md#obs-who)). A test asserts what
  a span may hold, as the engine's `telemetry/rules.test.ts` does.
- **Configuration** by environment variables, secrets from the cluster; plugin secrets in the
  database, encrypted with a key from the environment.

## Order of work

Following the engine's steps, so each lands with tests already written:

1. **Skeleton:** the Gradle build, PostgreSQL and the first migrations, the boundary check
   against the OpenAPI document, the clock, the seed loader, `/_engine`. Passes the step-1
   contract tests.
2. **Access:** sessions, the Identity plugins with their fakes, sign-up, Users & Groups.
3. **Asking and deciding**, then **ingest and review**, **lists and projects**, **planning**,
   **machinery**: as engine steps 3 to 7, each done when its contract tests pass.
4. **Every journey passes** against the backend.
5. **The real plugins**, in the order the first installation needs them: `OidcIdentity` (MZK
   Keycloak), `LocalAccounts`, `AlephOaiCatalogAdapter`, `KrameriusRegistry`, `MarcComparator`,
   `SmtpMailer`, then the rest of the catalog.
6. **Deployment** beside the old VERA, a trial with the curators, the old data moved by hand,
   then the switch.

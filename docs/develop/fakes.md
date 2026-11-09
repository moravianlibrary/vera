# The fakes

This is the observed behavior of the mock and engine fakes, for the backend implementations
described in [backend.md](backend.md#b6-plugins-a-plugin-api-and-one-class-loader-per-version)
and [PLG-api-kinds](../reference/integrations/plugin-api.md#plg-api-kinds). “Base seed” means
`engine/seeds/base.json` extending `installation.json`; instance names and ids below are from
`base.collections.pluginInstances` (the corresponding implementation kind is in
`base.collections.pluginImplementations`). The mock fixtures are `frontend/src/mocks/fixtures/plugins.ts`.

The engine fake coverage is deliberately narrower than the plugin API: it serves Identity,
Custody, and Classifier behavior needed by Access and asking/deciding, plus the proposal read
helpers for catalog records and catalog properties. It does not run the later plugin areas listed
in [engine.md](engine.md#what-it-is-for); those are mock-only until the backend, per DEC-0022.
The engine implementation is `engine/src/records/plugins.ts`, except Identity, implemented under
`engine/src/identity/`.

## Common fault switches

`make frontend-fault MOCK_FAULT=...` writes `VITE_MOCK_FAULT` to `frontend/.env.local`
(`Makefile:52–54`; accepted values are `none`, `unavailable`, `data`, `slow`).
`frontend/src/mocks/faults.ts` installs these handlers before the normal mock handlers:

| Switch | Result and caller behavior |
|---|---|
| `unavailable` | Every API request receives HTTP 503; the API caller sees service unavailable. |
| `data` | Every path except `/session` and `/login` receives HTTP 503; session/login still work and page callers see their normal error state. |
| `slow` | Delays every API answer by 1500 ms, exposing loading states. |
| `none` | No injected fault. |

These are server-wide request faults, not per-plugin refusal codes. The engine does not use these
switches. Plugin API refusals below are the operation-specific outcomes in `plugin-api.md`.

## Catalog adapter

**Base instances:** `pi1` MZK Aleph, `pi2` NKP Aleph and `pi3` VKOL Aleph. `pt45`
XmlDumpCatalogAdapter is an installed implementation with no instance in the base seed. These
instances and implementations are in `engine/seeds/base.json:collections.pluginInstances` and
`collections.pluginImplementations`.

| Operation | Fake answer, input data, fallback |
|---|---|
| `read` | The mock reads its catalog fixture (`frontend/src/mocks/fixtures/catalog.ts`, `knownCatalogRecords`); records, units and catalog identity are fixture data. Missing record is `not_found` (`frontend/src/mocks/ways-in.ts`, `readRecordLink`). Engine proposal context returns `fakes.catalogRecords`, default `[]` (`engine/src/records/plugins.ts`, `engineProposalContext`). |
| `readLink` | Mock parses recognized catalog links/IDs from the catalog bases and fixture behavior; an unrecognized adapter/link yields `not_this_catalog` or `malformed` as the operation defines. The seed has `fakes.catalogBases` and `catalogAdapter`; the exact mock mapping for all adapters is not established. |
| `search` | Mock filters known catalog records; no external catalog is queried (`frontend/src/mocks/ways-in.ts`, `searchCatalogs`). No seed-driven engine search fake is present. |
| `changes`, `sync` | The mock-side implementation and answers for these declared operations are not established by the inspected readers. No engine implementation. |

The mock also reads `fakes.catalogRepairs` (seed comment in `contract/seed/seed.ts`) for catalog
repair values, and `fakes.catalogAdapter.name` for the adapter link name
(`frontend/src/mocks/catalog.ts`). Engine query helpers derive `waysIn` from plugin tables and
`fakes.catalogBases` (default `{}`), and catalog properties from `fakes.catalogReading` (default
source `{kind:"plugin",instanceId:"",instanceName:""}`, tier `50`), in
`engine/src/records/plugins.ts:26–92`. These are proposal query helpers, not the full adapter
operation suite. Mock refusal behavior for adapter faults beyond the declared `read`/`readLink`
codes is not established.

## Registry

**Base instances:** `pi4` MZK Kramerius and `pi5` RDCZ production (`pt2`, `pt3`).

`lookup(record, identifiers)` answers the `records` entry for every distinct registry record matching
any identifier of the record. It returns each record once, with its stored `rawState` and nullable
`link` (`domain/src/plugin-api/registry.ts`). For an existing document, read its `registryRecords`,
grouped by `instanceId`; the base seed stores these with documents (`engine/seeds/base.json`,
`collections.documents[*].registryRecords`, e.g. D1 near line 1745). The fixture identifies `pi4`
and `pi5` as registry instances (`frontend/src/mocks/fixtures/plugins.ts:73,95–141`). Registry
evidence and raw-state rules are `docs/reference/integrations/registries.md:5–44`. An absent row
means no record. For a new catalog document, use `fakes.ingest[catalogId].registryRecords`; default
is no registry records. Unknown raw states are preserved as evidence and map to Unmapped
(REG-raw-state/REG-states). The API has no refusal code (`registry.ts:3`). Thrown errors, invalid
answers and timeout are unavailable under PLG-api-outcome. `fakes.md` Common fault switches affect
mock HTTP requests only; the engine does not use them. Per-kind `faults` below makes these outcomes
reproducible in backend tests. Ingest fails and keeps the error. The mock has no ingest
implementation.

## Property source

**Base instances:** `pi6` Periodicals model and `pi7` Monographs model (`pt4`); additional shipped
implementations are in `installation.json`, but no additional base instances are recorded.

`values(record, iteration)` answers only values attributed to that property-source instance, with
each key, value and tier (`domain/src/plugin-api/property-source.ts`). For seeded iterations, use
`iterations[*].properties` values attributed to the instance; the base seed stores them with the
iterations (`engine/seeds/base.json`, `collections.iterations[*].properties`, e.g. lines 1777–1823).
Property definitions are in `collections.propertyDefinitions` and the mock fixture
(`frontend/src/mocks/fixtures/properties.ts`). For catalog properties, use the source and tier in
`fakes.catalogReading`; the engine query helper reads this key and defaults to tier 50
(`engine/src/records/plugins.ts:26–45`, `contract/seed/seed.ts:347–356`). Ingest takes page count
from the document's `pageSources` as the `page_count` property; it does not invent a count. Its
value follows the highest applicable source: manual tier 100, catalog tier 50 and predictor tier
20 (`docs/reference/model/documents.md:174–181`, `engine/seeds/base.json`,
`collections.documents[*].pageSources`, e.g. lines 1729–1743).

For a new document use `fakes.ingest[catalogId].properties`; default is an empty array. The API has
no refusal (`property-source.ts:4`). Thrown errors, invalid answers and timeout are unavailable;
per-kind `faults` below triggers these in backend tests. Ingest fails and keeps the error. The
mock's proposal helper catalog reading is not this operation.

## Harvester

**Base instances:** `pi8` Moravian periodicals and `pi29` MZK Kramerius sweep. No instances for
the other shipped Harvester implementations appear in `base.collections.pluginInstances`.

`harvest(cursor)` produces items and next cursor. Mock implementation and seed data for each of
the listed shipped harvesters were not established by the readers named in `contract/seed/seed.ts`;
that schema has no harvester fake key. There is no engine implementation (harvest is part of later
machinery per `docs/develop/engine.md`, Order of work). The API declares no refusal. Do not infer
source connectivity or cursor fallback from the implementation description alone.


## Validation

**Base instances:** `pi9` Default ruleset and `pi10` Language check (`pt6`, `pt7`).

`check(record, properties)` answers defects with rule, field and detail
(`domain/src/plugin-api/validation.ts`). For a seeded document, take the current iteration's
defects, preserving `ruleCode`, subject and the stored internal text as answer rule, field and
detail; route each defect to its `instanceId` (`pi9` or `pi10`). This preserves STAT-defect-key
(instance, rule, subject) and the stored findings (`engine/seeds/base.json`,
`collections.iterations[*].defects`, e.g. IT1 lines 6185–6195;
`docs/reference/model/status.md:24–42`). On recheck, remove defects whose subject is in
`fakes.catalogRepairs[catalogId]`, as the mock does (`contract/seed/seed.ts:334`,
`frontend/src/mocks/catalog.ts:16–20`, `frontend/src/mocks/iterations.ts:307–329,363–370`). This is
the behavior BK4 Choice 1B replaces for `IterationChecks`.

For a new document, read `fakes.ingest[catalogId].defects`; default is no defects. The API has no
refusal (`validation.ts:4`). Thrown errors, invalid answers and timeout are unavailable; per-kind
`faults` below triggers these in backend tests. Ingest is marked failed and keeps the error.
Defects on repaired subjects disappear; other defects remain.

## Restriction

**Base instance:** `pi28` Czech copyright (`pt25`).

`check(record, properties)` answers the iteration's standing restriction as one finding with
`forbidden: true`, its `rule`, `until: null` unless stored, and `why` from its internal text
(`domain/src/plugin-api/restriction.ts`). It returns no per-rule non-forbidden findings. No stored
restriction means no finding. The seed stores restriction and override on iterations
(`engine/seeds/base.json`, `collections.iterations[*].restriction`, e.g. IT6 lines 6368–6376);
STAT-gates uses whether a restriction stands (`docs/reference/model/status.md:48–58`).

For a new document, read `fakes.ingest[catalogId].restriction`; default is null/no restriction.
The API has no refusal (`restriction.ts:4`). Thrown errors, invalid answers and timeout are
unavailable; per-kind `faults` below triggers these in backend tests. Ingest fails and keeps
the error. Return the finding even if later overridden; the iteration's override handles the
gate.

## Per-catalog seed data for ingest (`fakes.ingest`)

BK4g adds this key to `contract/seed/seed.ts`. It lets backend tests arrange answers by data,
including for a document submitted through `POST /api/proposals` and read from the catalog mirror
(B6a). Existing collections remain the source for recordings; the catalog-id key handles records
with no held iteration.

```ts
type IngestFake = {
  registryRecords?: Array<{
    instanceId: string;
    identifiers: string[];
    rawState: string;
    link: string | null;
  }>;
  properties?: Array<{
    key: string;
    value: unknown;
    tier: number;
    instanceId: string;
  }>;
  defects?: Array<{
    instanceId: string;
    rule: string;
    field: string;
    detail: string;
  }>;
  restriction?: {
    rule: string;
    forbidden: boolean;
    until: string | null;
    why: string;
  } | null;
  faults?: Partial<
    Record<
      "registry" | "propertySource" | "validation" | "restriction",
      "unavailable" | "malformed" | "timeout"
    >
  >;
};
type Fakes = { ingest?: Record<string, IngestFake> };
```

Missing entries default to no registry records, no property values, no defects, no restriction and
no fault. A per-kind `faults` entry of `unavailable` throws `PluginUnavailable`; `timeout` delays
past the configured instance timeout and produces unavailable; `malformed` returns an invalid
answer that the wrapper records as unavailable. There is no refused outcome trigger for these
kinds because their refusal schemas are `z.never()` (`domain/src/plugin-api/registry.ts:3`,
`property-source.ts:3`, `validation.ts:3`, `restriction.ts:3`). Shared HTTP switches are mock-only
(`frontend/src/mocks/faults.ts`); B5 specifies the plugin call timeout. Ingest keeps the failure's
error.

## Custody

**Base instances:** `pi25` Serials, `pi34` Printed 1800–1899, `pi35` Moravica project (`pt19`).

`place` returns request custody IDs. Engine `engineRequestPlugins` first uses
`fakes.custodyPlacements[baseIdOf(request.id)]`; otherwise it returns IDs from
`fakes.custodyRules` whose optional document type and project match, defaulting to `{}` and `[]`
(`engine/src/records/plugins.ts:95–145`; key meanings are commented at
`contract/seed/seed.ts:299–313`). Mock rules are `frontend/src/mocks/plugin-instances.ts:custodyRules`
and its request placement callers (`frontend/src/mocks/requests.ts`). Mock and engine share the
same seed inputs and intended selection, but engine uses base request IDs and the explicit
fallback rules above. No operation refusal is declared. This operation is engine-served for the
asking/deciding path.

## Classifier

**Base instances:** `pi30` Regional press and `pi31` Material type (`pt27`, `pt28`).

`suggest` returns the first applicable enabled classifier or `null`. Engine reads
`fakes.materialLeaves[document.type]` for MaterialType; for PlaceOfPublication it checks the
document is Periodical and its lowercased title contains a seeded `fakes.moravianPlaces` value,
then returns category `c21` and reason `"Periodical, Moravian place of publication"`. Missing
fake maps/lists default to `{}`/`[]`; category must be a leaf. Instance ordering is settings order
(`engine/src/records/plugins.ts:95–160`; seed comments `contract/seed/seed.ts:311–317`). Mock logic
is `frontend/src/mocks/classification.ts:answerOf` and `suggestionFor`, using fixture classifiers
and seed records. Both play the same cases; engine's literal category/reason and leaf check are
explicit, and mock behavior beyond these cases should be checked in its function. No refusal code.
Engine serves this operation for proposals.

## List generator

**Base instances:** `pi14` Priority, then age and `pi15` Pilot (`pt11`, `pt12`).

`generate` picks iterations from the intention/mix/pool and reports why and shortage. Mock
selection and explanation are in `frontend/src/mocks/list-generation.ts:enabledGenerators`,
`generateDraft`, and `causeOf`; recommendation reasons are read from
`fakes.advisorReasons` (seed comment `contract/seed/seed.ts`). No engine implementation and no
list-generator key reader in `engine/src/records/plugins.ts`; Lists/generation is mock-only under
DEC-0022. The API declares no refusal. Exact selection tie/default behavior is in the mock function,
not seed data; no backend rule should be inferred beyond that source.

## Link

**Base instance:** `pi32` Digitální knihovna MZK (`pt29`).

`canonical` recognizes Kramerius PIDs/viewer addresses and returns canonical URL plus instance.
Mock logic is `frontend/src/mocks/links.ts:krameriusLinkOf`, `readBy`, `canonicalLinkOf`; ordinary
web addresses are treated as links without a recognizing instance. Refusals are
`not_this_registry`/`malformed` per the API. No seed fake or engine implementation. Link editing
and publication records are mock-only under DEC-0022. Additional URL forms not matched by the
function return no recognition; do not treat that as a plugin refusal without checking the caller.

## Publication detector

**Base instance:** `pi33` MZK Kramerius publications (`pt30`).

`detect` finds links for published iterations. Mock scanning is
`frontend/src/mocks/links.ts:detectPublications`, which derives a PID from the iteration and
passes it through `canonicalLinkOf`; discovered links are written through `addLink` as agent `a3`.
No fake key or engine implementation. API declares no refusal. The exact remote lookup behavior is
not established in the mock reader; engine does not serve this area (DEC-0022).

## Message

**Base instances:** `pi26` Email and `pi27` MZK Slack (`pt23`, `pt24`).

`handOff` builds an address to open (mailto/chat), or reports sent. Mock preparation and dispatch
are `frontend/src/mocks/messages.ts:prepareMessage`, `sendMessage`, `hrefOf`; channels are from
`frontend/src/mocks/fixtures/message-channels.ts`. `fakes.slackHandles` supplies user handles and
`fakes.slackWorkspace` the workspace name (seed comments `contract/seed/seed.ts`); if absent the
mock's exact display fallback is determined by `messages.ts`. There is no engine Message operation;
engine outbox behavior is a later area. No operation refusal is declared. Recipient resolution and
unreachable-user behavior are in `resolveSubject`/`canReach`; they are mock caller outcomes, not
PLG refusal codes.

## Delivery channel

**Base instances:** `pi16` MZK SMTP, `pi17` Mailgun — requesters, `pi18` MZK Slack, `pi20`
Webhooks, `pi21` Scan-ops SFTP (`pt13`, `pt14`, `pt15`, `pt17`, `pt18`).

`send` and `test` answer sent or `recipient_rejected`. The engine outbox described in
`docs/develop/engine.md` is not an implementation of these plugin operations. Mock channel fixtures
are `frontend/src/mocks/fixtures/message-channels.ts`; hook delivery call paths are in
`frontend/src/mocks/handlers.ts`. No channel-specific fake data key or operation implementation
was established from the seed readers. The behavior and latency of test sends cannot be inferred;
the API only specifies the result and refusal. These areas are mock-only until backend per DEC-0022.

## Identity

**Base instances:** `pi22` MZK Keycloak, `pi24` Local accounts, `pi41` Google and `pi42` Seznam
(`pt20`, `pt22`).

`begin` starts a redirect or form entry; `complete` returns external id, email, name and claims.
Engine fake provider pages read `fakes.identityAccounts[instanceId]` (seed comment
`contract/seed/seed.ts`; engine seed loading `engine/src/seed.ts`); absent accounts result in no
matching fake account. Identity instance configuration/mappings come from plugin tables
(`engine/src/identity/instances.ts`); local form credentials are handled in
`engine/src/identity/local-accounts.ts`. Mock uses `identityInstances` and access fixtures
(`frontend/src/mocks/plugin-instances.ts`, `frontend/src/mocks/fixtures/access.ts`). Both support
the fake login journey; engine's local account/password flow is its own implementation. Refusals
are `wrong_credentials`, `suspended`, `not_allowed` (`engine/src/identity/login.ts` and API table);
caller login flow maps these to login errors. Renewal is explicitly not built (`engine.md`, Open).

## Input

**Base instances:** `pi12` Camera, `pi13` OCR pilot, `pi43` Tlačítko digitalizovat. Implementations
are `pt9`, `pt10`, `pt32`, plus shipped readers in installation.

`readBarcode`, `readPhoto`, and EntryLink `entry` are optional declared operations. Mock
`readBarcode`/`readPhoto`/record-link paths are in `frontend/src/mocks/ways-in.ts`; photo sample is
`fakes.photo` (seed schema comment identifies the engine reader, while fixture data is
`frontend/src/mocks/fixtures/ways-in.ts`). Engine proposal context reads `fakes.photo`, defaulting
to `{seen:"",read:[],best:"",near:""}` (`engine/src/records/plugins.ts:26–45`). EntryLink reads
request parameters and configured origin according to `plugin-api.md#plg-api-entry`; mock caller is
the `/ask` handler in `frontend/src/mocks/handlers.ts`. Refusals: `unreadable`, and for `entry`,
`origin_not_allowed`; mock barcode/photo can return their refusal outcomes. No general engine Input
operation suite is implemented. The sample photo and the logic that interprets image bytes are
distinct; no image-processing behavior is established by the seed.

## Identifier

**Base instances:** `pi36` Catalog ID, `pi37` NBN, `pi38` ISBN, `pi39` ISSN, `pi40` Barcode
(`pt31`, Pattern).

`recognise(value)` returns recognition and normalized value; checksum refusal is declared by the
API. Mock rules are `frontend/src/mocks/identifiers.ts:identifierRules` and
`patternRefusal`; plugin recognition is called for enabled instances. The seed has no identifier
fake key and the engine has no implementation. This is mock-only until backend per DEC-0022.
The recognition patterns are code rules, not values derived from a `fakes` entry.

## Writing the backend's fakes

They are plugins under B6, one implementation per kind. Read the seed's `fakes` and collections as
described above, and answer so the unchanged recordings in `replay/recordings/` pass, as required
by backend B8. Where this document says a behavior could not be established, resolve it from the
named mock function and recordings before implementing; do not invent a fallback.

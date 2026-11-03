# Ledger

The places where the reference and the code disagree, the rules the code does not follow yet,
and the questions only the user can answer. Every open question in the reference links here.

Each entry says:
- the rules it touches;
- what the code does now;
- who has to move: a **decision** from the user, the **frontend**, or the **engine**, once it
  exists.

When the change is made and checked, the entry moves to *Done*.

## Open questions

Each of these waits for a decision first.

None.

## Not built yet

None.

## For the engine

### L8: Placing again is a run

Rules: [ACCESS-custody-live](reference/access/custody.md#access-custody-live),
[ACCESS-custody-delete](reference/access/custody.md#access-custody-delete).

Decided on 2026-10-15. Placing open proposals again, after a Custody instance changes or a custody is deleted, is a
run on Tasks. The mock places them at once, and only on delete. → engine.

### L26: Repeats

Rules: [LC-INT-repeat](reference/lifecycles/intention.md#lc-int-repeat).

Decided on 2026-10-15. Repeats show on Schedules, with when the next occurrence is made. Nothing makes occurrences
yet. → engine, then frontend.

### L7: Access and planning changes are not logged

Rules: [ACCESS-provenance](reference/access/people.md#access-provenance),
[LOG-subjects](reference/model/log.md#log-subjects),
[OBS-audit](reference/integrations/observability.md#obs-audit),
[OBS-audit-delivery](reference/integrations/observability.md#obs-audit-delivery).

Changes on Categories, Intentions, mixes, Plugins, Hooks and Schedules are recorded nowhere
(`TODO(rrandiak)` in `mocks/access.ts`). Users & Groups, first login, the mappings at login and
sign-up record their configuration codes in the engine (built 2026-11-03), and the engine sends
them to the collector.

Decided on 2026-10-30 ([DEC-0018](decisions/DEC-0018-one-event-catalogue.md)): they go to the
Audit stream in ClickStack, not to the log, with the configuration codes of the
[catalogue](reference/model/events.md#configuration); no History card on the admin pages. Needs:
the engine's outbox and its job, the collector's audit table with no expiry, and the ready-made
HyperDX dashboards. The mock records nothing. The rest come with the engine's steps for those
pages; the collector's table and the dashboards with deployment. → engine, then deployment.

### L25: Ingest

Rules: [LC-ITER-ingest](reference/lifecycles/iteration.md#lc-iter-ingest).

The mock runs no ingest. Approving a proposal creates its iteration at once, with no defects.
Approving a project leaves its asks approved with no iteration, *being added*. The engine runs
ingest:
- create the iteration;
- read the record;
- run the restriction, validation and registry checks and the classifier;
- move progress, or fail with the error kept.

→ engine.

### L33: Hook events

Rules: [HOOK-events](reference/integrations/hooks.md#hook-events),
[HOOK-condition](reference/integrations/hooks.md#hook-condition).

The client part is done: the contract, editor and mock use hookable catalogue codes, and the
mock's lists fire `list.started` and `list.marked_done`
([HOOK-list-transitions](reference/integrations/hooks.md#hook-list-transitions)).
The engine fires every event from the act or job that causes it, with a typed condition builder.
The act matrix then names each act's event. → engine, then docs.

### L49: Hook payload

Rules: [HOOK-payload](reference/integrations/hooks.md#hook-payload) and the rules after it.

Asked for by the user on 2026-10-15: every hook gets JSON with the subject, the documents, what
changed from what, why, and who caused it. Drafted, not built: the mock previews a sample text
only.

A list event carries every member as a whole document (decided on 2026-10-15), so a delivery
plugin can turn it into, say, a list of documents for staff to prepare.

The field names and event type names were settled on 2026-10-30, together with
[L23](#built-2026-11-03) ([DEC-0018](decisions/DEC-0018-one-event-catalogue.md)): `type` is the
code, `changes` a list, machine values in snake case, times in UTC, the staff actor named.
→ engine.

### L35: Watchlist engine

Rules: [WATCH-delivery](reference/integrations/watchlists.md#watch-delivery),
[WATCH-mail-batch](reference/integrations/watchlists.md#watch-mail-batch).

The frontend simulates membership, batching and outboxes in memory. The engine needs:
- durable entry events;
- access checks when it sends;
- the per-person window;
- signed-link verification;
- real email and chat transports, faked locally.

→ engine.

### L67: Recheck reads the catalog

Rules: [DOC-property-predefined](reference/model/documents.md#doc-property-predefined),
[the iteration acts](reference/access/acts.md#iterations).

Decided on 2026-10-16. A recheck records a fresh catalog reading of the title, material type and
shelf mark. The mock records the values the document already holds, with the recheck's time, in
place of the catalog adapter's earlier reading; the engine reads them from the adapter. Also
decided on 2026-10-16: a changed value replaces the document's own field, as the catalog is the
authority ([DEC-0006](decisions/DEC-0006-vera-does-not-fix-records.md)), and the *Rechecked*
entry names the earlier value. → engine.

### L69: Several publication links

Rules: [LC-ITER-links](reference/lifecycles/iteration.md#lc-iter-links),
[the iteration acts](reference/access/acts.md#iterations),
[HOOK-subject-data](reference/integrations/hooks.md#hook-subject-data).

Decided on 2026-10-29 ([DEC-0014](decisions/DEC-0014-several-publication-links.md)). The
frontend and mock hold the link set; the engine builds it with the iteration acts (step 4). The
record shows every link, primary first; a list or table shows the primary one with a count of the
others.

### L70: Entry links

Rules: [ACT-entry-link](reference/access/acts.md#act-entry-link),
[ENT-batch](reference/model/entities.md#ent-batch),
[ACCESS-login-return](reference/access/people.md#access-login-return).

Decided on 2026-10-29 ([DEC-0015](decisions/DEC-0015-public-requests-by-entry-link.md)). VERA
takes over Tlačítko digitalizovat. Needs:
- `/ask` in the frontend, opening *Propose…* over the reader's start page with the item landed;
- the `EntryLink` Input implementation (configuration: name, allowed return origins);
- the batch's `source`, shown on the batch and filterable on Requests;
- the return to the page after login, which waits on the login page ([L4](#built-2026-10-29));
- Google and Seznam as Identity instances in the engine's fakes
  ([plugin-catalog.md](develop/plugin-catalog.md)).

The portal does not matter (2026-10-31): each is an instance, its return origins in its
configuration, and its `entry` reads what it sends
([PLG-api-entry](reference/integrations/plugin-api.md#plg-api-entry)). Old requests from the mini
app are moved by hand, not imported. → engine, then frontend.

### L72: Observability

Rules: [OBS-pipeline](reference/integrations/observability.md#obs-pipeline) and the rules after
it.

Decided on 2026-10-29 ([DEC-0017](decisions/DEC-0017-observability.md)). Needs:
- the client: an OpenTelemetry web module, a no-op without `VITE_OTEL_ENDPOINT`, recording page
  views by route template, acts, errors with the crash reference, slow answers and web vitals,
  and sending the trace context with each API call; the user id only for a role beyond reader;
- the engine: the same streams from its HTTP boundary, jobs and fake plugins, behind an endpoint
  setting, so the simulation fills HyperDX. Built for the engine on 2026-10-30: API calls, jobs
  and Identity plugin calls; the fake plugins of later steps call `withPluginSpan`;
- a local stack for development (collector, ClickHouse, HyperDX) in a compose file, and its
  production counterpart beside the deployment;
- the Java application and its workers: the OpenTelemetry Java agent and structured logs, when
  the backend is built;
- the Audit stream ([DEC-0018](decisions/DEC-0018-one-event-catalogue.md),
  [OBS-audit](reference/integrations/observability.md#obs-audit)): see
  [L7](#l7-access-and-planning-changes-are-not-logged).

→ frontend and engine, then deployment.

### L73: Plugin API

Rules: [PLG-api-call](reference/integrations/plugin-api.md#plg-api-call) and the rules after it.

Decided on 2026-10-30 and 2026-10-31 ([DEC-0019](decisions/DEC-0019-plugin-api-and-capabilities.md)).
`readLink` is optional, type detection is the Identifier instances' `recognise`, and an
`EntryLink` instance reads its portal's link.
Written down (2026-11-03): each kind's operations are zod types in `domain/src/plugin-api/`;
declarations carry `operations`, and ways in and search follow them, an instance's setting
switching search off. Type detection follows it in the mock (2026-10-31), with *Which type?* for
a line several Identifier instances recognise. Not built: no instance has a cursor or a mirror,
so the drawer's mirror line and *Reset* wait for the backend (7 of
[what comes first](develop/backend.md#what-comes-first) is done).

### L75: Names in each language

Rules: [UI-names](reference/ui/navigation.md#ui-names),
[DEC-0021](decisions/DEC-0021-names-in-each-language.md).

Every record holds one `name` string, and the shipped watchlists, properties, instances and roles
are named in English. Needs: `names` by language in the contract and the domain for watchlists,
properties and enum values, plugin instances, roles, custodies, categories, mixes, schedules and
repeats; the seeds in both languages; search and uniqueness by language; then the client shows the
viewer's language and its editors gain *Add language*. → engine (contract and seed), then
frontend.

## Done

### Built, 2026-11-03

- **L76:** an approval records the classifier's suggestion as data, its category and instance
  and whether the decider kept it; the staff History words it, the public one does not
  ([events](reference/model/events.md)).
- **L10:** the daily proposal limit counts the requests stored on the library's day (Prague),
  in the mock and the engine alike, against the server's clock
  ([ROLE-library-day](reference/access/roles.md#role-library-day)).
- **L23:** the engine writes event codes from its first entry, through one function that sends
  each to History and the Audit stream as the [catalogue](reference/model/events.md) says; the
  client words them, and the mock and the seeds hold codes
  ([DEC-0018](decisions/DEC-0018-one-event-catalogue.md)).

### Built, 2026-11-02

- **L37:** the review's gaps are closed: no message key or English word is left on screen, a
  test fails on a key missing from the messages (in the source and at render time), the Czech
  pages unit is *s.*, the rail marks follow the language, and a *hook* is *hook* in Czech
  ([UI-language](reference/ui/navigation.md#ui-language), the [glossary](glossary.md)). To be
  checked on a real phone before release.
- **L74:** every refusal carries a code from one list in the contract (`refusal-codes.ts`),
  apart from the event codes; the interface words it by its code alone, in English and Czech,
  and never shows the server's `detail`; a 422 names its fields by JSON Pointer, each with a
  code ([ACT-refusal](reference/access/acts.md#act-refusal),
  [ACT-refusal-code](reference/access/acts.md#act-refusal-code)). Showing those field errors
  beside their fields is not built yet.

### Decided, 2026-11-02

- **Forbidden, not a redirect:** a page the person cannot open shows *Forbidden* in the shell,
  naming the page, as the client already does
  ([VIEW-gate](reference/access/views.md#view-gate)).
- **Hook in Czech** is *hook* (*hooku*, *hooky*), as Czech developers say it; *oznámení* stays
  Preferences' notifications ([glossary](glossary.md)). Built with L37.

### Built, 2026-10-29

- **L4:** login is built: the login page with its language pick in the client, and in the
  engine sessions, the Identity plugins with fake providers, first login, match by email and
  the mappings at each login ([ACCESS-login-page](reference/access/people.md#access-login-page),
  [ACCESS-first-login](reference/access/people.md#access-first-login)).
- **L71:** local sign-up, email verification and password reset, in the client with the mock and
  in the engine ([ACCESS-sign-up](reference/access/people.md#access-sign-up)).
- **L11:** the shipped roles and the fallback custody are the engine's installation seed
  (`engine/seeds/installation.json`), which `base.json` extends; `docs/tools/docs.ts` reads the
  roles there, and a frontend test keeps the mock's fixture equal to it
  ([ROLE-shipped](reference/access/roles.md#role-shipped)).

### Decided, 2026-10-16

- **L64:** a definition's type, list flag, subject and unit stay as they are once any record
  holds a value, as does an enum value in use; names, visibility, hand entry and new enum values
  change at any time ([DOC-property-fixed](reference/model/documents.md#doc-property-fixed)).
  Session F's choices stand too: bulk entry picks rows with *Select* on Documents
  ([DOC-property-hand](reference/model/documents.md#doc-property-hand)); a page does not offer a
  property its own field covers
  ([DOC-property-filter](reference/model/documents.md#doc-property-filter)); and *No hook email*
  replaces turning off every current hook
  ([WATCH-hook-preferences](reference/integrations/watchlists.md#watch-hook-preferences)).
- **L63:** what the properties model left open
  ([DOC-property](reference/model/documents.md#doc-property)): defining needs
  `property.define@any`, admin only, on a *Properties* page; the page count, material type,
  shelf mark and title are predefined and cannot be deleted
  ([DOC-property-predefined](reference/model/documents.md#doc-property-predefined)); a fact the
  catalog holds cannot be entered by hand, the page count apart; values are entered on the
  record pane or in bulk on Documents, rerun the checks when a rule reads the property, and an
  attempt's value is fixed once scanned
  ([DOC-property-hand](reference/model/documents.md#doc-property-hand));
  `property.<key>.edit` needs `iteration.read@any`
  ([PERM-property-edit](reference/access/permissions.md#perm-property-edit)); text filters by
  *contains*, *no value* is always offered, the record pane shows every readable property and a
  column only where a view declares it
  ([DOC-property-filter](reference/model/documents.md#doc-property-filter)); a system watchlist
  losing a condition pauses, and a deleted key is never reused
  ([DOC-property-delete](reference/model/documents.md#doc-property-delete)); a scope condition
  reads the value on the digitized date
  ([PLAN-scope](reference/planning/intentions.md#plan-scope)); a change is logged and fires
  `document.property_changed` or `iteration.property_changed`
  ([DOC-property-values](reference/model/documents.md#doc-property-values)).

### Confirmed as built, 2026-10-15

- **L3:** a list is within reach at `custody` or `project` when one of its members is
  ([SCOPE-list](reference/access/scopes.md#scope-list)).
- **L9:** a self-grant is an ordinary grant; a view may highlight it, since it can be worked out
  ([LOG-cause](reference/model/log.md#log-cause)).
- **L13:** no Home page; `/` opens the first entry
  ([VIEW-landing](reference/access/views.md#view-landing)).
- **L15:** a curator's cancel covers an item already on a list
  ([ACT-cancel](reference/access/acts.md#iterations)).
- **L16:** the delete refusal over a tracked mix stayed until tracking went (L28).
- **L17:** a new or moved category gets no share, and a category with intentions scoped to it is
  not deleted ([PLAN-new-category-share](reference/planning/categories.md#plan-new-category-share)).
- **L19:** whoever started a run may cancel and rerun it; the mock starts no runs from other pages
  ([ACT-run-cancel](reference/access/acts.md#tasks-and-schedules)).
- **L26:** a new intention's counting start is not prefilled
  ([LC-INT-repeat](reference/lifecycles/intention.md#lc-int-repeat)).
- **L31:** *Move to v…* stays on the instance drawer
  ([PLG-upgrade](reference/integrations/plugins.md#plg-upgrade)).
- **L24:** approving a project leaves a proposal whose copy check has not answered for review;
  it rarely happens, and proposals made after the approval are decided as usual
  ([LC-PROJ-decide](reference/lifecycles/project.md#lc-proj-decide)).
- **L39:** the engine's shape: a shared `contract/` package with OpenAPI, a shared `domain/`
  package, plain `Bun.serve`, the MSW mock retired once every journey passes, event codes and log
  subjects settled before step 3, and a large seed, later shaped by production data
  ([engine plan](develop/engine.md#settled)).
- **Start now's refusal** is `list.already_started`, so refusal codes and event names never share
  a spelling ([ACT-list-start](reference/access/acts.md#digitization-lists)).

### Built, 2026-10-16

- **L68:** the interface speaks the browser's language on first access, or English; the
  person's language is saved at their first login, the same in any browser, and changed in the
  Display preferences ([UI-language](reference/ui/navigation.md#ui-language)). A pick on the login page
  replaces it once the login page exists ([L4](#built-2026-10-29)).
- **L12:** the permission lines are i18n messages, one file per language in
  `frontend/src/i18n/locales/`, read through i18next; the catalog table is generated from the
  English one ([the catalog](reference/access/permissions.md#the-catalog)). The Czech file is a
  copy of the English until the Czech terms are settled ([L37](#built-2026-11-02)).
- **L67, in the mock:** a recheck records the title, material type and shelf mark again as
  the catalog adapter's reading, with the recheck's time
  ([DOC-property-predefined](reference/model/documents.md#doc-property-predefined)); reading the
  adapter itself stays with the engine.
- **L36:** the pages reference names each list's columns, generated from the code per tier
  ([UI-columns](reference/ui/pages.md#ui-columns)), the cards of each record pane in order
  ([UI-record-pane](reference/ui/pages.md#ui-record-pane)), and what each page leaves to
  another ([UI-not-here](reference/ui/pages.md#ui-not-here)).
- **L66:** the title, material type and shelf mark hold the catalog adapter's values as sourced
  values, *MZK Aleph* at tier 50, beside the document's own fields; the record pane's *Catalog
  record* card names each one's source, tier and when it was observed, in one row when they were
  read together ([DOC-property-predefined](reference/model/documents.md#doc-property-predefined)).
- **L65:** a text property's filter and scope condition choose *Contains*, *Starts with* or
  *Ends with*, written `p.<key>`, `p.<key>.starts` and `p.<key>.ends` in a page's URL
  ([DOC-property-filter](reference/model/documents.md#doc-property-filter),
  [PLAN-scope](reference/planning/intentions.md#plan-scope)).
- **L62:** a watchlist's channels are browser push and every enabled Delivery channel instance
  whose version declares how it reaches a person, by the account's email or by a handle from an
  identity claim (*MZK SMTP*, *Mailgun — requesters*, *MZK Slack* by `slack_id`, *MZK Teams* by
  `teams_upn`), each named by its instance and off until switched on; one that cannot reach the
  person says why beside its switch. Preferences → Notifications has, beside *Do not send
  notifications*, *No …* for browser push and each channel, and *No hook email* in place of
  turning off every current hook; a watchlist or hook switched on says when its kind is off for
  all. The Plugins drawer shows the declaration, and the mock's outboxes send per instance
  ([WATCH-delivery](reference/integrations/watchlists.md#watch-delivery),
  [WATCH-channel-off](reference/integrations/watchlists.md#watch-channel-off),
  [PLG-declares](reference/integrations/plugins.md#plg-declares),
  [WATCH-hook-preferences](reference/integrations/watchlists.md#watch-hook-preferences)).
- **L22:** properties in the frontend. A *Properties* page under Administration, with
  `property.define@any`, admin only, defines them: key, names in each UI language, what they are
  about, type and list, visibility, hand entry and its tier. The predefined page count, material
  type, shelf mark and title are edited, never deleted, and a deleted key is never defined again
  ([DOC-property](reference/model/documents.md#doc-property),
  [DOC-property-predefined](reference/model/documents.md#doc-property-predefined)). Each property
  brings `property.<key>.edit`, at `any` only and needing `iteration.read@any`, under its own
  heading in the role editor ([PERM-property-edit](reference/access/permissions.md#perm-property-edit)).
  The record pane on Documents, My Documents, Requests and Documents Validations shows each
  readable property with every source, its tier, when it was observed and who set it, public
  ones only in public detail; holders enter a value there or, after *Select* on Documents, on
  every picked document, refused once an attempt is scanned, rerunning the checks when a rule
  reads it, logged, and firing `document.property_changed` or `iteration.property_changed`
  ([DOC-property-values](reference/model/documents.md#doc-property-values),
  [DOC-property-hand](reference/model/documents.md#doc-property-hand),
  [DOC-property-visibility](reference/model/documents.md#doc-property-visibility)). Those pages
  and the list editor's pool filter on each property by its type, with *no value* and facet
  counts, saved in watchlists as `p.<key>`
  ([DOC-property-filter](reference/model/documents.md#doc-property-filter)). An intention or a
  repeat adds conditions on properties to its scope, read on the digitized date for a digitized
  item, and generating draws only from the whole scope
  ([PLAN-scope](reference/planning/intentions.md#plan-scope)). Deleting a definition removes its
  values, grants, filters and conditions, and a system watchlist that loses one pauses
  ([DOC-property-delete](reference/model/documents.md#doc-property-delete)). The mock keeps the
  predefined four's values on the document itself.
- **L60:** the browser's permission is asked on Preferences → Watchlists after the person's
  watchlists moved there. A person added to a system
  watchlist's audience starts with push on, email and chat off
  ([WATCH-delivery](reference/integrations/watchlists.md#watch-delivery),
  [WATCH-system-change](reference/integrations/watchlists.md#watch-system-change)).
- **L21:** decided on 2026-10-16 that an Identifier instance recognises one of the six document
  identifier types and no other ([DOC-identifiers](reference/model/documents.md#doc-identifiers)).
- **L60, in part:** browser push as a third watchlist channel, a *Browser* switch on each
  watchlist, on by default. A browser is registered with the server once the person allows the
  site's notifications there, and again on each visit while allowed; nothing is pushed before
  that. Each push names the watchlist and the first three records that entered, the rest as
  *+N more*, batched per person and watchlist after 5 quiet seconds and at most 30 seconds after
  the first, without what was opened, and never under *Do not send notifications*. The mock shows
  the pushes from the open tab; `public/push-worker.js` shows them from a real push
  ([WATCH-delivery](reference/integrations/watchlists.md#watch-delivery),
  [WATCH-push](reference/integrations/watchlists.md#watch-push),
  [WATCH-do-not-send](reference/integrations/watchlists.md#watch-do-not-send)).
- **L21:** the Identifier plugin kind, with the built-in Pattern implementation (type, a label
  in each language, a regular expression, normalisation, an optional ISBN-10, ISBN-13 or ISSN
  checksum) and MZK's five predefined instances, editable but not deletable, their order deciding
  detection. The propose settings carry each type's recogniser and labels, which the dialog reads
  in place of the types fixed in the code; a type without a recogniser is taken when chosen and
  checked with the catalog lookup. The mock's ISBN and ISSN now pass their checksums
  ([DOC-identifiers](reference/model/documents.md#doc-identifiers),
  [DOC-lines](reference/model/documents.md#doc-lines),
  [PLG-kinds](reference/integrations/plugins.md#plg-kinds)).
- **L61:** the camera reads barcodes where the browser cannot: one photo per book, its code read
  by the barcode-reading Input plugin on the server and added like a scan, counted the same; a
  photo with no code says so. The browser's continuous reader stays where it exists
  ([ACT-ways-in](reference/access/acts.md#act-ways-in)).
- **L31:** each Custody instance is one rule, its condition the configuration and one request
  custody picked in its editor from those on Users & Groups, bound by id: a rename keeps it
  placing, and a deleted custody's rule places nothing until another is picked, which Plugins
  shows on the instance's row and drawer. The mock's *House rules* became one rule per custody
  ([ACCESS-custody-by-plugins](reference/access/custody.md#access-custody-by-plugins),
  [ACCESS-custody-rename](reference/access/custody.md#access-custody-rename),
  [ACCESS-custody-delete](reference/access/custody.md#access-custody-delete)).
- **Run history in tests:** the 80 generated runs that fill Tasks for scrolling are set apart
  from the hand-written runs in the tests, which no longer fail on them.
- **L58:** the propose dialog's ways in beside typing, pasting and a file: catalog search over
  the enabled Catalog adapters that search, with a record link or ID for those that cannot;
  continuous barcode scanning, a hardware scanner always and the camera while a camera Input
  instance is enabled (read with the browser's barcode reader); photo capture with candidates
  and why each matched. Each way, auto-detect included, follows its enabled plugin
  ([ACT-ways-in](reference/access/acts.md#act-ways-in)).
- **L31, in part:** each instance sets its property tiers, which registry states count as an
  existing copy, and a harvester's agent (name, entry point), in its editor and drawer; the
  implementation's declarations are the defaults, and *Move to v…* carries the instance's
  choices over. The Custody rule's custody stays open
  ([PLG-upgrade](reference/integrations/plugins.md#plg-upgrade),
  [REG-copy-not-gate](reference/integrations/registries.md#reg-copy-not-gate)).
- **L50:** the Link and Publication detector plugin kinds. *Set link…* takes a web address or a
  PID; an enabled Link instance (Kramerius, in the mock) turns a PID or its viewer's address into
  the canonical link, and without one only a web address is kept. A Publication detector run
  sets the links of digitized items as its agent, logged *Published* as *Set link…* is
  ([PLG-kinds](reference/integrations/plugins.md#plg-kinds),
  [ACT-publish](reference/access/acts.md#iterations)).
- **L32:** disabling a delivery channel counts the active hooks it stops and names them to anyone
  with `hook.read` ([PLG-delivery-hooks](reference/integrations/plugins.md#plg-delivery-hooks)).
  The "says what stops first" test still fails on the plug-in's run count (22, not 2), the same
  run fixture drift as the tasks baseline, untouched here.
- **L51:** Plugins lists the kinds in the order a document meets them, with no group headings
  ([PLG-kinds](reference/integrations/plugins.md#plg-kinds)).
- **L34:** message acts named for who they reach: *Message askers…* on a proposal and on a
  forbidden item, *Ask to overrule…* on a forbidden item for anyone who cannot overrule it,
  *Message manager…* on a project's page and *Message list author…* on Documents' Digitization
  card for a listed item. Neither the manager nor the list's author is offered a message to
  themselves ([MSG-recipients](reference/integrations/messaging.md#msg-recipients),
  [ACT-message](reference/access/acts.md#act-message)).
- **L6:** *Unlink* on each of a person's identities but the last, on Users & Groups; the person,
  their roles and history stay
  ([ACCESS-link-identity](reference/access/people.md#access-link-identity),
  [ACT-identity-unlink](reference/access/acts.md#users--groups)).
- **L5:** *Suspend…* and *Restore* on a person on Users & Groups: login refused and roles kept
  but giving nothing while suspended; groups, history and open asks stay. Refused for an agent
  and when nobody could manage access after
  ([ACCESS-suspend](reference/access/people.md#access-suspend),
  [ACT-user-suspend](reference/access/acts.md#users--groups)).
- **L14:** *Withdraw…* on the caller's own waiting ask, on Documents and My Documents; *Resume…*,
  *Cancel…* and *Overrule restriction…* in Documents' More ▾. Resume takes a held item off its
  list and back to the pool; an overrule keeps the rule's finding beside it
  ([ACT-withdraw](reference/access/acts.md#proposing),
  [ACT-resume](reference/access/acts.md#iterations),
  [ACT-overrule](reference/access/acts.md#iterations),
  [LC-ITER-resume](reference/lifecycles/iteration.md#lc-iter-resume)).
- **L40:** *Start now…* on a Planned list's page: its start date becomes today, logged *Started
  early* with the date it replaced. Its hooks wait for L33
  ([ACT-list-start](reference/access/acts.md#digitization-lists),
  [LC-LIST-start-now](reference/lifecycles/list.md#lc-list-start-now)).

### Built, 2026-10-15

- **L28:** decided on 2026-10-15. Intentions choose a mix directly: no tracking another
  intention's mix and no *Detach*, and the project and intention delete refusals over a tracked
  mix (`intention.tracked`) are gone. An intention's Mix page reads the mix it chose and links to
  Mixes to edit it ([PLAN-mix](reference/planning/mixes.md#plan-mix),
  [ACT-project-delete](reference/access/acts.md#projects),
  [LC-INT-delete](reference/lifecycles/intention.md#lc-int-delete)).
- **L41:** `intention.edit_overall` is gone, and with L28 the older path of editing an
  intention's own mix in place (*Edit mix…*, `intention.not_owner`); which mix Overall uses stays
  under `intention.edit@any` ([LC-INT-overall](reference/lifecycles/intention.md#lc-int-overall)).
- **L29:** an item's digitized date is the day its list was marked Done; the fallback to the
  list's last day is gone, so an item without a date counts as having none
  ([PLAN-digitized-date](reference/planning/intentions.md#plan-digitized-date)).
- **L30:** `mix.read` alone shows the house mix on Categories; whether curators get `mix.read` is
  a role choice ([PLAN-house-mix](reference/planning/intentions.md#plan-house-mix),
  [VIEW-categories-mix](reference/access/views.md#view-categories-mix)).

- **L59:** decided on 2026-10-15. When the catalog gives several records for an identifier, the
  propose dialog lists them, none picked, and each one picked becomes its own item
  ([DOC-records](reference/model/documents.md#doc-records)).

- **L48:** the document's field is `shelfMark`, shown as *Shelf mark*, and a shelf mark is an
  identifier type to propose by, which the catalog adapter resolves; it names a unit when the
  catalog puts it on one ([DOC-identifiers](reference/model/documents.md#doc-identifiers),
  [DOC-units](reference/model/documents.md#doc-units)).
- **L42:** the identifier type is `nbn`, labelled *NBN*; the Czech labels are to name it *ČNB*
  ([DOC-identifiers](reference/model/documents.md#doc-identifiers)).

- **L57:** decided on 2026-10-15. A batch is the submitter's, named by them, and has no source:
  an Input plugin only adds items, and one batch mixes the ways in. This replaces L55's typed
  batch; the header names who submitted it. The name is optional: the dialog shows the default,
  when it was submitted in the library's time, and the server gives it
  ([ENT-batch](reference/model/entities.md#ent-batch)).

- **L56:** decided on 2026-10-15. The shipped `curator` reads requests at `custody`, not `any`,
  so Requests shows them what their request custodies hold; `dig-curator` keeps `any`, as it plans
  every project ([ROLE-shipped](reference/access/roles.md#role-shipped)).

- **L44:** Proposals is *Requests* at `/requests`, proposal custody is *request custody*
  ([ACCESS-request-custody](reference/access/custody.md#access-request-custody)), and the code
  follows (`features/requests`, `api/requests`, `RequestRow`, `RequestCustody`); a proposal stays
  the word for an undecided request, so submitting keeps its names. The act is *Add…* for a
  holder of `request.decide` and *Propose…* for anyone else
  ([ACT-propose](reference/access/acts.md#proposing)).
- **L1:** `request.read` opens Requests within its scope, read-only; the server says per proposal
  whether `request.decide` reaches it, and a batch counts only what the caller may approve
  ([VIEW-requests](reference/access/views.md#view-requests)).

- **L54:** decided on 2026-10-15. An approved ask stops counting as the asker's own once its
  attempt is published or cancelled, so its asker can ask again; the ask is a new proposal
  ([LC-REQ-check](reference/lifecycles/request.md#lc-req-check)).
- **L55:** decided on 2026-10-15. Typed items alone make a *typed* batch; a file wins over the
  rest, and anything pasted makes a pasted list ([ENT-batch](reference/model/entities.md#ent-batch)).

- **L52:** *approve now* stores no mark: what has a copy, or is not yet checked, stays Pending
  like any other proposal, with no *held* status or note
  ([LC-REQ-approve-now](reference/lifecycles/request.md#lc-req-approve-now)).
- **L27:** an ask after a published or cancelled attempt is a new proposal, shown with the
  existing copy and approved as a rescan; the asker's own earlier ask still skips it
  ([LC-REQ-join](reference/lifecycles/request.md#lc-req-join)).
- **L20:** every submission is a batch, one item included; a batch is sent with its size and
  shown as one only from two items. The fixtures' single asks got batches of their own, and a
  single failed item is retried from its Adding card
  ([ENT-batch](reference/model/entities.md#ent-batch)).

- **L53:** reach and detail are separate. `request.read_own` became `request.read_mine` (`own` ·
  `project`) and opens My Documents in public detail; `iteration.read` opens Documents, which
  holds approved work only, every scope also reaching one's own asks. Each page has its own
  entry, the switch went, and `project-user` is public-only
  ([VIEW-documents-audience](reference/access/views.md#view-documents-audience)). Documents is
  still to be named for its stage in part 5 ([L37](#built-2026-11-02)).

- **L2:** Documents narrows to the scope of `iteration.read`: category custody at `custody`, the
  person's projects at `project`, everything at `any`
  ([VIEW-documents-audience](reference/access/views.md#view-documents-audience)).
- **L47:** the sixth shipped role, `project-user`, with the staff limits; the mock's `project-user`
  profile is u9 ([ROLE-shipped](reference/access/roles.md#role-shipped)).

- **L46:** a role must grant what its permissions need; the role editor ticks it, the server
  refuses a role without it (422 `role.requires`), and `project.decide` no longer reads by
  itself, so `curator` holds `project.read@any`
  ([PERM-requires](reference/access/permissions.md#perm-requires)).
- **L18:** saving a personal watchlist needs `watch`
  ([ACT-watchlist-save](reference/access/acts.md#watchlists)).
- **L45:** `watchlist.manage_shared` became `watchlist.manage_system`; it needs
  `iteration.read@any`, opens both Documents views and is offered every filter value
  ([WATCH-personal-system](reference/integrations/watchlists.md#watch-personal-system)).

- **L43:** `addition.*` became `request.read_ingest`, `request.retry` (`custody` · `any`, held
  by `curator` and `dig-curator` at `custody`) and `request.read_payload`; the `project.*`
  permissions moved to Requests; *Lists and planning* became *Planning*
  ([the catalog](reference/access/permissions.md#the-catalog),
  [ACT-retry-batch](reference/access/acts.md#request-review)).
- **L38:** the Documents Validations entry shows with any of `validation.approve`,
  `validation.deny` or `validation.revoke`
  ([VIEW-validations](reference/access/views.md#view-validations)).

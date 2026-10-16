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

Each of these waits for a decision first. None is open now.

## Not built yet

### L22: Properties

Rules: [DOC-page-count](reference/model/documents.md#doc-page-count),
[PLAN-scope](reference/planning/intentions.md#plan-scope).

Only the page count has sources and tiers today; material type, shelf mark and title are fixed
fields. Decided on 2026-10-15, so lists can be built and generated over any filter (size, target
machine) and intentions scoped by a property:
- only an **admin** defines a property: a key that never changes, a name in each UI language, a
  visibility (**public** or **staff**), and a type: text, number with a unit, yes/no, date, enum
  (each value with a name in each language), or a list of any of these;
- a property is about the **document** (its size) or about one **attempt** (the machine chosen
  this time);
- every value has a source, which is a person entering it or a plugin instance (the catalog
  adapter included), with a tier, when it was observed and who set it; the highest tier with a
  value wins, as the page count does now;
- a definition says whether it may be entered by hand, and the tier a hand value gets, so it
  decides whether a hand value outranks a plugin's;
- each property has its own permission, `property.<key>.edit`, made with the definition and
  accepting `any` only; reading follows the visibility;
- each type gives its filter on every page that shows the property;
- an intention's scope may add conditions on properties;
- deleting a definition removes its values, its grants and every filter and condition that
  names it.

This replaces [DEC-0003](decisions/DEC-0003-properties-are-not-columns.md) with a new record.
→ docs (reference and the decision record, before the engine), then frontend and engine.

### L36: Pages reference

Rules: [UI-pages](reference/ui/pages.md#ui-pages).

The columns of each list, what each record pane shows and what each page deliberately leaves out
are not written down yet. → docs, from the code.

### L21: Identifier plugins

Rules: [DOC-identifiers](reference/model/documents.md#doc-identifiers),
[DOC-lines](reference/model/documents.md#doc-lines),
[PLG-kinds](reference/integrations/plugins.md#plg-kinds).

Decided on 2026-10-15: each identifier type is an instance of a new **Identifier** plugin kind,
which recognises, checks and normalises a value and names the type in each language (*NBN*,
*ČNB*). One built-in **Pattern** implementation does it with a regular expression, a
normalisation and an optional checksum (ISBN-10, ISBN-13, ISSN), one instance per type. VERA ships
predefined Pattern instances with MZK's formats, shown on Plugins as editable but not deletable,
their order deciding detection; a library configures them or adds its own, such as a shelf-mark
pattern. Only a check a pattern cannot make needs its own implementation. This replaces moving the formats into each
installation's configuration; tenancy stays out of scope. The code fixes the types and formats
in `domain/proposals.ts` (`TODO(Tenancy)`), and the client checks them as typed: the server is to
send each type's pattern and labels with the propose settings, and a type checked only by plugin
code is checked with the catalog lookup. → frontend, then engine.

### L60: Browser notifications for watchlists

Rules: [WATCH-delivery](reference/integrations/watchlists.md#watch-delivery),
[WATCH-push](reference/integrations/watchlists.md#watch-push),
[WATCH-do-not-send](reference/integrations/watchlists.md#watch-do-not-send).

Decided on 2026-10-16: browser push is a third watchlist channel, on by default for every
watchlist, personal and system, once the person allows the site's notifications; each
notification names the watchlist and the records that entered, batched in seconds. Today there
is no push, and the watchlist preferences sit on the Watchlists page. Where the browser's
permission is asked waits until those preferences move under Preferences. → frontend, then
engine.

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

### L4: Logging in

Rules: [ACCESS-first-login](reference/access/people.md#access-first-login),
[ACCESS-mapping-at-login](reference/access/people.md#access-mapping-at-login),
[ACCESS-login-page](reference/access/people.md#access-login-page).

The mock signs in a fixed person per dev server. The engine runs a real login against fake
Identity providers: first login, default role, match by email, mappings at each login. The
frontend needs the login page. → engine, then frontend.

### L7: Access and planning changes are not logged

Rules: [ACCESS-provenance](reference/access/people.md#access-provenance),
[LOG-subjects](reference/model/log.md#log-subjects).

The log has subjects of four kinds only: iteration, request, list, project. Changes on Users &
Groups, Categories, Intentions, mixes, Plugins, Hooks and Schedules are not logged
(`TODO(rrandiak)` in `mocks/access.ts`). → engine.

### L10: The library day

Rules: [ROLE-library-day](reference/access/roles.md#role-library-day).

The daily limit counts against the browser's clock rather than the mock's, and its count is lost
on reload. The engine counts accepted items from stored requests against its own clock. →
engine.

### L11: The shipped roles

Rules: [ROLE-shipped](reference/access/roles.md#role-shipped).

The shipped roles live in a mock fixture (`mocks/fixtures/access.ts`). They move to the engine's
installation seed, and `docs/tools/docs.ts` then reads them from there. → engine.

### L23: Event codes

Rules: [LOG-public](reference/model/log.md#log-public).

Log events are free text (`TODO(rrandiak)` in `domain/entities.ts`), and the public wording is
matched by prefix. The engine needs event codes, each with its subject kind, its detail fields
and its public wording. → engine, then frontend.

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

The mock fires only `iteration.published` and `list.created`, and accepts two condition phrases.
`list.started` and `list.done` were added at the user's request on 2026-10-15
([HOOK-list-transitions](reference/integrations/hooks.md#hook-list-transitions)); the frontend's
event list (`api/hooks.ts`) does not offer them yet.
The engine fires every event from the act or job that causes it, with a typed condition
builder. The act matrix then names each act's event. → engine, then docs.

### L49: Hook payload

Rules: [HOOK-payload](reference/integrations/hooks.md#hook-payload) and the rules after it.

Asked for by the user on 2026-10-15: every hook gets JSON with the subject, the documents, what
changed from what, why, and who caused it. Drafted, not built: the mock previews a sample text
only.

A list event carries every member as a whole document (decided on 2026-10-15), so a delivery
plugin can turn it into, say, a list of documents for staff to prepare.

The field names and event type names are settled with the engine, together with
[L23](#l23-event-codes). → engine.

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

## For part 5 (writing and i18n)

### L37: Czech terms

Rules: the [glossary](glossary.md).

The Czech column is a first draft. Several terms, such as *iteration*, *mix*, *hook* and
*custody*, need the word the library already uses.

Decided on 2026-10-15: corrected in their own session in part 5. → i18n.

Also decided on 2026-10-15: *Documents* is to be named for its stage, the approved work until it
is published (*Digitization*, *Progress*…), in Czech first
([VIEW-own-label](reference/access/views.md#view-own-label)).

### L12: Permission descriptions

Rules: [the catalog](reference/access/permissions.md#the-catalog).

The permission descriptions live in `features/access/access-words.ts`. They move to i18n
messages, and the generator follows them. → frontend.

## Done

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
  still to be named for its stage in part 5 ([L37](#l37-czech-terms)).

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

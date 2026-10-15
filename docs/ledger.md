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

### L14: Acts not built

Rules: [ACT-withdraw](reference/access/acts.md#proposing),
[ACT-resume](reference/access/acts.md#iterations),
[ACT-overrule](reference/access/acts.md#iterations).

Withdrawing an ask, resuming a cancelled iteration and overruling a restriction have
permissions, and the frontend mentions them, but there is no act and no endpoint. → frontend,
then engine.

### L40: Start a list now

Rules: [ACT-list-start](reference/access/acts.md#digitization-lists),
[LC-LIST-start-now](reference/lifecycles/list.md#lc-list-start-now).

Added at the user's request on 2026-10-14. A Planned list can be started early: its start date
becomes today. Not built: it needs the act on the list's page and an endpoint (or editing the
start date to today through *Edit*, which already works and could carry the same log entry). →
frontend, then engine.

### L5: Suspending a user

Rules: [ACCESS-mapping-at-login](reference/access/people.md#access-mapping-at-login).

Decided on 2026-10-15. An admin can *Suspend…* a person and *Restore* them, on Users & Groups
with `access.manage`: login refused while suspended, roles kept but inactive, history and open
asks kept. Mapped roles otherwise stay until the next login. → frontend, then engine.

### L34: Message targets

Rules: [MSG-recipients](reference/integrations/messaging.md#msg-recipients).

Decided on 2026-10-15. Each message act is named for who it reaches: *Message askers…* on a
proposal and a forbidden item, *Ask to overrule…* on a forbidden item, *Message manager…* on a
project, *Message list author…* on a listed item. None on a user or a plugin run. Built: one
*Message…* on a proposal and on a forbidden item. → frontend.

### L51: Order of plugin kinds

Rules: [PLG-kinds](reference/integrations/plugins.md#plg-kinds).

Decided on 2026-10-15: the order a document meets them (Identity, Input, Harvester, Catalog
adapter, Property source, Registry, Validation, Restriction, Custody, Classifier, List generator,
Link, Publication detector, Message, Delivery channel), with no group headings. → frontend.

### L6: Unlinking an identity

Rules: [ACCESS-link-identity](reference/access/people.md#access-link-identity).

Decided on 2026-10-15. *Unlink* on a person's identity; refused for their last one (suspending is
[L5](#l5-suspending-a-user)'s job); the person and their history stay. → frontend, then engine.

### L28: Remove mix tracking

Rules: [PLAN-mix](reference/planning/mixes.md#plan-mix),
[ACT-project-delete](reference/access/acts.md#projects).

Decided on 2026-10-15. *Track another intention's mix* and *detach* go: intentions choose a mix directly. The
project delete's `intention.tracked` refusal goes with them. No mix is filtered by project. →
frontend.

### L29: Only Mark Done digitizes

Rules: [PLAN-digitized-date](reference/planning/intentions.md#plan-digitized-date).

Decided on 2026-10-15. An item's digitized date is the day its list was marked Done; a list past its end has
delivered nothing until then. The code falls back to the list's last day for an item with no
recorded date (`domain/intentions.ts`). → frontend.

### L30: House mix needs only mix.read

Rules: [VIEW-categories-mix](reference/access/views.md#view-categories-mix).

Decided on 2026-10-15. `mix.read` alone shows the house mix on Categories; today it also needs `intention.read`.
Whether curators get `mix.read` is a role choice. → frontend.

### L31: Plugin policy on the instance

Rules: [PLG-upgrade](reference/integrations/plugins.md#plg-upgrade),
[REG-copy-not-gate](reference/integrations/registries.md#reg-copy-not-gate).

Decided on 2026-10-15.
- Property tiers, a registry's state mapping (which states count as a copy) and a harvester's
  agent are set on each instance, with the implementation's values as defaults.
- A Custody rule returns one of the custodies on Users & Groups, picked in the rule editor. Today
  the server reads the names from the rule's expression and the editor neither shows nor edits
  them (`TODO(rrandiak)` in `features/plugins/instance-editor.tsx`).

→ frontend, then engine.

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

### L41: Remove intention.edit_overall

Rules: [LC-INT-overall](reference/lifecycles/intention.md#lc-int-overall),
[PLAN-mix](reference/planning/mixes.md#plan-mix).

Decided on 2026-10-15: the permission goes. It guarded only the older path of editing an
intention's own mix in place, which Overall no longer has. Which mix Overall uses stays under
`intention.edit@any`.

Built on 2026-10-15: the permission is gone from the catalog and the `admin` role, and Overall's
mix is written under `intention.edit@any`. → frontend: remove the older path with
[L28](#l28-remove-mix-tracking).

### L50: Link and publication plugins

Rules: [PLG-kinds](reference/integrations/plugins.md#plg-kinds),
[ACT-publish](reference/access/acts.md#iterations).

Decided on 2026-10-15: two new plugin kinds.
- **Link:** *Set link…* accepts a PID or a viewer URL, and a Link instance turns it into the
  canonical link (a Digitální knihovna `…/view/uuid:X?page=…` becomes `…/uuid/uuid:X`).
- **Publication detector:** finds where a scanned iteration was published and sets its link, as
  its agent, logged like *Set link…*.

→ frontend (plugin kinds, the *Set link…* dialog), then engine.

### L32: Channel impact

Rules: [PLG-delivery-hooks](reference/integrations/plugins.md#plg-delivery-hooks).

Disabling a delivery channel says the hooks sending through it stop, without counting or naming
them (`TODO(rrandiak)` in `features/plugins/plugin-words.ts`). → frontend.

### L36: Pages reference

Rules: [UI-pages](reference/ui/pages.md#ui-pages).

The columns of each list, what each record pane shows and what each page deliberately leaves out
are not written down yet. → docs, from the code.

### L58: Ways in

Rules: [ACT-ways-in](reference/access/acts.md#act-ways-in).

Decided on 2026-10-15, from the demo's propose dialog: the ways in beside typing, pasting and a
file. Catalog search with record links for catalogs that cannot be searched, continuous barcode
scanning (a hardware scanner always; the camera through an Input plugin) and photo capture with
candidates to pick from. Each way shows only while its plugin is enabled, auto-detect included.
→ frontend, after the plugins step (Input instances), then engine.

## For the engine

### L21: Identifier formats per installation

Rules: [DOC-identifiers](reference/model/documents.md#doc-identifiers).

Decided on 2026-10-15. Tenancy stays out of scope for the engine and the first backend: one VERA, one library. The
catalog ID, barcode and NBN formats are MZK's and fixed in the code (`TODO(Tenancy)`); they move
into the plugin configuration of each installation. → engine.

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
- **L16:** the delete refusal over a tracked mix stays until tracking goes ([L28](#l28-remove-mix-tracking)).
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

### Built, 2026-10-15

- **L48:** the document's field is `shelfMark`, shown as *Shelf mark*, and a shelf mark is an
  identifier type to propose by, which the catalog adapter resolves
  ([DOC-identifiers](reference/model/documents.md#doc-identifiers),
  [DOC-lines](reference/model/documents.md#doc-lines)).
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

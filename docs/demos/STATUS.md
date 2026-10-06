# Demos — where the work stands

A running record, not a plan: what has been built, which decisions to trust,
which documents have fallen behind them, and the order the work goes in.
Update it when something is decided or finished. Last updated 2026-10-06.

---

## How the work is done

- **The demos are the design.** `docs/demos/{large,notebook,small,phone}/` plus
  `shared/`, and the decision records in `docs/design/shared/`. `app/` is the
  old system; it will be reimplemented from scratch and is **never** a source
  for a design decision.
- **The original demos, `docs/demos/*.html`, stay untouched.** They are the
  reference for look and feel: the sidebar, the dialog style (*Submit
  Proposals* in `proposals.html`) and the type scale were all measured from
  them.
- **Notebook first.** Each page is designed and agreed at `notebook`
  (1440×900, the default tier), then carried to `large`, then `small`, then
  `phone`. Until a page is agreed at notebook, the other tiers of it are
  allowed to lag, and they are not reviewed.
- **Nothing that was not asked for.** No nav groups, dividers or taxonomies.
  *Work / Plan / Operate / Configure* was invented and rejected. When a rule
  needs to pick entries, it picks by position in the list and by what the
  actor holds.
- **Checked by rendering.** `node tools/shots.js`, run from `docs/demos`, must
  end with `0 with problems`. Anything visual is checked with a playwright
  screenshot, not assumed.
- **Ask before changing the sidebar entries.** They affect every page.

## Which source wins

When sources disagree:

1. **What the user said in the conversation.**
2. **`rework.md`.** It is the user's own document. The `>` blocks inside it are
   answers written back into it.
3. **The docs marked *current* below.**
4. **The built notebook demo.**
5. **The docs marked *behind* below.** Read them for background only.

## Documents

| Doc | State | Note |
|---|---|---|
| `design/shared/entities/concepts.md` | current | start here |
| `design/shared/entities/status-model.md` | current | four axes (decision, restriction, validation, progress) plus the cancellation flag. *Eligibility* appears only to say it is retired |
| `design/shared/entities/permissions.md` | current | review decisions carried in 2026-09-30: no group roles, IdP plugin, proposal custody, `iteration.publish` |
| `design/shared/entities/relationships.md` | current | review decisions carried in 2026-09-30: batch, proposal custody, project manager, tracked mixes |
| `design/shared/entities/status-log.md`, `document-identity.md`, `document-properties.md`, `identifier-types.md`, `priority-levels.md` | current | |
| `design/shared/entities/intentions.md` | current | §2.1–§2.5 added 2026-10-01: choosing, switching, editing a shared mix, Categories `?i=`. §3, §5, §6 rewritten 2026-09-26: no `kind`, derived counting, repeats. `relationships.md`, `view-map.md` §2.4 and use case G1 aligned the same day |
| `design/shared/entities/registry-status.md` | mostly | a few passages still say it "feeds eligibility"; read that as *existing copy* |
| `design/shared/entities/proposal-custody.md` | current | new 2026-09-30: custodies with members; *Custody* plugins (jq) place proposals; the fallback; live, union; scopes seeing and deciding |
| `design/shared/entities/identity.md` | current | new 2026-10-01: several Identity plugins at once, each declares its user id claim and its order on the login page; default role and mapping per instance, re-evaluated at login |
| `design/shared/entities/messaging.md` | current | new 2026-10-01: *Message…* hands off to Message plugins (mailto, Slack, tickets) as a redirect; VERA resolves recipients, keeps no text |
| `design/shared/model/workflows.js`, `check.js` | **new 2026-10-02** | every lifecycle as a state machine (11), each step with who, permission, page, demo marker, log and hook; `check.js` proves reachability, no dead ends, that some role holds each permission and can open the page, that the demo has it, and cross-checks hooks, permissions and grants. Drawn in `demos/model.html` |
| `design/shared/filtering.md` | **draft**, awaiting review | new 2026-10-02: one filter (predicates in the URL) drawn from each view's declared fields, at three depths — quick, chips, advanced; watchlists as saved filters, *new* = entered since last opened, a badge on the sidebar entry they watch, a Watchlists page from the foot row. Revises view-rules §2 and navigation §2, §5 |
| `design/shared/entities/plugins.md` | **draft**, awaiting review | Restriction kind added to the data 2026-10-02 (CopyrightRule, pi28), Kramerius split into a registry and a harvester. New 2026-10-01: type → implementation → instance; the descriptor, stable names, VERA calls and writes, triggers, outcomes; one Java interface per kind; a new **Restriction** kind; §6 answers the `TODO(Plugins)` notes, to confirm |
| `design/shared/entities/projects.md` | current | new 2026-10-01: project lifecycle, `project.decide`, the `managed` scope, priority set once at approval; flows PJ1–PJ6 |
| `design/shared/flows.md` | current | new 2026-09-30: one diagram per scenario for documents and lists (67), drawn to the review decisions; projects PJ1–PJ6 and mixes M1–M7 added 2026-10-01 (80 in all). Orange = open. Intentions and proposal custody to follow |
| `design/shared/document-use-cases.md` | current | every use case and the page it lands on (§7) |
| `design/shared/view-map.md` | current | four views: Documents, Proposal Review, Validation, Digitization Lists |
| `design/shared/navigation.md` | current | 12 entries (Schedules added 2026-09-26); §4 updated today to match the notebook bar |
| `design/shared/view-rules.md` | partly behind | the rules hold. The page names and the §1.4 budgets predate the re-cut and have not been re-measured |
| `design/shared/view-catalog.md` | **behind** | still describes My Requests, Additions, Generation and eligibility. Users & Groups updated 2026-09-30 for no group roles; the drawn page is to be redrawn |
| `design/shared/page-composition.md` | **behind** | same. §5 Tasks is current as of 2026-09-26 |
| `docs/README.md` | **behind** | says 14 entries, five stage views, "feeding eligibility" |
| `demos/BUILD.md` | **behind** | says 14 pages × 4 tiers; three of those pages are deleted |
| `demos/notes.md` | the user's notebook | raw ideas. The ones that are done are struck through |

## Decisions to trust

Each is settled. It is not reopened unless the user reopens it.

**From building the frontend, 2026-10-06.** The user's decisions, carried
into `status-model.md` §2, §2.5 and §4, `document-identity.md`, `flows.md`,
`view-map.md` and the permission tables. The demos do not show them yet.
- **No relink.** A document's catalog ID never changes, and `iteration.relink`
  is gone. A record repaired in the catalog is picked up by a re-check. A
  record that no longer exists upstream sets the cancellation cause
  `RecordGone`, shown as *Record no longer exists*: the asker asks for the new
  record, which is a new document.
- **No fixes in VERA for defects.** The Validations pane links to the catalog
  record; the curator repairs it there and presses **Recheck**, beside Accept
  and Deny, which pulls the record again and runs the checks. The page count
  is the one value entered in VERA, and entering it runs the re-check.
- **Accepting one by one** is a pick of the outstanding defects, all ticked to
  begin with, shown only when there is more than one.
- **One Defects card**, in sections divided by a rule: outstanding (with
  Accept, Deny… and Recheck), accepted (with who, when and Revoke) and denied.
- **Revoke is a verdict row**, `Revoked` over the keys it takes back, so the
  verdict table stays append-only.
- **Forbidden is a Yes / No filter**, in Documents (renamed from Restricted)
  and in Validations, apart from the review state.
- **Validations groups** by category and by defect.
- **No Advanced filter.** "+ Add filter" offers every field, ranges included.
  A field added reads *any* until a value is chosen. A date offers *Last 7
  days*, *Last 14 days*, *Last 30 days*, *This month* or a range; a count
  offers its presets (Pages: under 100, 100–499, 500–999, 1,000 and more) or
  a range.
- **No editing descriptive metadata in VERA**, anywhere: `iteration.edit_descriptive`
  is gone. **Recheck** and entering a page count take `iteration.recheck`, a
  curator's within custody.
- **A batch header counts each addition state**, each document once by its
  row's status: *4 awaiting a decision · 2 declined · 1 forbidden · 3 review needed · 1 denied
  in review · 12 being added · 3 could not be added · 28 added* (also withdrawn, cancelled),
  zero parts left out, *40 added* once all is in. A retried or new batch does not read as all
  added, what a gate holds does not read as being added, and the parts add up to the batch.
- **A pending proposal reads *Awaiting a decision***, not *Awaiting review*, on
  rows, asks and batch headers (`status-model.md` §4 row 3).
- **Errors are RFC 9457 Problem Details**, with VERA's `code` (a stable key
  the frontend words and translates) and `errors` (the fields a 422
  rejected). Ranges in the URL stay `from..to`.
- **The catalog link comes from the catalog adapter plugin** (`toLink`,
  `plugins.md` §4.1).

**From the component pass, 2026-10-06.** The user's decisions, carried into
`navigation.md` §3, §3.1, §5, §7 and §8.4, `view-rules.md` §1.2 and §1.5,
`filtering.md` §4 and §5, `permissions.md` and `view-catalog.md` Users &
Groups. The demos do not show them yet.
- **No bottom tabs on the phone.** ☰ before the title opens the sidebar sheet,
  as at small. The page's actions are at the top right. Nothing is fixed at
  the bottom.
- **Phone gestures:**
  - on a page with nothing open, swipe ← → moves to the next or previous
    sidebar entry;
  - on an open record, swipe ← → moves to the next or previous record;
  - Back (the system's, the ‹, or a swipe down on the sheet's head) closes
    what is open;
  - long-press starts picking.
  Neither swipe starts at the screen's edges, which belong to the system's
  Back.
- **Master–detail docks across all of small** (from 768px), as the demos
  draw it. The detail is a sheet only on the phone.
- **A list is a table at 42rem of its own width.** At notebook with the
  sidebar expanded it shows cards, and that stays.
- **Dialogs are full-screen sheets on the phone.** Large keeps its 15px root.
- **Preferences is a page** (`/preferences`, from the user menu): Watchlists
  (the planned `/watchlists` page moves here, with *Shared with me* and
  *Hide*), Display (the sidebar, each view's opening tab, density, dates) and
  Account. Settings are kept per person on the server.
- **Shared watchlists have an audience:** everyone, or groups and roles.
  - Only `watchlist.manage_shared` shares; a group's members get no special
    right.
  - Sharing that reaches someone who keeps the same filter warns rather than
    refuses.
  - *Seen*, the badge, the order and *hidden* are per person, so shared
    watchlists badge too.
  - Shared watchlists are listed in Users & Groups, with a *Watchlists* card
    on roles, groups and users.

**From the outside review, 2026-09-26.** The user's decisions. **Carried into
the design docs on 2026-09-30**: concepts, relationships, permissions,
status-model, status-log, intentions, document-use-cases, view-map, and the
Users & Groups entry of view-catalog. **Carried into the demo data and the
notebook pages on 2026-10-01** (see *Carried into the pages* below). Where
they contradict something below, they win.
- **Distributions are not a visible entity.** The mix belongs to the
  intention. A distribution survives only in the backend, for snapshots
  (history) and for sharing percentages.
  - An intention either has **its own** mix or **tracks** another
    intention's (for example Overall's). **No chains**: an intention cannot
    track one that is itself tracking.
  - Editing a shared mix opens a dialog listing every intention it affects.
    Go ahead, or **detach** this one and leave the others on the old mix.
  - **Designed 2026-10-01** (`intentions.md` §2.1–§2.5, flows M1–M7): a new
    intention tracks Overall by default, or owns a copy of another's mix; the
    picker offers only owners (no chains). Percentages are edited only on the
    **owner**, on Categories (`?i=`, Overall by default). Saving a mix others
    track lists every tracker, ticked; **unticked ones keep the mix as it
    was**: the longest tracker among them owns it and the rest track that
    one. Confirmed: closed windows never recount; a scoped intention dims
    the rest of the tree. A tracker opened on Categories shows its owner's mix with
    *Edit Overall's mix* and *Detach*. An owner that others track can switch
    to tracking only by moving them with it. A scoped intention shows only
    its subtree. All under `intention.edit`; Overall's mix needs
    `intention.edit_overall`, admin only (2026-10-01).
  - Follows from it: Categories picks an intention, not a distribution
    (`?d=` goes); `distribution.edit` goes or folds into `intention.edit`;
    Overall's mix needs its own guard; generation provenance snapshots the
    intention's mix revision.
- **No `group_roles`.** Roles are held directly, or come from the IdP mapping
  below. Groups keep **custody and project membership** only. This reverses
  `permissions.md` §1 and "curator via Periodicals Curators" in the demo.
  Custody of proposals is **proposal custody**, below.
- **Guest is a role.** Roles are assigned through an **IdP plugin** (Keycloak,
  local), with settings such as the default role (guest / none) and a mapping
  from user attributes to roles.
- **Every iteration comes from a request.** A system discovery goes through
  the request path too; there is no "no request" case (fixes `status-model.md`
  §2.5, §3 gate 1).
- **A document with no iteration is not visible anywhere in VERA.** Before
  approval, it is the request that is shown.
- **A request carries a project**, visible mainly in Projects, and also in
  Documents / My Documents.
- **Proposing and adding are always a batch**, one of one if there is only
  one item. The batch carries the reason and, for additions, category,
  priority and *approve now*. There is **one** batch concept: an addition is a
  state of a proposal, not an entity.
- **Projects:**
  - a manager creates it and edits its details and members;
  - a project has a **description**;
  - members may only add and propose documents to the project;
  - states **Proposed / Approved / Rejected**. While Proposed, members propose
    documents to it. A curator approving it picks the priority it gets. Its
    current (or future) proposals take that priority, and approving the
    project approves its proposals;
  - **there is no lock** (2026-09-30, replacing lock / unlock / unlock
    request). Approval covers the proposals that exist at that moment.
    Members may still propose into an Approved project. Each such proposal
    carries a flag, *after the project's approval*, and is **decided on its
    own in Proposals**, with the project's priority pre-filled. A Rejected
    project takes no proposals;
  - the message "channel" became **Message plugins** (2026-10-01,
    `messaging.md`): *Message…* resolves recipients from the record and
    hands off to mail, chat or a ticket, usually as a pre-filled redirect;
  - projects get a **status log**.
  - **lifecycle designed 2026-10-01** (`design/shared/entities/projects.md`):
    approving or rejecting is a new permission, **`project.decide@any`**
    (curator, admin); a new scope, **`managed`** (a project whose manager I
    am), so the manager edits details and members and hands over; the
    project's **priority is set once at approval and never changes**. It
    only sets the priority of the proposals approved with it and pre-fills
    flagged later ones; after that each item's priority is its own.
    Approved and Rejected are final. Decision state (*Proposed · Approved ·
    Rejected*) and period (*Upcoming · Active · Ended*, from the dates) are
    separate. `project.decide` implies seeing projects; a project can be
    deleted only while it has no proposals (`project.delete`). Confirmed 2026-10-01: starting a project needs `project.create`, held
    by staff (not readers); dates and target stay editable after approval,
    with a warning; a removed member's proposals stay in the project;
- **Agent name and entry point are one setting per plugin.** They are not on
  the user record.
- **Kramerius as a harvester is its own Harvester plugin**, not bundled into
  the registry adapter.
- **Validation verdicts are an append-only table** (actor, at, note, keys).
  Defects can be accepted one by one or all at once for a document.
- **`defect_key` uses `plugin_instance_id`.**
- **The decision is stored on the proposal (request).** The iteration the
  pages show is a served view over both, not a stored row. **Restriction is
  kept.**
- **Digitized and Published get movers.**
  - Marking a list **Done** moves its members to Digitized. So *Done* is an
    act, where until now it was derived.
  - A curator inserts or updates the link where an item is available, and
    that makes it Published, under `iteration.publish` (P1 below).
- **Items can be cancelled from a digitization list**, as `status-model.md`
  §2.5 promises. The list page is missing it.
- **Proposal custody** is a new entity (reshaped 2026-09-30,
  `design/shared/entities/proposal-custody.md`):
  - a custody is a **name with members** (users, groups), edited by admins in
    Users & Groups;
  - which proposals are in it is a **property of the proposal**, set by a new
    plugin kind, **Custody**. An instance returns a **list of custody names**
    (empty for none); the general implementation evaluates a **jq**
    expression over the request, the document and the catalog record;
  - several instances union. Evaluated **live**: on proposal, when checks
    finish, when the record or request changes, and over all open proposals
    when any Custody plugin changes or a custody is deleted;
  - deleting a custody a rule still names is allowed: its proposals fall to
    the fallback if nothing else holds them, and the rule warns (2026-10-01);
  - custody, membership, role and rule changes are logged under a new
    status-log subject type, `access` (2026-10-01);
  - a proposal with several custodies is in all of them (union);
  - custody scopes **seeing and deciding**: `request.read@custody` and
    `request.decide@custody`.
- **Ingest starts automatically on an approved proposal.** There are two
  ways: a proposal created with pre-approval (a person's *approve now* or a
  plugin's `additions` entry), or a curator approving someone's proposal. It
  is never a manual task.
- **A behind-pace target gets a catch-up Generate**, pre-filled with the pages
  it is short, like the tracking card's *Generate correcting list*.
- **Cross-page links land on the record.**
  - Documents search covers catalog ID, unit ID and iteration ID. A link to
    a single document uses that search.
  - Documents gets a **project filter** and **group by project**.
  - Intention repeats get a deep link (template or occurrence), used from
    Schedules and the Tasks trigger.
  - Intentions → Categories links with `?i=` (replaces `?d=`).
  - Links to a plugin instance pass Plugins' instance parameter, so that
    instance's details open.
  - Home is updated later.
- **Reader does not hold `task.read_own`.** A reader has one entry again, *My
  Documents*, so Home redirects to it as `navigation.md` §8 says. This
  reverses the Users & Groups note above ("a reader now sees My Tasks").
- **The demo's seeded users get direct (or IdP-mapped) roles**, since
  groups no longer give roles. Jana, Martin and Eva hold theirs only through
  groups today.
- **A curator sees the list an item is on**: its name and dates, without
  `list.read`.
- **The list editor says what review is holding back**, for example *N more
  in Periodicals are waiting in review*, so a dig-curator can see why the
  pool is short.
- **`request.decide` takes a scope: `custody` · `any`.**
  - At `custody` it resolves through **proposal custody** memberships, the
    same way `validation.*` resolves through category custody.
  - The shipped curator holds it at `custody`, admin at `any`.
  - **Fallback custody** (2026-09-30):
    - exactly one proposal custody, marked *fallback*, which no plugin names,
      catches **only** proposals every plugin left without a custody;
    - it exists from installation and cannot be deleted;
    - admins edit its members, who decide what lands in it at `custody`;
      with no members, only `@any` holders see those proposals;
    - the row shows *fallback*, so an admin can tell when a plugin's rule
      should reach further.
  - This reverses "`request.decide` has no custody scope" and "No routing"
    under Proposals below.
- **One permission for hooks.** `hook.configure` covers both editing a hook
  and acting on its deliveries (Retry, Discard, Send now).
- **Withdraw only while undecided.** A request can be withdrawn only while it
  is Pending. So the "tracked work abandoned → shadows revert to Pending"
  path and "cancelling a request cascades" (`status-model.md` §2.5, §2.7)
  have nothing to trigger them.
- **`Ready` means every gate passed and the item is waiting to be digitized.**
  An item that fails a gate is never Ready, including one returned from a
  deleted list. It goes back to Enqueued (V14 below).
- **Forbidding is done only by rules (plugins), never by a curator.** This
  removes `iteration.forbid`, use case C7, and the *Forbid…* actions on
  Documents and Validation. Overrule stays admin-only.
- **A listed item that gains a blocker stays on its list, flagged.** This
  holds for Planned and In-progress lists alike. The list and the editor
  show it, and the dig-curator decides whether to take it off.
- **There is no "Delete addition"** (`addition.delete`, use case A4). A
  failed ingest can only be retried.
- **Could not be digitized is set per item on a list**, with a message, by a
  dig-curator. Marking the list **Done** moves every member *not* so marked to
  Digitized.
- **Planned counts only items on a list that still exists**, in Projects as
  in Intentions. A deleted list's items stop counting. This reverses "pages
  whose list was later deleted still count" under Projects below.
- **No *Watch* button on a document.** Remove it from the Documents pane.
- **Reclassify stays on both Documents and Validations.**
- **Flows answered, 2026-09-30** (see `design/shared/flows.md`):
  - **D11:** a project's approval **skips** proposals carrying an existing
    copy. Each is decided on its own as a rescan.
  - **D12:** a rejected project's requests are rejected. If a document had
    only the project's request, it is declined. If others asked for it too,
    only the project's request is rejected and the others stay. If the
    rejected request was the one the others followed, the oldest remaining
    becomes the originator.
  - **V12:** a restriction a re-check no longer finds is **cleared**, and
    logged.
  - **V13:** a curator **may** reclassify an item into a category outside
    their custody, handing it over.
  - **V14:** an item that fails a gate after Ready goes **back to
    Enqueued**, and returns to Ready when the gate clears.
  - **L10:** moving an unfinished list's dates **warns** before Save when it
    stops counting towards an intention.
  - **L16:** a Done list **cannot** be deleted.
  - **P1:** entering or changing the link that makes an item Published is a
    new permission, **`iteration.publish`**: curator at `custody`, admin at
    `any`.
  - **L17:** a copy **can** appear after approval. The warning stays
    (`registry-status.md` §10).
- **A curator cannot move a category out of their own subtree.**
  `category.edit@custody` moves a node only within it.
- **Validation gets a *Forbidden* filter.** Any reviewing curator can choose
  it. They cannot act on a restriction, but they can message an admin (see
  the "channel" idea under Projects).

**Model**
- Four stored status axes and one derived badge. **Eligibility is retired**:
  a prohibition, a defect and an existing copy are three different things.
- `Ready` replaces `Planned`. `Planned` is kept for future-dated lists.
- **A proposal and an addition are not separate things.** Each is a name for
  where a request currently is. An addition is a proposal approved at the
  moment it is made.
- **A rescan is a curator's decision.** It is the one decision that no shortcut
  makes: not *approve now*, not a plugin, not bulk approve.
- **One decision covers every asker of a document.** Proposing something that
  already exists attaches you to that work. It is not a duplicate error.

**Pages**
- **Four views.** Documents (labelled *My Documents* for a reader), Proposals,
  Documents Validations, and Digitization Lists (browse plus one editor;
  *Generation* merged in).
- **My Requests, Additions and Generation are deleted.** Ingest that failed is
  the status *Could not be added* in Documents, grouped by batch.
- **Master–detail is the primary shape.** At notebook and large, the list half
  reads as a table: a **50/50 split**, aligned columns, and the extra data in
  the pane.
- **Propose is one dialog**, with the steps Items → Details → Submitted.
  - One list, filled any way: typed, catalog search (several catalogs; one
    that cannot be searched from VERA is opened in a new tab and the link
    pasted back), pasted list, file upload, barcode (continuous) and photo.
  - Each item is checked against the catalog first, then against VERA.
  - Barcode, photo and auto-detect in a pasted list each require their
    *Input* plugin.
  - Without `request.decide`, at most `propose.max_at_once` items per
    submission.
- **Dialog and button style follows the original demos.** That means
  `rounded-xl`, `p-6`, numbered steps joined by lines, `rounded-lg` controls,
  and Back on the left with Next on the right.

**Proposals** — built 2026-09-25, not yet reviewed by the user
- One row per document, oldest ask first, in the same 50/50 table as
  Documents. Declined and Withdrawn sit behind the *Show* filter.
- Grouping is optional: none (the default), by batch, or by requester.
  - A **batch** is one submission of several items, whichever way it was
    filled. It gives context for review but is never the unit of decision.
  - A document asked for in several batches is one row, listed with its
    earliest ask. The other batches say so.
- **Bulk approve lives on the batch header.** One category and one priority
  apply to everything it covers, and you can untick items. It skips rescans
  and anything still being checked, and lists them as left out. There is no
  bulk decline.
- The pane's decision card:
  - Approve waits for a category, since nothing downstream works without one.
  - A copy turns Approve into **Approve as rescan**, which requires a note
    on why.
  - Decline takes the text every asker reads, plus an optional internal note.
  - While the checks are still running there is no decision at all.
- **`request.decide` has no custody scope** (`permissions.md`). Custody
  starts at the category chosen at approval.
- **No routing.** Everyone holding `request.decide` sees and decides every
  proposal, and may approve into any category. A proposal has no category
  yet, so custody cannot place it. A curator narrows the queue with a
  **watchlist**, for example the seeded *Periodicals* (Material type:
  Periodical). *Save as Watchlist* saves exactly the chips on the filter bar,
  and the count is opt-in.

**Documents Validations**: built 2026-09-26, not yet reviewed by the user
- One row per **iteration** a defect holds, in the same 50/50 table. The
  default is *Review needed*, most urgent first, then longest waiting.
  *Denied in review*, *Accepted* and *Everything* sit behind the *Show* filter.
- **Scope is custody.** An iteration has a category, so a curator's
  `validation.*` at `@custody` places it. This is unlike Proposals. An admin
  sees every category.
- The pane shows **D \ A** only. Each outstanding defect gives its internal
  text and what askers read, plus its **fix in place**:
  - *Enter page count…*;
  - *Correct 260$c…*, an edit made in VERA;
  - *Relink…* for *no catalog record*.
  A fix re-runs the checks and needs no verdict. It leaves the set you accept.
- **Accept** takes the outstanding set, with an optional note. **Deny…**
  picks which defects are substantial, and the text askers read follows the
  pick. Defects already accepted sit in their own card, with who and when,
  and with **Revoke**.
- A denial lapses once its defect is gone, so a denied item shows its fix.
- A defect found after digitization (C10) reads *Published · review needed*.
  It has no fix in place, and progress never moves back.
- More ▾ holds Reclassify, Forbid… and Cancel…, each a dialog with its
  reason. There are **no bulk verdicts**.
- Watchlists here filter by *Defect* (plugin) and *Category*. The seeded ones
  are *Page counts* and *Denied in review*.

**Digitization Lists**: built 2026-09-26, not yet reviewed by the user
- **One page, three surfaces**: browse (`lists.html`, `?list=` opens one),
  new (`?new`) and edit (`?edit=`). New and edit are **one editor**. *New
  list* needs `list.create`, *Edit* needs `list.edit`, *Delete* needs
  `list.delete`, and each is absent without it.
- **Browse** is the same 50/50 table: List, State, Runs, Items, Pages,
  Delivered. The default is *Planned and running*, with *Done* and
  *Everything* behind the *Show* filter. The pane shows planned against
  delivered, the members, *Counts towards* (derived, pages per intention —
  changed with Intentions), what it was generated with, the mix, and the history.
- **State is derived from the date**, never written: Planned before
  `starts`, In progress from that day, Done once every member is digitized.
  The demo's today is 25 Jun 2026 (`VERA_DATA.today`).
- **Delete…** is a dialog that counts what happens to the members: returned
  to the pool as Ready, digitized ones keep their status, cancelled ones stay
  held. It is offered even when members are digitized, because a written
  value wins (status-model §2.6). No reason is asked.
- **The editor** keeps the list on top: name, *Starts now* or *Starts on*
  a date (Planned until then), ends, *Counts towards* read-only (was: intention
  chips with one marked *shapes it* — replaced with Intentions), pages against a
  target, and the mix, read against a pickable intention. Under it, two panes: *On this list* and *Ready to
  list* (every gate passed, on no list), each with checkboxes and bulk move.
  The pool filters by category and search, and says what is Ready but held.
- **Everything is a draft until Save**; the top counts *+N −M since opened*.
  Taking an item off returns it to Ready, with no reason.
- **Generate…** is in the left pane's head, and absent when no list
  generator is configured (`?generators=none|one` shows the other states).
  The dialog asks for pages (required), categories (optional, all if none)
  and intentions (one marked as shaping it, Overall by default). Several
  generators get a picker labelled *rule-based* or *AI-based*.
  - The result pre-fills the left pane, each pick marked *generated* with its
    reason. Current members stay fixed; it tops up.
  - A report goes in the top strip: picked pages against the target, the
    tolerance, what was re-spread, and which categories are short or
    unallocated, with why.
- A copy that appeared after approval is flagged on the row wherever the item
  could be listed, and in the top strip once it is on the list.
- Demo data: two list-generator plugins (*PriorityFirst*, rule-based;
  *ShelfAdvisor*, AI-based), a fourth list (empty, November) and 14 more
  iterations, as list members and pool supply. Maps has no supply, on
  purpose.

**Projects**: built 2026-09-26, not yet reviewed by the user
- **Not master–detail.** The user noted few projects are active at once, so
  the index is **cards** for the active and upcoming ones (two per row at
  notebook), and a compact **Ended** table below. The detail is its own page
  (`projects.html?p=ID`). A card or a table row opens it.
- **State is derived from the dates**, never stored: Upcoming, Active, Ended.
  The old demo's Proposed/Approved/Rejected and P1–P4 are gone; the design
  docs do not have them.
- **Each card has three bars against the target**: Time elapsed, Planned,
  Delivered. The planned and delivered bars carry a mark for where an even
  pace would be by today.
  - *On pace* means delivered is within 10 points of the time elapsed;
    otherwise *Behind pace*. A project with nothing funded yet gets no pace.
  - Ended projects read *Target met* or *N% delivered*.
- **Planned** counts every funded page that has been on a list, so pages
  whose list was later deleted still count. **Delivered** counts the digitized
  ones. Delivered is part of planned, and the two are never added.
- **No intention yet** (agreed with the user): the card shows the bars it
  has plus an amber *No intention yet — Create one* line. An ended project
  without an intention gets a plain note instead of the prompt.
- **Detail**: a status note with the pace in words, the bars, Intentions
  (those funded by it, each with its own planned and delivered, counted by
  the shared intention rules), Lists carrying its items (deleted ones shown as *no longer exists*),
  What it funded (iterations), Members, History. No mix.
- **New project**, **Edit** and **Members** are modals. They need
  `project.create`, `project.edit` and `project.manage_members`, which
  dig-curator now holds, per permissions §4 (`project.*@any`).
- Demo data: targets rescaled to the demo's page counts (thousands, not
  hundreds of thousands), and projects carry real dates. Added: an upcoming
  project with no intention, three ended ones with 7 published documents,
  the intention *Moravica — closing year*, and project history entries.
  L-2026-012 now also counts towards the new intention. Intention targets
  were adjusted to match.

**Categories**: built 2026-09-26, not yet reviewed by the user
- **Tree on the left, detail on the right** (the user rejected a full-width
  tree table). The selection is in the URL (`categories.html?c=ID`); no `c`
  opens *All categories*. The distribution selector sits in the topbar.
- **Show picker** (the user's idea) chooses the number each tree row carries:
  Share of parent (default), Of the whole, Intended vs actual, Documents,
  Pages, Ready. Remembered per viewer. The distribution selector greys out
  for the three count options. Branch rows total their leaves for counts.
- **⚠ on a parent whose sibling set is under 100** stays whatever the pick.
- **Intended vs actual** compares *of the whole* with the share of all
  delivered pages; ▲/▼ appear outside **±5 points** (the user set the band to
  ±5 on 2026-09-26, the same as Intentions). Actual is my addition
  (intentions §3.1 says output is measured against the Overall mix).
  `categories.html?d=ID` picks the distribution (Intentions links with it).
- **All categories is a virtual root, not a stored category** (agreed with
  the user). It has totals, the top-level proportions, *Needs attention*
  (unallocated sets in every distribution, and branches nobody holds
  custody of) and *+ Top-level category*. No share, no documents, no custody:
  custody over everything is the `any` scope, granted in Users & Groups.
- **Detail**: numbers; children's proportions with actual (branches) or the
  documents here (leaves); custody granted here and who it reaches, with
  provenance. *Open in Documents* links to Documents filtered to that subtree
  (`documents.html?category=ID`, new, with a removable chip).
- **Modals**: Edit proportions (one sibling set; empty = no share, 0 =
  excluded; over 100 cannot be saved; names the intentions it affects), Grant
  custody (groups and people), Edit (rename, move), + Child category, Delete.
- **Refine** is a two-step wizard in the pane (`?c=ID&refine=1`): name, then
  what moves. The new child takes 100% of the leaf's share in each
  distribution, otherwise the branch would drop out of generation. My choice.
- Rules I chose, the docs are silent: a new or moved category starts at 0%
  in every distribution (intentions §1.1.1); **Delete** only for a leaf with
  no documents; a category cannot move under a leaf that holds documents.
- Permissions: curator now holds `category.edit` and
  `category.grant_custody` (at custody: Jana only within Periodicals);
  dig-curator holds `distribution.edit`. Per permissions §4.

**Intentions**: built 2026-09-26, not yet reviewed by the user. The model
was worked out with the user first; `intentions.md` §3, §5, §6 rewritten to it.
- **No `kind`. An intention is scope + objective**: funding (any / no project /
  a project), **one** category subtree, a mix, an optional page target, a
  counting start and an optional end. Overall is a protected flag.
- **Nothing is attached.** An item counts towards every intention whose scope
  it matches, when its list **starts** inside the window. A project's items
  also count towards category intentions and Overall. Figures overlap and are
  never added. The counting rules live once, in `vera-data.js`
  (`intentionCount`, `countsTowards`, `shareWithin`), used by Intentions, Lists
  and Projects.
- **Every intention is time-based**; the counting start is **locked** once
  created (may be future). To count from another date: *make a new intention
  from this one*. Editing scope or end recounts the whole window and the
  dialog shows the change first.
- **Planned / delivered = plan completion** (target cards). **Output** = all
  digitized in the window (tracking cards and Overall). My defaults, the user
  did not object.
- **Scoped mix** reads from the scope node down (*Mix within Periodicals*),
  not rescaled.
- **Repeats are core, not a plugin** (the user): a template makes monthly /
  weekly / quarterly occurrences, each its own intention; *archive previous*
  only hides. `intention.repeat`, admin only by default.
- **Layout: two columns of cards** — *Targets* and *Tracking* (the user liked
  the original demo's cards; three columns became two once target-without-date
  became time-based). Each column: running → Upcoming → Ended ▸ → Archived ▸,
  and a tile that **counts intentions**, never pages.
  - Target cards: time / planned / delivered bars with the pace mark, *On pace*
    / *Behind pace* (the Projects wording and 10-point slack), *Fully planned*,
    *Target met*, *Ended — N pp short*, *needs N pp/week*.
  - Tracking cards: intended vs output stacked bars, drift per category with
    the ±5 band, *Excluded category used*, unallocated flagged, *No output yet*.
  - Expand for per-category fill (targets) or planned / output mix (tracking).
    `intentions.html?i=ID` opens and scrolls to one; Projects links with it.
- **Generation:** *Shape by* one intention (Overall default; a card's
  *Generate* preselects it). It supplies the scope and the mix. Dropped my
  "furthest behind" default.
- **Generate correcting list…** on a tracking card that is out of band: a
  dialog shows the allocation *before* generating — per category the intended
  share, output now, the new pages, the share after, and what is Ready. Each
  category gets what it lacks against its share of (output + new pages), cut in
  proportion when the gaps exceed the pages. Supply the pool cannot cover stays
  **short** and is said so; the generator does not re-spread it. Lists takes it
  as `?alloc=` (shape locked, pages fixed, *use its plain mix instead* to drop
  it), reads the fill against it, and records it in the provenance.
- **Lists:** *Counts towards* is computed and read-only, pages per intention.
  A generated list records provenance (`generated`: intention, mix, pages,
  generator). The editor warns when a list will not count towards the
  intention it was generated with (starts outside its window).
- Permissions: dig-curator holds `intention.edit`; admin `intention.repeat`.
- Demo data: intentions rewritten to the new fields; added a repeat (*Monthly
  output*) with June running and May auto-archived, *June catch-up run*
  (ended, met), *Periodicals push — watch*, *Unfunded work — 2027* (future
  tracking), *Maps watch* (archived). Moravica's target lowered to 800 so one
  card reads *On pace*.
- **Small and phone**: a *Targets / Tracking* view switch (`?col=track`), one
  column at a time. Large keeps the two columns. Not reviewed — notebook first.
- Docs aligned: `intentions.md` §3–§6, `relationships.md` §2 (funding and
  category scope, generation provenance, no `list_intentions`), `view-map.md`
  §2.4 editor and generate, `document-use-cases.md` G1.

**Tasks**: built 2026-09-26, not yet reviewed by the user
- **Two sidebar entries** (the user's request, 2026-09-26, replacing the two
  tabs agreed earlier the same day): **Tasks** (`tasks.html`, the runs) and
  **Schedules** (`schedules.html`, rail `Sc`, needs `task.read`), placed right
  after Tasks. One script draws both: `PAGE_TASKS(tier, 'schedules')`.
  *Running* is not a tab. Running runs are cards with progress at the top of
  Tasks, and finished runs are the table below.
- **Runs:**
  - tiles: Running, Failed in the last 7 days, and Next run;
  - the running cards show errors so far, time left, and Cancel;
  - the finished table has What, Trigger, Started, Took and Result. Result says
    what the run changed and links to it. A failed run gets the red note with
    *Run again*;
  - filters on State, Trigger, Plugin and Started by are real, and chips can be
    struck off;
  - a row opens a drawer (`?run=ID`) with the trigger, the items (All / Errors),
    what it changed, the log, and Cancel / Run again / Download log.
- **States:** Running, Done, Done with errors, Failed, Cancelled, Skipped.
  *Skipped* is an overlapping run on a schedule set to skip.
- **No Delete** (the user agreed). Runs expire under a retention setting: 90
  days, and a year for failed and cancelled runs. *Change…* needs
  `task.schedule`.
- **Schedules are edited only on Schedules** (the user's decision).
  - Plugins shows an instance's schedules read-only, with a link to Tasks. An
    instance's own `schedule` field now holds only its triggers (on ingest, on
    demand).
  - Schedules has a 24 h / 7 days / Month timeline (the user asked for the
    month): a dot per run, a band when runs are too dense to show, and
    hatching when paused.
  - Below the timeline is the table: Runs, whether it skips or waits when still
    running, Last run, Next, and *Run now* / *Pause…* / *Edit*.
  - The editor has Repeat (every N min, every N hours, daily, weekly, monthly),
    what to do when the previous run is still going, and a preview of the next
    3 runs. The shortest interval is 5 min. It can also delete a schedule.
    Pausing asks for a reason, which is shown on the row.
- **Intention repeats are listed on Schedules** with *Edit on Intentions*. Their
  definition stays on Intentions (`intention.repeat`). *Not confirmed with the
  user.*
- **Reach** (the user's decision):
  - `task.read_own` is enough for the entry. Without `task.read` the page is
    *My Tasks* (the same rule as My Documents). It shows only the runs the user
    started, and there is no Schedules entry.
  - Staff roles now hold `task.read_own` instead of `task.read`.
  - The sidebar's running panel uses the same scope at every tier.
  - Whoever started a run may cancel it or run it again. *My choice, not
    confirmed.*
  - New permission `task.schedule` (admin) for editing schedules. *Run now*
    needs `plugin.run`.
- **Data:** `tasks` are runs with a trigger (schedule, manual or repeat), a
  `by`, items, errors and changes. `schedules`, `SCHEDULABLE`, `now`
  (2026-06-25 10:40) and `taskRetention` are new.
- **Docs aligned:** `permissions.md`, `page-composition.md` §5,
  `view-catalog.md` Tasks and Schedules, and `navigation.md` §1, the rail codes and §6.
- Phone shows runs and schedules as cards and the tiles as one line.

**Users & Groups**: built 2026-09-26, not yet reviewed by the user
- **Redrawn 2026-10-01** (the user asked, after group roles went): columns
  are now **Roles · Users · Groups and proposal custodies**, the user in the
  middle. A role line is solid by hand, dashed when mapped by an Identity
  instance. Users show *Signs in with* (identities) and *No access yet*;
  proposal custodies are a record of their own (members, who decides,
  which rule names it, fallback). *New user* became **New local account**;
  *Link identity…* added. Phone gets four tabs and one *New…* button. The
  older bullets below describe the first build; where they mention groups
  giving roles, they are superseded.
- Data (`vera-data.js`): groups lost `roles`; users got `mapped` and
  `identities`; Jana, Martin, Eva and others get their roles from MZK
  Keycloak mappings; a new user with no role (Adam Kolář); proposal
  custodies; Identity, Custody and Message plugin types. Permissions and
  the five roles now follow `permissions.md` (no forbid, no
  `addition.delete`, no `distribution.edit`; `iteration.publish`,
  `project.decide`, `project.delete`, `managed`, `intention.edit_overall`;
  reader without `task.read_own`). Categories edits the mix with
  `intention.edit`.
- **One view with three linked columns** (the user chose this): Users, Groups
  and Roles, with the selected record underneath.
  - Selecting anything highlights what it's connected to and dims the rest.
    Tags show *member*, *gives*, *direct*, or *via Periodicals Curators*.
  - Lines are drawn in the gutters. A direct user → role grant is a dashed arc
    over the Groups column.
  - `?u=`, `?g=` and `?r=` select a record. Phone switches between the columns
    with tabs.
- **User record:**
  - roles and how each one is held; "held two ways is not a conflict";
  - groups;
  - custody and projects, read-only;
  - every permission with its scope and the role and group it comes from.
- **Group record:** "Adding somebody here gives them …", members (and what else
  they hold), the roles it gives, custody and projects.
- **Role record:** who holds it and how, the groups that give it, "includes
  everything staff has", and its grants grouped with the scope.
- **Roles are editable** (the user's decision), shipped ones included.
  - The editor sets a scope per permission (a select for scoped ones, *own* for
    self-scoped ones).
  - Before you save, it lists the changes and who they reach.
  - It refuses to leave nobody holding `access.manage`.
  - Roles can also be duplicated, created, and deleted. The delete dialog says
    what each holder keeps.
- **Users are a person or an agent** (the user's decision). The *guest* kind
  is gone: u6 and u7 are persons, and Documents no longer shows a guest badge.
- **Custody is edited only on Categories** (the user's decision). Here it's
  shown with a link to the node.
- **Data:**
  - New tables: `PERMISSIONS` (the catalogue: group, accepted scopes, a line
    each), `roles` (grants as `[permission, scope]`) and `categoryMembers`.
  - Users and groups changed. Jana is curator only via Periodicals Curators.
    Kateřina is curator both directly and via the group. Eva is staff via
    Reading Room. Radek is new.
  - **The shell now derives each role's permissions from `roles`**, which
    removes the separate list in `vera-ui.js`. As a result `reader` holds
    `task.read_own` as permissions §4 says, so a reader now sees **My Tasks**.
- Docs: `view-catalog.md` Users & Groups and `permissions.md` §4.

**Plugins**: rebuilt 2026-09-26, not yet reviewed by the user
- **One data table grouped twice** (the user's idea):
  - **type** rows (the job; they collapse) → **implementation** rows (name,
    version, description, and chips for what it supplies, with *New instance*)
    → **instance** rows;
  - instance columns at notebook: Instance, Configuration, Runs, Last run,
    state. Large adds Linked to.
- **Drawers:**
  - an implementation opens its contract: tiers, mapping, agent, rules,
    identifiers, class, its instances, and *Upload a new version…*;
  - an instance opens its configuration, when it runs (with a link to
    Schedules), recent runs from Tasks, what it supplies, and Run now / Edit
    configuration / Disable / Delete.
- **Disable and Delete say what stops, per type.** For example: "the last
  generator — the Generate button disappears", or "can no longer be searched
  when proposing". Delete removes the instance's schedules too. Its runs stay.
- Filters Type and State work. Search covers implementations, instances and
  configuration.

**Hooks**: rebuilt 2026-09-26, not yet reviewed by the user
- **Master–detail** (the user's decision).
  - The list is grouped by what the event is about: Requests, Documents,
    Records, Lists, Tasks. Rows show the channel and recipient, the event and
    filter, a 7-day sparkline, and the state. A row with deliveries that gave up
    carries a red line.
  - **The detail opens with the deliveries that gave up** (Retry, Retry all,
    Discard…, and what it tried to send). Next come the ones **waiting to
    send** (Send now), then Subscription, What it sends (a preview per
    interface, public wording only), and Deliveries.
- **Outbound only** (the user agreed). Data hooks are gone: stamping a page
  count on ingest is the plugin's "on ingest" trigger.
- **Delivery channels are plugins** (the user's idea). There's a new type,
  *Delivery channel*, where each implementation provides one interface:
  - email: SmtpMailer (MZK SMTP) and MailgunMailer (Mailgun — requesters);
  - chat: SlackNotifier and TeamsNotifier;
  - webhook: HttpWebhook, which signs;
  - file: SftpDrop.

  A hook picks a channel instance plus a recipient. On Plugins, a channel
  instance lists the hooks sending through it, and disabling it says which
  hooks stop.
- **Wait for more** (the user's idea): wait N min after the last event (the wait
  restarts), never longer than M, then send one message per recipient or one
  for everything. H-02 has 3 decisions waiting for 2 requesters, and its
  preview shows the combined mail.
- **Retries are set per hook** (the user's decision): attempts, and a fixed or
  growing wait. The text spells out the actual waits.
- Events: `HOOK_EVENTS`, taken from status-log §3 plus task runs. Behind pace
  and out of band are *not* events; a watchlist covers those.
- Editor: name, event, filter, channel, recipient, message with placeholders,
  timing, retries, and *Send a test*.

**Shell (sidebar)**
- 12 entries in one flat list, in this order: Documents, Proposals, Documents
  Validations, Digitization Lists, Projects, Categories, Intentions, Tasks,
  Schedules, Users & Groups, Plugins, Hooks. The first four follow the
  pipeline.
- The rail is **two letters, no icons**: `Do Pr DV DL Pj Ca In Ta Sc UG Pl Ho`.
- An entry the actor cannot reach is absent, not disabled. No entry has a
  count.
- Logo → Home. The toggle is a row inside the bar. The preference is stored
  per device, per tier. Large defaults to expanded, notebook to the rail.
- Hovering the rail expands it as an overlay after a 200ms delay, and it closes
  at once. It stays collapsed after navigating until the pointer leaves.
  Keyboard focus also expands it.
- After a rule at the foot, in order:
  - **Watchlists**: one row opening a popover, grouped by view, each row with
    its count.
  - **Running tasks**: a panel with progress bars that goes to Tasks. It is
    absent when nothing runs.
  - **The user menu**: one popover with Preferences and Change password, and
    Sign out below a rule.

**Tiers**
- A tier is a **display**, not a breakpoint.
  - notebook: 1440×900 at 16px
  - large: 1920×1200 at 15px
  - small: 1024×768 at 16px
  - phone: 393×852 at 16px
- Small and phone are shown inside a device frame when the window is bigger
  than them.

**Home**
- `/` resolves:
  - no entries: a fail-closed line;
  - one entry: a redirect;
  - two or more: cards, one per entry, in sidebar order.
- A card has three lines. It shows a number only when that number is work
  waiting for you.

## Carried into the pages, 2026-10-01

Every page in every tier and as every role renders without errors or sideways
scroll. Not yet reviewed by the user.
- **Projects**: decision (*Proposed · Approved · Rejected*) and period as two
  badges; manager and description on the card; *Approve…* (picks the
  priority, lists what it approves and the copies it skips) and *Reject…*
  (reason required, says what stays with other askers) for `project.decide`;
  the scopes `managed` and `project` really resolve (staff see the projects
  they are on); *Delete…* only while empty; dates and target warn on an
  approved project; manager handover in Members; a *Rejected* table; every
  change logged. Data: p4 and p8 Proposed, p9 Rejected, the rest Approved
  with a priority.
- **Proposals**: `request.decide@custody` resolves through proposal-custody
  membership (Jana sees Periodicals and 19th-century prints, not Moravica or
  the fallback); a *Placed in* card; filters by proposal custody and project;
  a project chip and *after the project's approval* on rows, the project's
  priority pre-filled; *Message askers…*; `?doc=` opens a record.
- **Documents**: no *Watch*, no *Forbid…*, no *Delete addition*; the search
  runs (`?q=`, catalog ID, unit, iteration ID whole); a project filter and
  *Group by project*, for My Documents too; *Set where it is available…*
  under `iteration.publish`; the list's name and dates without `list.read`;
  a project in Propose → Details, for projects I am on and not Rejected.
- **Validations**: no *Forbid…*; a *Forbidden* filter, where a curator can
  only *Message admins…*; reclassifying outside custody hands it over (V13).
  Data: IT14 forbidden by a Copyright rule.
- **Digitization Lists**: *Mark Done…* is an act; *Could not be digitized…*
  and *Cancel…* per item; an item blocked after listing stays on, flagged
  (IT25); a Done list cannot be deleted; deleting sends blocked items to
  Enqueued (V14); the editor warns when new dates stop it counting (L10) and
  says what review holds back.
- **Intentions**: the mix field is *Track [owner]* or *Own mix, copied
  from*; an owner with trackers switches only by moving them; a catch-up
  *Generate* pre-filled with the pages behind pace; repeats have `?t=`.
- **Categories**: picks an intention (`?i=`, *Mix of*), not a distribution;
  a tracker shows its owner's mix with *Edit [owner]'s mix* and *Detach*;
  percentages only on the owner, Overall's only with `intention.edit_overall`;
  saving lists the trackers, unticked ones keep the old mix (longest one
  owns it); a scoped intention dims the rest; actual is the intention's own
  output.
- **Tasks**: ingest is *On approval*, never started by hand; links to a
  repeat and a plugin instance land on it.
- **Shared**: `U.message` (the Message plugin dialog) and `U.scopesOf`;
  split pages open a row from the URL; the phone topbar wraps.
- **Home and the demo index**: updated the same day (see the page table).
- **Still stale**: *Reclassify* and the other More items on Documents are
  labels without dialogs, as before.

## Page status — notebook

| Page | State |
|---|---|
| Sidebar | **done** as of 2026-09-25: the entries, the user menu, watchlists limited to the actor's views, tasks linking to Tasks, and no jumping under the pointer. The same changes are *not* yet made at large, small or phone |
| Documents | **done**: the merged page, the table layout, and the Propose dialog in the original style |
| Home | **updated 2026-10-01**, awaiting review. A card per one of today's 12 entries; each count is the linked page's own (proposal custody, category custody, lists ended and not marked Done, projects waiting for a decision, people with no role, undelivered hooks); *You have no access yet* for an account with no role (`?grants=none`) |
| Proposals | **done**, awaiting review. Covers C1 and C5. See the Proposals decisions above |
| Documents Validations | **done**, awaiting review. Covers C3, C4, C7 and C10. See its decisions above |
| Digitization Lists | **done**, awaiting review. Covers G1, G2 and G3. See its decisions above |
| Projects | **reworked 2026-10-01**, awaiting review. Decision and period, Approve / Reject, manager, delete while empty. See *Carried into the pages* |
| Categories | **done**, awaiting review. Tree plus detail, Show picker, virtual root. See its decisions above |
| Intentions | **done**, awaiting review. Two columns of cards, derived counting. Lists and Projects changed with it. See its decisions above |
| Tasks, Schedules | **done**, awaiting review. Two entries, My Tasks for `task.read_own`. Plugins' schedule display changed with it. See its decisions above |
| Users & Groups | **redrawn 2026-10-01**, awaiting review. Roles · Users · Groups and custodies; identities; no group roles. See its decisions above |
| Plugins | **done**, awaiting review. Type → implementation → instance table. See its decisions above |
| Hooks | **done**, awaiting review. Master–detail, delivery channels as plugins, wait-for-more. See its decisions above |
| `index.html` (demo index) | **updated 2026-10-01**: twelve pages, the shapes as built, row texts and *What to look at first* rewritten for the review decisions |

## Open questions

These are waiting for the user.

- Should the page-level buttons (*Propose*, *Ask for this too*, *Watch*) also
  take the original style, like the dialog?
- Should the table-in-master-detail layout go to other list pages: Proposals,
  Validations and the entity pages?
- In the photo tab, should *None of these* prefill the catalog search with the
  text read from the photo?

## After notebook

These are carried, not scheduled.
- Carry the sidebar and Documents to large, then small and phone.
- Bring the docs marked *behind* up to date: view-catalog, page-composition,
  README and BUILD.
- Re-measure the view-rules §1.4 budgets against what was built.

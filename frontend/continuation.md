# Frontend continuation guide

**Watchlists and notifications handoff (2026-10-12):** Follow
`docs/design/shared/entities/watchlists-and-notifications.md`. The frontend
has a `/watchlists` management page, per-person entry badges and delivery
choices, Preferences → Notifications, and a limited email-link preference
page. MSW simulates Hook suppression and watchlist email/chat outboxes.
The real backend still needs durable membership events, a batching worker,
actual transports, and server-side signed links. Do not treat the browser
outboxes or timer as production delivery. The older Watchlists/Preferences
directions lower in this file are superseded.

**Intentions/mixes handoff (2026-10-08):**
`docs/design/shared/entities/intentions-mixes-redesign.md` now records the
implemented core and remaining proposals. Independent `/mixes` records have
names, Primary, immutable revisions, snapshots, editable copies, and archive.
Intentions have optional mix selection; project intentions start with no mix,
and generation for them uses priority then request age. Intention Archive
captures its displayed result, mix revision/tree, and category labels in mock
memory. Overall output is separate from Primary. `/intentions` now has one
board with Repeats, Running, Upcoming, Ended, Archived sections, a two-column
notebook grid, a Type filter for disjoint Targets/Output/Repeats, search, and
shared watchlist tabs. Type, State, and Pace/attention stay visible on the filter bar;
its additional fields are Repeat every, Mix, Project (named projects,
Any project, or No project), counting start/end date ranges, and
Planned/Delivered/Time elapsed percentages. Planned and Delivered are percent
of page target; records without one do not match those filters. Sections
remember each user's open state. Categories picks a mix by ID and links its
selected mix beside the picker. `/mixes` and mix detail routes stay addressable;
the Mixes sidebar entry remains only for accounts without Categories access.
The older descriptions
below of mix ownership, Categories' intention picker, project mixes, and
Unarchive describe the previous model. Open follow-up: project filtering on a
mix, archive correction/restore, saved filters for Mixes,
and scheduled creation of repeat occurrences. The `.v2` demos remain separate
from the React frontend.

**Completion handoff (2026-10-08):** follow
[completion-plan.md](completion-plan.md) for steps 11–12, then the verified
earlier functional gaps. It resolves stale guidance below and requires finished
CSS in each UI session. The `.v2` demo redesign remains a separate later pass.

For local mock identity, run make frontend-users to list profiles and
make frontend-user MOCK_USER=reader (or admin, curator, digitization, staff,
no-access) to change the emulated user. Restart Vite after changing it. The
selected profile controls the mock session, available navigation, and document
records returned by MSW; identity is configured outside the application UI.

This is the handoff for continuing VERA's new frontend on `feat/client-redesign`.

## Current state

- Categories now has shared watchlist tabs and a filter bar above its tree. Search matches name
  or ID; Kind, Custody (without anyone, direct grants or inherited reach), Needs attention
  (unallocated or missing share), Documents and Ready pages narrow matching categories. The
  tree keeps ancestor paths as dimmed context and shows a match count, while its Show picker
  remains a separate display preference. The detail cards fill the pane's available width.
  The chosen category and filters coexist in the URL. A Mix of picker selects a visible
  intention owner's mix for the tree and detail; Overall is the default. The selection is saved
  with a watchlist. Scoped mixes show shares only inside their scope.
  Without custody and Mix gaps are seeded shared watchlists; Mix gaps and its filter are not
  offered to people who cannot read an intention's mix (an active old filter stays removable).
  The `.v2` redesign remains deferred.
- Saved watchlist tabs now follow the full live search and filter on Documents, Proposals,
  Validations, Lists and Projects. A matching saved tab becomes active automatically; an
  unmatched filter shows `Current search` at the end of the tabs. Its menu saves a new
  watchlist or updates a chosen editable one, preferring the watchlist that the search
  originated from. The tab strip scrolls the active tab into view after watchlists load.
  Project dates also offers this, last and next calendar week or month as relative presets;
  weeks run Monday through Sunday and saved presets continue to track the calendar.
- Projects' four populated categories are now individually collapsible sections, all open
  by default. Their open state is stored per user in browser storage; a sole matching
  category shows directly, without a section heading, and does not overwrite that state.
- Projects follow-up is built: saved tabs for Proposed, Active, Ended and Rejected;
  `FilterBar` over name/description, decision, period, Behind pace/On track, overlapping
  dates, whole elapsed percentage and delivered pages. Each board section is newest first;
  the shared tab strip scrolls its active tab into view on a phone. The `.v2` redesign stays
  deferred.
- Digitization Lists follow-up is built: watchlist tabs, shared Current lens, and State,
  attention and Runs filters through the existing filter bar and API. The `.v2` redesign
  remains deferred. Session C (Home and user menu) remains queued in the completion plan.
- Hooks step 11 is built. `src/api/hooks.ts` and `src/mocks/hooks.ts` implement
  channel-backed subscriptions and deliveries; `src/features/hooks/` renders
  the searchable grouped list, URL-selected detail, attention and waiting queues,
  public preview, delivery history, editor, pause/resume, retry, discard, send
  now and explicit test. Plugin channel details and disable impact link back to
  affected hooks. Publication and list creation record public events for Hooks.
  The existing status log still uses free-text event names and may contain
  internal details; remaining event producers need typed event codes and explicit
  public payloads before being wired to Hooks.
  A general condition builder for “Only when” also awaits a product contract;
  the mock accepts the two demonstrated conditions and rejects unknown ones.

The greenfield client lives in `frontend/`. It uses Bun, React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS v4, shadcn/ui (New York), MSW, React Hook Form, Zod, i18next, and Lucide icons. Do not import code from the old `client/` or `webclient/` trees.

The foundation is in place:

- shadcn primitives are vendored under `src/components/ui/`.
- The shell (`src/components/layout/`): `app-shell.tsx` fills the viewport and never scrolls;
  views scroll only their own regions. `sidebar.tsx` is docked from 1280px and toggles between
  expanded and the two-letter rail, remembered per tier by `src/hooks/use-sidebar-preference.ts`
  (`vera.sidebar.large|notebook`); below 1280px ☰ before each page's title (`navigation-button.tsx`, given its opener
  by the shell) opens it as a sheet; there is no separate top bar. Collapsed, the
  rail opens over the content on hover (`src/hooks/use-sidebar-peek.ts`, navigation.md §4.2):
  200ms in, instant out, fine pointers only, tap to open on touch, keyboard focus opens it, and
  it stays shut after a navigation until the pointer leaves the bar.
  `page-header.tsx` is every view's header on one line (☰, `title`, declared `actions` on the
  right; no count line, a count belongs to its list) plus `PageContent` for a scrolling body.
  `src/components/actions/action-bar.tsx` draws declared actions (`ViewAction`: run or go,
  primary, destructive) with the per-tier cap on buttons (phone 1, small 2, else 3) and the
  rest under "…"; a destructive action is never filled on a phone. `src/hooks/use-tier.ts` is
  the display tier (phone < 768, small < 1280, notebook < 1600, large) with `PerTier` values;
  the shell stamps it on `<html>` as `data-tier`, and `large` sets the 15px root. Use the tier
  for what the display decides (navigation, docking, dialogs, the cap) and container queries
  for what the room decides (list and fact columns).
  `master-detail.tsx` takes the remaining height: from 768px (all of small) a list at half the width (at least
  21.5rem) beside a docked pane, scrolling independently; a detail sheet below that. The list
  is a CSS container, so rows lay out by its own width.
- Filters (`src/components/filters/`): a view declares its fields (filtering.md §2.1);
  `filter-controls.tsx` draws quick fields on the bar (`QuickFilter`, "Decision: any ▾"), the
  chips and the "+ Add filter" picker, with facet counts and several values per field.
  `watchlist-tabs.tsx` puts a view's watchlists as tabs above its bar: "All", the shared ones
  (a people icon), and the caller's own, each with its count. The active tab follows the
  full live filter, including search. An unmatched filter gets an active `Current search` tab;
  its menu saves a new watchlist (Personal or Shared, where allowed) or updates a chosen
  editable watchlist's filter. Rename, Share and Delete sit in an active editable tab's menu.
  Opened bare, a view reopens on the tab last opened there (`src/hooks/use-remembered-watchlist.ts`,
  kept in the user settings at `/session/settings`, `src/api/user-settings.ts`; the mock keeps
  them in localStorage under `vera.mock.user-settings` so they survive a reload). A filter is
  saved once (filtering.md §4.5); the server refuses duplicate filters, with the reason shown
  in the form or beside the tab.
- `src/lib/utils.ts` owns `cn()` (clsx + tailwind-merge).
- `src/domain/` holds the model: zod schemas with inferred types for every entity
  (`entities.ts`), permission keys and grant checks (`permissions.ts`), the status
  derivations from `status-model.md` (`status.ts`: validation, gates, displayed status,
  footnote, public vocabulary) and the document read model (`documents.ts`). Pure code, no I/O.
- `src/api/` is the typed client. `http.ts` parses every response against its schema and
  raises `ApiError`; `findJson` returns `null` for an expected 404; `patchJson` and
  `deleteResource` change and remove. Routes live in `routes.ts`.
  `documents.ts` owns the Documents contract: the query, its URL params (`q`, `mine` and
  comma lists matching any value within a field and every field together: the stored status
  dimensions `decision`, `progress`, `validation`, `forbidden`, `cancelled`, then `category`,
  `project`, `priority`, `copy`, `asker`, then the ranges `pages` and `asked`, written
  `from..to` with either end open, or for days a preset word (`src/lib/value-range.ts`); a requester has only `status`, in
  the public vocabulary) and the page/detail responses with per-field facet counts. `group=batch|project`
  arranges the list: the server sorts by group first and each slice carries the headers of
  the groups it touches with their full counts. `watchlists.ts` lists a view's watchlists (shared
  first, then the caller's own, each with its count and `isEditable`), creates, renames or
  refilters, and deletes them
  (`src/hooks/use-watchlists-query.ts`). The list comes in slices (`cursor`, `limit`, default 50): each
  response carries `total` over the whole filter and the `nextCursor`, and the client loads
  the next slice as the list nears its end (`useInfiniteQuery`). `reference.ts` serves users, categories and projects
  (`src/hooks/use-reference-query.ts`).
- `src/mocks/` is the fake backend. `fixtures/` was generated once from
  `docs/demos/shared/vera-data.js` (demo "today" is 2026-06-25) and is edited by hand from now
  on. `session.ts` resolves the mock profile into grants and custody; `documents.ts` applies
  reach (`iteration.read` → staff, else own requests in the public vocabulary), redaction,
  search, filters and facet counts (each counted over the other filters), order and grouping.
  A requester's view has only search and status. `watchlists.ts` shows each caller their own
  watchlists and, to staff, the shared ones, answers 403 to changing a shared one without
  `watchlist.manage_shared` (the admin role has it), 409 to a filter the caller already sees
  saved (`isSameWatchlistFilter` in `src/api/watchlists.ts`), and counts each by running its filter;
  The document detail withholds an ingest error from staff without `addition.read`, and
  rewords a requester's history into plain language (`publicEventOf`).
  `proposal-review.ts` is Proposal Review: a row per document from the asks that share its
  liveliest proposal decision (`src/domain/proposal-review.ts`), kept to the decider's proposal
  custodies (`fixtures/proposal-custodies.ts`: the custodies, their members, where the Custody
  plugins placed each fixture ask, and `houseRuleOf` for asks made since; what none placed is in
  the fallback), filtered, counted and grouped by the batch or requester of its earliest ask;
  approving creates the one iteration the oldest ask originates and the rest track, declining
  denies every ask with one reason, bulk approve (`POST /proposal-review/batches/:id/approve`)
  takes every open row the batch asked for in reach but those unticked (`excludedIds`), skips
  rescans and asks still being checked, and answers with what it took and left out;
  each writes the status log. `arrangement.ts` holds the grouping and slicing both lists share.
  `iterations.ts` reclassifies (leaf
  categories, before Digitized; the answer says whether it was handed over out of the caller's
  custody) and publishes (Digitized or Published, an http(s) link), each logged.
  `additions.ts` retries a batch's failed additions (`POST /batches/:id/retry`, `addition.retry`
  only): each goes back to Enqueued with its attempt counted and the last error kept, logged
  as "Ingest retried"; the batch header's *Retry failed* calls it (`src/api/additions.ts`).
  `validations.ts` is Documents Validations (`GET /validations`, `/validations/:id`): one row
  per current iteration a defect holds or a rule forbade (`src/domain/validations.ts`: the review
  state *Needed · Denied · Approved · Forbidden*, a forbidden item filed apart whatever its
  defects, a cancelled one out; how long it has waited; the defects still to rule on), kept to the caller's category custody (`validation.*` at `custody` reaches the
  subtree of the categories they hold, at `any` everything), filtered by review (*Needed · Denied ·
  Approved*: a forbidden item has none there), *Forbidden* Yes / No (as in Documents, whose
  *Restricted* is renamed to it, `forbidden=` in the URL), category (subtree), the plugin of a defect still to rule on, priority, project and the day it started
  waiting (`since=from..to`), counted, sorted needs-review first, most urgent, longest waiting, and grouped on `?group=`
  by category (the tree's order) or by defect (the plugin of what is left to rule on; *several*
  when more than one, none when nothing is left: forbidden or all accepted), each row in one
  group, the headers in `groups` as Documents does.
  The verdicts (`POST /validations/:id/accept|deny|revoke`, each its own permission) append one
  row naming the keys they cover; accept and deny take only the outstanding set as it is now (409
  otherwise) and refuse a forbidden item, deny keeps what every asker reads, revoke appends a
  *Revoked* row that takes the acceptances back (`approvedKeysOf` in `src/domain/status.ts`, the
  later row winning). `iterations.ts` also enters a counted page count
  (`/iterations/:id/page-count`, the manual source, refused once scanned), rechecks
  (`/iterations/:id/recheck`: the record is read from the catalog again, and every defect on a
  subject `fixtures/catalog.ts` lists in `catalogRepairs` for that record is gone; both re-run
  the checks the same way, and a recheck runs after the scan too without moving progress back),
  and cancels (`/iterations/:id/cancel`, held where it is). The detail carries `catalogLink`
  (`catalogLinkOf` in `catalog.ts`, MZK's VuFind until the catalog adapter supplies it). Nothing
  else is corrected in VERA (decided 2026-10-06). Every verdict and recheck moves progress as the gates say (`progressAfterGates` in
  `src/domain/iterations.ts`, V14: Enqueued to Ready once clear, Ready back to Enqueued when a
  gate fails) and says so in its log entry.
  `mutations.ts` holds what the actions share: `Outcome`/`Refusal`, `writeLog`,
  `replaceIteration`, the leaf-category check and `progressNote`. `problem.ts` answers every
  refusal as RFC 9457 Problem Details (`application/problem+json`: `type`, `title`, `status`,
  `detail`, plus VERA's `code`, and `errors: [{field, message}]` on a 422 from a schema); a
  refusal with no code of its own takes its status's (`forbidden`, `not_found`, `conflict`,
  `invalid`).
  `fixtures/watchlists.ts` seeds shared ones per view (Validations: *Review needed*, *Page
  counts*, *Denied in review*) and a few per user. `VITE_MOCK_DOCUMENT_COPIES` (default 1)
  repeats the fixture documents through `src/mocks/volume.ts`, to try lists at volume. `createHandlers(profile)` serves it over MSW.
- A list view declares itself once (`src/lib/view-definition.ts`, `ViewDefinition`): its filter
  in the URL, the watchlist comparer and its groupings (`features/documents/documents-view.ts`,
  `features/proposals/proposals-view.ts`). `src/hooks/use-view-url-state.ts` reads and writes a
  view's whole URL state from it: the query, the open record (`?id=` or the view's own name),
  the grouping, the watchlist tab, opening and detaching a tab, and whether the view was opened
  bare. Every list page uses it rather than touching `useSearchParams`.
- Lists (`src/components/lists/`): `record-list.tsx` is every list beside a pane. A view gives
  it column declarations (header, cell, grid track, numeric), the card a row becomes when the
  list is under 42rem, an optional why line under each row, its group headers and the paging;
  it draws the toolbar (`list-toolbar.tsx`: the count and the grouping picker), the sticky table
  header, the rows on one subgrid, the loading and empty lines and the load-more sentinel.
  `group-header.tsx` is the frame over a group (title, meta, action, footnote); the views fill
  it. `src/hooks/use-paged-list.ts` is the slice-by-slice query behind a list: rows, the first
  slice as the summary, every slice for its group headers, and the paging. `src/lib/plural.ts`
  says "3 askers".
- The filter bar is declared, not written: a view's definition lists its fields (key, label,
  a closed vocabulary with labels or a reference kind, quick or chip, and the one audience that
  has it), and `src/components/filters/filter-bar.tsx` builds the search, quick fields, chips and
  "+ Add filter" from them with the facet counts; a view adds toggles that are not fields
  through `extras` (Documents' Mine, counted by `activeExtraCount`). A field may instead be a
  range, `numberRange` (Pages) or `dateRange` (Asked). There is no Advanced editor (decided
  2026-10-06): "+ Add filter" lists the ranges after the value fields, and picking one adds a
  chip reading *any* (held by the bar, not in the URL, until given a range) whose popover opens.
  `src/components/filters/range-filter.tsx` is the chip and its `RangeEditor`: a range of days
  offers *Last 7 / 14 / 30 days* and *This month*, applied at once and kept as words
  (`asked=last-7-days`, `DayRange` in `src/lib/value-range.ts`, which the server counts from its
  today — the mock from the demo's, `src/mocks/today.ts`), or two days
  (`src/components/fields/date-range-field.tsx`); a count offers two ends
  (`number-range-field.tsx`). Every tier edits ranges. On a phone the bar is the search and
  *Filter n*, and `filter-sheet.tsx` opens from the bottom with every field as a list of its
  values and counts, the toggles, each range as a section with the same editor, and *Clear
  all*. `src/hooks/use-reference-labels.ts` names referenced
  records (users, projects, categories, batches, proposal custodies) for the bar and anywhere
  else. `src/components/pane-state.tsx` is what a pane shows: *Select a …*, nothing while
  loading, a line when the record left the view, an outcome after an action (Proposals'
  *Decided*), or the record.
- Dialogs (`src/components/dialogs/`): `dialog-shell.tsx` is the frame of every dialog (title,
  body, Cancel and one primary, a refusal inline above the footer, "Discard changes?" when
  closed dirty; a full-screen sheet on the phone with an outlined destructive primary).
  `consequence-dialog.tsx` (kind A: what happens, from a server dry run), `reason-dialog.tsx`
  (kind B: what readers are told plus an internal note; Decline in Proposals uses it) and
  `form-dialog.tsx` (kind C: React Hook Form over a zod schema, a computed warning, a refusal
  tied to a field) and `stepped-dialog.tsx` (kind F: steps named in the head by
  `step-indicator.tsx`, Back, a step's `onAdvance` may call the server). Each takes an `onConfirm`/`onSubmit` returning an `ActionResult` and closes
  itself when it is done. `src/hooks/use-action-mutation.ts` turns a call into that result: a
  refusal (403/404/409/422) or any other failure becomes a value, worded by the action's text
  for its Problem Details `code`, else the server's `detail`, else the action's text for the
  status (`src/api/http.ts` keeps the parsed problem on `ApiError.problem`), and the
  query keys it touches are refetched without being awaited. `can()` in
  `src/domain/permissions.ts` (and `src/hooks/use-can.ts`) checks a grant's scope against a
  record (proposal, iteration by category path, project, run); pane actions use it to be absent.
  A project is reached through its people or its groups: the session carries the caller's
  `groupIds`, and `isProjectMember` / `scopeOfProject` (`src/domain/projects.ts`) answer it.
  `message-dialog.tsx` is the one *Message…* dialog (messaging.md): given a record
  (`MessageSubject`), it shows who the server resolved it to (`src/api/messages.ts`,
  `GET /messages/hand-off`), who the chosen Message instance (`GET /message-channels`, in
  order, the first preselected) cannot reach, and hands off through `DialogShell`'s link primary
  (`primary.href`, a new tab); `src/hooks/use-message-query.ts` asks for both, and *Message…*
  exists only while some instance is enabled. The mock (`src/mocks/messages.ts`,
  `fixtures/message-channels.ts`: Email by address, MZK Slack by the `slack_id` handle) sends a
  proposal's message to its askers and a forbidden item's (`restriction`) to whoever may overrule
  it, people only and never the sender, as a `mailto:` or Slack link pre-filled with the record
  and a link back; a record out of reach is 404. Only those two subjects exist so far, and instances that send on their own are not modelled.
  Still to build: picker and set editor (component-interfaces.md §6.5–6.6).
- Query hooks: `src/hooks/use-session-query.ts`, `src/features/documents/use-documents-query.ts`.
  Sidebar entries and their required permissions: `src/components/layout/navigation.ts`.
- `src/app.tsx` holds the providers and routes. `src/features/documents/` is the Documents view:
  the watchlist tabs, the filter bar (search, quick Decision and Progress, Mine,
  then the chips and "+ Add filter", left to right on one wrapping line) and `document-list.tsx`
  (stacked cards, or table rows on a subgrid once the list is 42rem wide; a group-by select in
  its count row, `document-group-header.tsx` over each group) and `document-detail.tsx`, the
  record beside it: the toned status note (`src/domain/status-notes.ts`, which also says whose
  desk it is on), stat tiles and a card per part, built from `src/components/detail-card.tsx`
  and `status-note.tsx`; a requester gets their own ask, why they asked and its story in plain
  words. Beside the heading, `document-actions.tsx` puts More ▾ (`ActionBar` with `menuLabel`,
  each action `isInMenu`): Reclassify and Set (or Change) where it is
  available, each a `FormDialog` over `src/api/iterations.ts` (`POST /iterations/:id/reclassify`,
  `/publish`), offered by `can()` against the current iteration's category
  (`scopeOfIteration` in `src/domain/iterations.ts`, which also says an item is reclassified
  only before Digitized and published only from it). Ask for this too and Withdraw are not
  built yet. The page URL holds the filter,
  `id`, `group` and `watchlist`, the tab the filter was opened from. A search with exactly one match opens it, once per search, so links
  from elsewhere name a document by an identifier (`?q=IT12`); `?id=` is the selection while
  browsing. `propose-dialog.tsx` is Propose: items typed, pasted or from a file, each checked as
  it lands (`src/api/proposals.ts`; identifier formats and line parsing in
  `src/domain/proposals.ts`), then why, a project and, with `request.decide`, approving at
  once, then a report; the mock (`src/mocks/proposals.ts`, `fixtures/catalog.ts`) resolves
  against a small catalog plus every fixture document. Catalog search, record links, barcode
  scanning and photo capture are not built. Still missing there: rendering only the visible rows once thousands are loaded, the reason line under a row
  and the Batch field. Not yet built in the shell: the Watchlists row
  with its "new" badge (which leaves shared watchlists out until "seen" is kept per person), the running-tasks row, the user menu and phone gestures (component-interfaces.md §8.1).
- `src/features/proposals/` is the Proposals view, on Documents' pattern: the watchlist tabs
  (view `proposals`; "All" is every decision, the shared "Awaiting a decision" the open
  ones), the filter bar (search, Decision, Proposal custody, then chips), `proposal-list.tsx` (a row per
  document with a line under it saying why it is there; grouped by the batch or requester of
  its earliest ask, `proposal-group-header.tsx`) and `proposal-detail.tsx`, built from the
  record cards Documents uses too (`src/components/record-cards.tsx`: who asked, existing
  copies, the catalog record, history and the heading), plus Placed in and, while open, the
  Decide card (category and priority from `src/components/classification-fields.tsx`, which
  Propose uses too; it opens on the row's `suggestion`, a Classifier plugin's leaf with its
  reason and instance, played by `src/mocks/classification.ts` over
  `src/mocks/fixtures/classifiers.ts`; a note for a rescan; the decline form). The approval's
  log entry says whether the suggestion was kept, overruled or overridden by a batch. An approved proposal leaves the
  list and the pane says what was decided. A copy's link is in the pane, not on the row, which
  is one button. A batch's header carries "Approve N…", which opens `bulk-approve-dialog.tsx`
  on `DialogShell` over every open row the batch asked for, loaded a slice at a time as it
  scrolls, the left out in place with why; the server approves the batch whole, so a harvest
  of any size is one call, and the result screen (`cancelLabel={null}`) says what moved and
  what stays. Beside the pane's heading, *Message askers…* opens the
  Message dialog over the proposal. Its range field is *Asked* (`asked=from..to` or a preset on
  `/proposal-review`), the day any of the row's asks was made.
- `src/features/validations/` is the Documents Validations view (`/review/documents`), on
  Proposals' pattern: the watchlist tabs (view `validations`), the filter bar (search, Review and
  Category on the bar, Defect, Priority and Project as chips, *Waiting since* as a range;
  `validations-view.ts`, no groupings yet) and `validation-list.tsx` (Document · Status · Defects
  · Priority · Category · Since, the status with its post-scan footnote through
  `StatusWithFootnote` in `src/components/status-badge.tsx`, and a why line: the rule, the
  denial, what was accepted, or the defects still to rule on). `use-validations-query.ts` holds
  the list, one item, and `validationInvalidations` (Validations, Documents, watchlists). The
  Defect field names plugins through the `defectPlugins` reference kind, which is the name
  itself until a Plugins resource exists. Documents' *Resolve in Documents Validations* opens
  the item (`?id=`). `validation-detail.tsx` is the pane: the review note, the facts, one *Defects* card
  in sections divided by a rule — *Outstanding — n* (Needed) with Accept, Deny… and Recheck,
  *Denied — n* with Recheck, *Accepted — n* with who and when and Revoke — each defect a
  `DefectRow` from `defect-card.tsx`, a page-count defect with `PageCountEntry` (saving it runs
  the checks again); then the attempt, the catalog record (`CatalogCard`'s `link`: *Open in the
  catalog ↗*) and the history. What a recheck cleared shows as a note until another item opens. An act
  that takes the item out of the view reports it through `onLeft`, and the page shows it as the
  pane's outcome. Reclassify is a shared dialog (`src/components/iteration-dialogs.tsx`,
  with `FieldError`), each told what to refetch (`invalidates`) and what to do once done
  (`onDone`). `validation-actions.tsx` holds the rest: *Which to accept* (a pick, all ticked, shown
  when more than one is outstanding), *Accept it / Accept all n / Accept n* with a note, *Deny…*
  (`ReasonDialog` with the defect pick in `fields`; the public text follows the pick through
  the new `suggestion` of a `ReasonText`, until typed in), *Revoke* on the accepted section, `RecheckButton`, and
  `useMoreActions` for More ▾ (Reclassify, handed over out of custody → outcome; Cancel… →
  outcome). A forbidden item gets *What you can do* and, for whoever may not overrule,
  *Message admins…*: the Message dialog over the new `restriction` subject, which the mock
  (`src/mocks/messages.ts`) resolves to the holders of `restriction.overrule`.
- `src/features/lists/` is Digitization Lists (`/lists`, view-map.md §2.4), step 4 of
  `plan.md`. The resource is `src/api/lists.ts` over
  `/digitization-lists` (the bare `/lists` stays reference data): rows with the state worked out
  from the dates (`src/domain/lists.ts`: `listStateOf`, `isOverdue`, `progressOnList`,
  `memberBlockerOf`) and the counts the browse reads; one list with its members and its own
  log; the pool (`/digitization-lists/pool`: Ready, every gate passed, on no list, with what
  review holds back by top category and the undecided count); `POST` creates and `PUT
  /digitization-lists/:id` saves the editor's whole draft (no start = starts now). The mock
  (`src/mocks/lists.ts`) writes the members' progress as the start says, returns taken-off ones
  to Ready (or Enqueued if a gate fails), refuses an item another list took (409
  `list.member_unavailable`) and any change to a Done list (409 `list.done`), and reads
  `list.read`'s custody and project scopes as "a member within them" (a TODO). Browse is
  `lists-page.tsx` with `lists-view.ts` (shared `WatchlistTabs` and `FilterBar`: All is
  unfiltered, Current is a shared saved filter for Planned and In progress; search by name
  or partial ID, State, attention reasons and overlapping start-to-end Runs dates in the URL;
  no grouping; old `?show=current|done` links still parse), `list-rows.tsx` (List ·
  State · Runs · Items · Pages · Delivered and the why line) and `list-detail.tsx` (state note,
  tiles with bars, members with their status and one flag, history; *Edit* with `list.edit`
  while not Done). *New list* (`list.create`) opens `/lists/new`, *Edit* `/lists/:id/edit`
  (`list-editor-page.tsx`, routes in `src/app.tsx`); `list-editor.tsx` builds on
  `src/components/transfer-editor.tsx` (`TransferEditor`: the header strip, +N −M, Discard,
  Save; two panes with checkboxes, a range by Shift, per-row and bulk moves, side by side from
  notebook, stacked with sticky heads below), `src/hooks/use-draft.ts` (`useDraft`, `isSameSet`),
  `src/hooks/use-picked.ts` (`usePicked`) and `src/components/leave-guard.tsx` (*Discard
  changes?* on a route change, the browser's own prompt on reload). Saving goes back to the
  list in browse. *Generate…* sits in the editor's left pane head when a generator runs
  (`GET /digitization-lists/generators`): `generate-dialog.tsx` is a `SteppedDialog` (Ask →
  Preview) over `POST /digitization-lists/generate`, whose mock (`src/mocks/list-generation.ts`)
  plays the reference rule-based generator and the AI one with its own sentences. One intention
  shapes the draft (*Shape by*, from `GET /digitization-lists/shapes`: neither ended nor
  archived, Overall first): the pool narrows to its funding and subtree and its mix is read
  inside its scope (`shareWithinOf`); a correcting run's `allocation` fixes the pages per category
  the mix is read across and is never re-spread. The draft's picks join the left pane marked
  *generated* with their reason, `generation-report.tsx` stays in the top strip, and Save sends
  the provenance (`generated`: intention, mix revision, pages, allocation, generator), logged as
  *Generated — {generator}*. `/lists/new?generate&shape=&pages=&alloc=` (`lists-view.ts`
  `generationHrefOf` / `generationStartOf`) is a new list an intention's card started: Generate
  opens at once, shaped by it, with the pages or the allocation (*Use its plain mix instead*
  drops it). The editor's top says what the draft counts towards and its fill against one
  intention's mix (`POST /digitization-lists/reading`, `src/mocks/intention-lists.ts`; the parts
  are `list-intentions.tsx`), and warns when it will not count towards the intention it was
  generated with (L8) or will stop counting towards one with new dates (L10); rows and the pane
  carry the same from `countsTowardsOf` and `listMixOf` (`src/domain/intentions.ts`), with the
  pane's *Counts towards* and *Mix* cards. The pane's acts are `list-actions.tsx`: *Mark Done…*
  while it runs and *Delete…* in More ▾, each a `ConsequenceDialog` over a server dry run
  (`GET …/done`, `GET …/deletion`, then `POST …/done`, `DELETE …/:id`); per item, a ⋯ with
  *Could not be digitized…* (`POST …/items/:iterationId/not-digitizable`, stays on), *Cancel…*
  (the shared iteration cancel, which now takes an item off its list, flows.md C3) and *Take it
  off — in the editor*.
- `src/features/projects/` is Projects (`/projects`, `/projects/:projectId`), step 5 of
  `plan.md`. The resource is `src/api/projects.ts`: `GET /projects/overview` is every project
  the caller sees (members and their groups at `project.read@project`, everyone at `any` or with
  `project.decide`) with what the server works out: the period (`src/domain/projects.ts`:
  `periodOf`, `timeElapsedOf`, `daysUntil`) and, from the project's own intention
  (`intentionId`, `targetPages`; intentions.md §3.4), its planned, delivered, verdict and even
  pace by the intention rules over the project's period, once Approved; days left and to the
  start, what waits for a list, the pending documents and those with a copy, lists and member groups.
  `GET /projects/:id` adds the proposals one row per document, the live and the deleted lists,
  the funded iterations and the project's log; the bare `GET /projects` stays reference data.
  The acts: `POST /projects`, `PUT /projects/:id`, `PUT …/members` (the whole set, manager
  among them), `GET …/decision` (the dry run), `POST …/approve` (priority; the pending documents
  without a copy become Approved with no iteration until ingest classifies them), `POST
  …/reject` (reason; only the project's own asks are declined), `DELETE` (409
  `project.has_proposals` once anything was proposed); 409 `project.decided` once decided. The
  mock is `src/mocks/projects.ts`; groups are `GET /groups`. The index is `projects-page.tsx`
  with `projects-view.ts` (filters, sections, labels, the note in words), the shared
  `WatchlistTabs` and `FilterBar` (URL filters and server facets), and
  `src/components/card-sections.tsx` (`CardSections` and `RecordCard`, whose title link opens
  the whole card), `project-card.tsx` and `src/components/visualizations/pace-bars.tsx`
  (`PaceBars`: time, planned, delivered, the even-pace mark); the ended and rejected projects
  are `src/components/data-table.tsx` (`DataTable`, columns per tier). The page is
  `project-page.tsx` on `src/components/layout/record-page.tsx` (`RecordPage`: note, cards,
  aside, history; the aside first and the history last where it is narrow), with
  `src/components/members-card.tsx` and `PageHeader`'s `breadcrumb`. `project-actions.tsx`
  offers the acts and `project-dialogs.tsx` holds them: New and Edit (`FormDialog`, the target
  optional and written to its intention, new dates previewed by `POST /projects/:id/preview`,
  a warning on an approved project), Members (on `DialogShell` until `PickerDialog`
  exists), Approve (`FormDialog` over the dry run), Reject (`ReasonDialog`), Delete
  (`ConsequenceDialog`). Every project has one intention of its own (`intention.projectId`),
  made with it in `createProject`, its name, funding and window kept in step by `saveProject`,
  archived by `rejectProject` and deleted by `deleteProject`; it is listed on Intentions once the
  project is decided, and refuses archive, delete and changes to the project's fields there
  (409 `intention.project`). *Message…* is a TODO.
- `src/features/intentions/` is Intentions (`/intentions`), step 6 of `plan.md`.
  The resource is `src/api/intentions.ts`: `GET /intentions/overview` is every intention the
  caller sees (`intention.read@any`, or `@project` for one a project they are on funds) with what
  the server counts by `src/domain/intentions.ts`, the one home of the counting rules: planned (on
  a list that still exists starting in the window, a cancelled item out unless delivered),
  delivered (digitized in the window, a part of planned), output (everything matching digitized
  in it), the target verdict (the Projects pace with ten points of slack, or fully planned, met,
  short), pages a week needed and the catch-up pages, the mix read within the scope against the
  output (±5 points, unallocated, a 0% category used, no share), the fill of a target per leaf,
  the lists in its window, and whose mix it reads (its own, or an owner's: no chains) with the
  number of its trackers; plus the repeats. Fixtures are `src/mocks/fixtures/intentions.ts`
  (intentions, mixes, the monthly repeat); the mock is `src/mocks/intentions.ts`, whose
  `overallIntention` and `distributionOf` the list generation mock now shapes by. The page is
  `intentions-page.tsx` over `intentions-view.ts` (columns, order, tile, words, `?i=`, `?t=`,
  `?col=`) and `intention-card.tsx` on `RecordCard` without an `href`, with `PaceBars` and
  `src/components/visualizations/mix-bars.tsx` (`MixBar`, `MixBars`); small and phone switch
  columns with Tabs. The acts are `intention-dialogs.tsx`: one `FormDialog` makes, edits and
  makes a new intention from an old one (the counting start is locked), with one mix field —
  *Track* an owner or *Own mix, copied from* one, an owner others track switching only by
  moving them along — and a server preview (`POST /intentions/preview`) of where it lands, what
  saving recounts and the percentages beside the ones it reads now; `POST /intentions`,
  `PUT /intentions/:id`, `POST …/archive` and `…/unarchive`, `GET …/deletion` then `DELETE` (409
  `intention.tracked` while others track its mix, 409 `intention.overall` for Overall). Repeats
  are `POST /intention-templates` and `PUT …/:id` under `intention.repeat` (the next occurrence by
  `nextPeriodStartOf`). A card's Generate starts a list: *Generate a list* or *against this mix*
  shaped by it, *Generate catch-up — N pp* when behind pace, and *Generate correcting list…* for
  a tracking card out of band, whose dialog shows the allocation from
  `GET /intentions/:id/correction?pages=` (`correctionOf`: what each category lacks against its
  share of output plus the new pages, cut in proportion; supply short stays short) and hands it
  to the list editor. Who may: `scopeOfIntention` in `src/domain/intentions.ts`. An intention's
  Mix is `mix-page.tsx` at `/intentions/:id/mix` (`?c=`), over `src/api/mixes.ts`:
  `GET /intentions/:id/mix` (the tree read against its output, the revision, the trackers),
  `PUT …/mix` (one sibling set, whole, against the revision, `keepOldMixFor` detaching those
  first; 409 `mix.revision`, `intention.not_owner`, 422 `mix.over`, `mix.outside_scope`) and
  `POST …/detach`; the mock is `src/mocks/mixes.ts`. It shows the shared `CategoryTree` and
  `MixSetCard`, and `mix-dialogs.tsx` holds *Edit proportions…* on `SetEditorDialog` with the
  trackers step, and *Detach*. Categories (`src/features/categories/`) reads the selected visible
  owner's mix, Overall by default, read-only, from `GET /categories/overview?mix=`, and changes
  the tree over `src/api/categories.ts`:
  `POST /categories` and `PUT`/`DELETE /categories/:id` (create, rename and move, delete an
  empty leaf; 409 `category.name_taken`, `category.holds_documents`, `category.has_children`,
  `category.scope`), `GET …/impact` (what a delete or refine touches: documents, the mixes giving
  it a share, named only where the caller reads intentions, custody, scoped intentions),
  `PUT …/custody` (the set granted on it, whole) and `POST …/refine` (a child takes the leaf's
  documents, logged as Reclassified, and 100 in each mix that gave the leaf a share). Each is
  `category.edit` or `category.grant_custody` against `scopeOfCategory` (`src/domain/categories.ts`,
  with `placesFor` and `isNameTaken`; the root is `any`'s). Custody lives in the mock database
  (`database.groups`, `database.categoryMembers`), which the session resolves per request. The
  pane's acts are in `category-dialogs.tsx` (custody on `SetEditorDialog`, New and Edit on
  `FormDialog`, Delete on `ConsequenceDialog`) and `refine-wizard.tsx`, on the shared
  `PaneWizard` at `?c=ID&refine=1`; a change leaves a note in the pane it opens.
- Tasks and Schedules (`src/features/tasks/`, one folder as one demo script draws both).
  `src/api/tasks.ts` serves `GET /tasks` (the runs in reach: `task.read` everyone's,
  `task.read_own` the person's own; running apart, finished filtered by state, trigger, plugin
  and who started it, with facets, tiles, retention and the schedules' counts), `GET /tasks/:id`
  (its errors, first items and log), `GET /tasks/:id/log` (text), `GET /tasks/running` (the
  sidebar's panel), `POST …/cancel` and `…/rerun` (409 `task.not_running`,
  `task.not_rerunnable`) and `PUT /tasks/retention` (`task.schedule`; 422
  `retention.failed_shorter`). `src/api/schedules.ts` serves `GET /schedules?range=day|week|month`
  (plugin schedules, then the intention repeats, each with its last run, next run and the runs it
  makes in the window, listed up to 60), `POST`, `PUT` and `DELETE /schedules/:id`
  (`task.schedule`; 422 `schedule.too_often`, `schedule.not_schedulable`), `…/pause` with a
  reason, `…/resume` (409 `schedule.paused`, `schedule.not_paused`) and `…/run` (`plugin.run`).
  Every answer carries `asOf`, the server's moment, which "2 min ago" and "in 5 min" read
  against. The mock (`src/mocks/tasks.ts`, `schedules.ts`, fixtures `fixtures/tasks.ts`) keeps a
  running run's pace, not its count, against `mockNow()` (`src/mocks/today.ts`: the demo's
  2026-06-25 10:40, standing still under tests and moving in the browser), so a run started by
  hand progresses and finishes. A cadence and its moments are `src/domain/schedules.ts`
  (`occurrencesOf`, `nextOccurrenceOf`, `repeatCadenceOf`), which the editor's preview shares
  with the server; who may cancel or re-run is `src/domain/tasks.ts`. Plugin instances are
  reference data (`GET /plugin-instances`, from Plugins' fixtures). Tasks
  (`tasks-page.tsx`) is the shared `TableWithDrawer`: tiles, running cards with `RunProgress`,
  the finished table with a failed run's note row and phone cards, the drawer at `?run=`
  (`run-drawer.tsx`), Cancel and Keep runs for (`run-dialogs.tsx`). Schedules
  (`schedules-page.tsx`) is the `Timeline` (`?range=`), the table (`?s=` marks a row) and
  `schedule-dialogs.tsx`: the editor with the next three runs and *Delete schedule…*, and Pause
  on `ReasonDialog`. The sidebar's `running-tasks-panel.tsx` shows what runs, from
  `src/hooks/use-running-runs-query.ts`.
- Users & Groups (`src/features/access/`). `src/api/access.ts` serves `GET /access`
  (`access.read`: every user with their hand-set and mapped roles, groups and identities; the
  roles; the groups; the proposal custodies with their open proposals and the Custody rules
  that name them, the fallback first; the identity instances and their mappings; direct
  category custody; project membership; the shared watchlists with whom each reaches, and
  `asOf`), and under `access.manage` `POST`/`PUT`/`DELETE /access/roles…`, `GET
  …/roles/:id/impact`, `POST /access/users` (a local account), `PUT …/users/:id/roles` and
  `…/groups`, `POST …/users/:id/identities`, `POST`/`PUT /access/groups…` and `…/members`,
  `POST`/`PUT`/`DELETE /access/custodies…`, `…/members` and `GET …/custodies/:id/impact` (409
  `access.last_manager`, `access.name_taken`, `access.identity_taken`; 422 `access.fallback`).
  Roles and how each person holds them are in the mock database (`fixtures/access.ts`
  `userAccess`); the identity instances and the Custody rules are Plugins' instances, read
  through `src/mocks/plugin-instances.ts`; the session resolves them per
  request (`sessionOf` in `src/mocks/session.ts`, for anyone). The derivations, shared with the
  page, are `src/domain/access.ts` (roles and how held, permissions at their widest with their
  roles, included roles, custody and projects via groups, who a role's change reaches); the
  permission catalogue with accepted scopes is `permissionCatalog` in `src/domain/permissions.ts`.
  The page (`access-page.tsx`) is the shared `LinkedColumns`: Roles · Users · Groups, custodies
  and shared watchlists, `?u= ?r= ?g= ?c= ?w=`, links from `access-links.ts`, records in
  `access-records.tsx`, acts in `access-acts.tsx` with `role-dialogs.tsx` (the role editor on
  `SetEditorDialog`, delete), `access-dialogs.tsx` (the pickers on `PickerDialog`, local
  account, identity, groups, custodies) and `watchlist-dialogs.tsx`. Watchlists have an
  audience (personal, everyone, some groups and roles; `watchlistAudienceSchema`), a row per
  person who sees one (`viewer`: seen, badge, hidden, place) and `POST /watchlists/reach`;
  `ShareWatchlistDialog` (`src/components/filters/`) sets it from a tab and from Users & Groups.
- Plugins (`src/features/plugins/`). `src/api/plugins.ts` serves `GET /plugins` (`plugin.read`:
  every implementation with its installed versions, newest first, each with its contract
  version, triggers, declarations and config fields; every instance not deleted with its
  configuration less its secrets (`secretsSet` says which are set), VERA's settings on it
  (`settings`: an Identity's login label, order, user id claim, default role, match by email and
  claim mappings; a Custody rule's custody names; a Message's or Classifier's order), its
  schedules, its recent runs, `runCount` and `lastRunAt`, and `asOf`). Under `plugin.configure`:
  `POST /plugin-instances` and `PUT /plugin-instances/:id` (checked against the version's config
  fields; a secret not sent keeps its value; 409 `plugin.name_taken`, `plugin.user_claim_fixed`;
  422 `plugin.config_missing`, `plugin.config_unknown`, `plugin.settings`), `POST …/enable` and
  `…/disable` (409 `plugin.last_identity`, `plugin.contract`, `plugin.unchanged`), `GET …/impact`
  (what stops: others of its kind still on, schedules, runs, who signs in through it, the open
  proposals a rule places), `DELETE` (kept for its runs, its schedules removed), `GET`/`POST
  …/upgrade` (to the newest version VERA runs: names added and retired, config fields added and
  dropped, approvals a retired rule leaves uncovered; 409 `plugin.up_to_date`); `POST …/run`
  under `plugin.run` (a run on Tasks; 422 `plugin.not_runnable`). Under `plugin.upload_code`:
  `POST /plugin-implementations/uploads` (multipart; the mock reads the package by its file name,
  `<kebab-name>-<x.y.z>.jar`: an installed implementation's next version with what
  `nextVersionChanges` adds and retires, or one of `newPackages`; 422 `plugin.not_a_package`,
  `plugin.no_descriptor`, `plugin.other_implementation`; 409 `plugin.version_installed`) and
  `POST …/uploads/:id/install`. The fixtures are `fixtures/plugins.ts` (implementations,
  instances, packages); `src/mocks/plugin-instances.ts` gives the rest of the mock each kind's
  enabled instances in order, so Generate, the decide form's suggestion, *Message…*, Users &
  Groups and custody placement follow what Plugins switches off. Versions and their differences
  are `src/domain/plugins.ts`. The page (`plugins-page.tsx`) is the shared `TableWithDrawer` over
  a `DataTable` grouped kind → implementation → instance (`plugin-table.tsx`), filtered in place
  (`plugins-view.ts`: `?q= ?kind= ?state=`; `?i=` opens an instance, `?impl=` an implementation;
  every view links an instance with `pluginInstanceHrefOf`), the drawers in `plugin-drawers.tsx`,
  the acts in `plugin-acts.tsx` (Disable and Delete on `ConsequenceDialog` fed by the impact,
  Move to a version, the upload on `SteppedDialog`) and the editor in `instance-editor.tsx` on
  `FormDialog`.
- Tests (`bun run test`): status derivations against fixture iterations, fixture integrity,
  the Documents API and its filters, facets, slices and grouping through MSW as a reader and
  as staff, the status notes and desks for both audiences, watchlists, and
  `joinDetails`.
- `frontend/.env.example` is safe to commit. Keep local environment values in ignored `.env.local`; never put secrets in `VITE_*`.

Use the root Makefile as the task entry point. Useful commands are `make frontend-install`, `make dev-frontend`, `make format`, `make lint`, `make typecheck`, and `make check`. `make dev-roles` starts a background dev server per fake user (admin on 5201, curator 5202, digitization 5203, staff 5204, reader 5205, no-access 5206; `ROLES="admin reader"` for some), `make dev-roles-status` lists them, `make dev-roles-open` opens them and `make dev-roles-stop` stops them; pids and logs are in `.dev-roles/`.

## Design sources

Follow the newest user decisions first. For the current product model, read:

1. Newest user decisions and `docs/demos/STATUS.md` → **Decisions to trust**
2. `docs/design/shared/document-use-cases.md` and `view-map.md`
3. `docs/design/shared/navigation.md` for the shell, except where newer user direction below supersedes it
4. The current notebook demos in `docs/demos/notebook/` and their source in `docs/demos/shared/`, for visual and interaction reference
5. `docs/design/shared/filtering.md` as a **draft proposal**, not a fully agreed filter specification

`docs/demos/REVIEW-BRIEF.md` identifies which design docs and demo pages are current. `docs/demos/rework.md` contains useful rationale, but parts of its initial view list have since been superseded. In particular, Additions is now a status in Documents, and list generation is part of Digitization Lists.

The current Watchlists and notification design is `docs/design/shared/entities/watchlists-and-notifications.md`. It supersedes the older navigation badge and Preferences Watchlists directions below: `/watchlists` is a navbar page, and its badge counts watchlists with new entries. Source-view tabs show per-watchlist entry counts. The user has also said the demo filters need rethinking; do not copy them as-is or assume every detail in the filtering draft is approved. A watchlist is a saved filter for one view. Grouping is presentation, not a filter, and must not be saved with it.

## Product shape

Build one coherent application over a shared dataset. A document remains the same entity as it moves from request through iteration, list, digitization, and publication. Keep request, document, and iteration types distinct; do not flatten lifecycle axes into one overloaded status enum. Read `docs/design/shared/entities/status-model.md` and `entities/concepts.md` before shaping those types.

The view routes are:

- Documents (`/documents`; label *My Documents* for reader-only reach)
- Proposals (`/review/proposals`)
- Documents Validations (`/review/documents`)
- Digitization Lists (`/lists`, with create/edit flows)
- Projects (`/projects`)
- Categories (`/categories`)
- Intentions (`/intentions`)
- Tasks (`/tasks`; label *My Tasks* for own-only reach)
- Schedules (`/schedules`)
- Users & Groups (`/access`)
- Plugins (`/plugins`)
- Hooks (`/hooks`)

Home is conditional: redirect when the user has exactly one available destination; otherwise show destination cards. It is not a permanent analytics dashboard.

## Implementation sequence

**The next work is `plan.md`**: steps 0–12, one per view, each split into
commits; step 0, the foundation, is done. `brief.md` is how each step is
carried out and what it reads. Its parts are in `component-inventory.md`, with their draft props in
`component-interfaces.md`. The sequence below is the original outline.

**Built before the definitions of 2026-10-07** (`docs/design/shared/entities/concepts.md`,
*Category, mix, intention, project*): Projects gives a project its own target and pace, and
Categories reads and links to editing a mix with *Mix of* (`?i=`). Under the definitions only an
intention has a target or pace (a project's comes from its own intention), a mix is edited on its
intention, and a category is a line of work whose leaf a Classifier plugin suggests at approval.
`plan.md` 7.3 brought the project's intention and the intention's Mix in line, and 7.4 the
Classifier.

1. **Application shell.** Add routes and the responsive navigation frame. Navigation entries should come from the current user's available permissions. Actions and destinations the user cannot use are absent, not disabled. Support the demo's large, notebook, small, and phone layouts.
2. **Documents.** Start with coherent fake documents, requests, iterations, projects, status history, and registry copies. Serve them through MSW handlers and access them through TanStack Query. Build the list/detail view with search, status and other declared filters, facet counts, URL-backed filter state, and the responsive `MasterDetail` component. Include view-level save/edit-watchlist affordances.
3. **Watchlist management.** Reuse the same watchlist editor from the originating view and user options. Drive navigation badges from watchlist notifications, so a badge appears on the view whose watchlist has new matching items. Do not clear a badge just because the user opened that view; clear/update it when they open the relevant watchlist. Keep fake notification data coherent with the fake records.
4. **Remaining views.** Follow the route and workflow order above. Reuse shared filters, detail layouts, status/defect badges, permission-aware actions, forms, and dialogs. Do not build separate page-specific versions of common controls without a clear need.
5. **Replace mock transport only when the backend contract is ready.** Keep components calling typed API functions, so switching MSW to the real API does not require replacing page logic.

## UI and code conventions

- Use the shadcn components already in `src/components/ui/`; add more with `bunx shadcn add <component>`. Keep generated components vendored and adapt app-specific compositions outside the UI primitive directory.
- Use the palette and dark sidebar in `src/globals.css`, matching `docs/demos/rework.md`: neutral white/black base, mono-blue chart ramp, and 0.625rem radius. Use CSS variables and Tailwind utilities instead of one-off hard-coded colors.
- Build shared feature components from shadcn primitives. Examples: master–detail, filter bar, filter chip, status badge, document row, and watchlist editor.
- Keep server data in TanStack Query. Keep filter state addressable in the URL. Use React Hook Form + Zod for user input and validation; use i18next for user-facing strings.
- Use MSW at the HTTP boundary for fake data. Do not introduce MirageJS or page-local arrays that bypass the API/query path.
- Preserve the demos' distinction between search/filter and grouping. Search and predicates combine as a filter; grouping only changes arrangement.
- Keep responsive behavior intentional: master–detail docks from 768px, all of small (view-rules.md §1.5); phone presents detail as a sheet. Do not shrink type simply to fit more columns.
- Match repository formatting and naming conventions. Update the Bun lockfile whenever dependencies change. Keep secrets out of source, examples, and browser-visible environment variables.

## First concrete milestone

Implement the app shell and Documents view with MSW fixtures. The page should be usable as a reader and as staff, show the correct *My Documents* / *Documents* label and data reach, support search and basic filter facets, open a record detail, and allow saving the current filter as a watchlist. Use the demos for composition and the current design docs for behavior when they disagree.

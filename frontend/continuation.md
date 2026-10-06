# Frontend continuation guide

For local mock identity, run make frontend-users to list profiles and
make frontend-user MOCK_USER=reader (or admin, curator, digitization, staff,
no-access) to change the emulated user. Restart Vite after changing it. The
selected profile controls the mock session, available navigation, and document
records returned by MSW; identity is configured outside the application UI.

This is the handoff for continuing VERA's new frontend on `feat/client-redesign`.

## Current state

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
  (a people icon), the caller's own, each with its count, then "+". Each thing is saved in one
  place: "+" saves the current filter as a new watchlist (Personal or Shared, the choice only
  with `watchlist.manage_shared`); an open tab whose filter changed saves the change itself
  (a save icon on the tab, and Save / Discard changes in its menu). Rename and Delete sit in
  the open tab's menu where the caller may change it, with "Share with everyone" on their own
  for holders of `watchlist.manage_shared`; opened bare, a view reopens on the tab last opened
  there (`src/hooks/use-remembered-watchlist.ts`, kept in the user settings at `/session/settings`, `src/api/user-settings.ts`; the mock keeps them in localStorage under `vera.mock.user-settings` so they survive a reload); a shared tab they may not change shows only a dot
  and Discard. A filter is saved once (filtering.md §4.5): "+" and Save changes are disabled
  with the name of the tab that already holds it, and a refusal from the server shows in the
  form or beside the tab.
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
  dimensions `decision`, `progress`, `validation`, `restricted`, `cancelled`, then `category`,
  `project`, `priority`, `copy`, `asker`, then the advanced ranges `pages` and `asked`, written
  `from..to` with either end open (`src/lib/value-range.ts`); a requester has only `status`, in
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
  `iterations.ts` relinks (the target must be in the mock catalog, `catalog.ts`, with its unit,
  and no other document may be it; a missing-record defect clears), reclassifies (leaf
  categories, before Digitized; the answer says whether it was handed over out of the caller's
  custody) and publishes (Digitized or Published, an http(s) link), each logged.
  `additions.ts` retries a batch's failed additions (`POST /batches/:id/retry`, `addition.retry`
  only): each goes back to Enqueued with its attempt counted and the last error kept, logged
  as "Ingest retried"; the batch header's *Retry failed* calls it (`src/api/additions.ts`).
  `validations.ts` is Documents Validations (`GET /validations`, `/validations/:id`): one row
  per current iteration a defect holds or a rule forbade (`src/domain/validations.ts`: the review
  state *Needed · Denied · Approved · Forbidden*, a forbidden item filed apart whatever its
  defects, a cancelled one out; how long it has waited; the defects still to rule on; the fix a
  defect asks for), kept to the caller's category custody (`validation.*` at `custody` reaches the
  subtree of the categories they hold, at `any` everything), filtered by review, category
  (subtree), the plugin of a defect still to rule on, priority, project and the day it started
  waiting (`since=from..to`), counted, sorted needs-review first, most urgent, longest waiting.
  The verdicts (`POST /validations/:id/accept|deny|revoke`, each its own permission) append one
  row naming the keys they cover; accept and deny take only the outstanding set as it is now (409
  otherwise) and refuse a forbidden item, deny keeps what every asker reads, revoke appends a
  *Revoked* row that takes the acceptances back (`approvedKeysOf` in `src/domain/status.ts`, the
  later row winning). `iterations.ts` also enters a counted page count
  (`/iterations/:id/page-count`, the manual source) and corrects a field
  (`/iterations/:id/field`), each a fix that re-runs the mock's checks (every defect on that
  subject clears) and refused once scanned, and cancels (`/iterations/:id/cancel`, held where it
  is). Every verdict and fix moves progress as the gates say (`progressAfterGates` in
  `src/domain/iterations.ts`, V14: Enqueued to Ready once clear, Ready back to Enqueued when a
  gate fails) and says so in its log entry.
  `mutations.ts` holds what the actions share: `Outcome`/`Refusal`, `writeLog`,
  `replaceIteration`, the leaf-category check and `progressNote`.
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
  range, `numberRange` (Pages) or `dateRange` (Asked), which is advanced: the bar shows it as a
  removable chip at every tier and builds it in `advanced-filter.tsx`, a panel under the bar at
  large and a dialog at notebook, from `src/components/fields/number-range-field.tsx` and
  `date-range-field.tsx` (native date inputs, *Last 7 days* and *This month*). On a phone the bar
  is the search and *Filter n*, and `filter-sheet.tsx` opens from the bottom with every field as
  a list of its values and counts, the toggles, the range chips and *Clear all*. `src/hooks/use-reference-labels.ts` names referenced
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
  tied to a field). Each takes an `onConfirm`/`onSubmit` returning an `ActionResult` and closes
  itself when it is done. `src/hooks/use-action-mutation.ts` turns a call into that result: a
  refusal (403/404/409/422, worded per action) or any other failure becomes a value, and the
  query keys it touches are refetched without being awaited. `can()` in
  `src/domain/permissions.ts` (and `src/hooks/use-can.ts`) checks a grant's scope against a
  record (proposal, iteration by category path, project, run); pane actions use it to be absent.
  `message-dialog.tsx` is the one *Message…* dialog (messaging.md): given a record
  (`MessageSubject`), it shows who the server resolved it to (`src/api/messages.ts`,
  `GET /messages/hand-off`), who the chosen Message instance (`GET /message-channels`, in
  order, the first preselected) cannot reach, and hands off through `DialogShell`'s link primary
  (`primary.href`, a new tab); `src/hooks/use-message-query.ts` asks for both, and *Message…*
  exists only while some instance is enabled. The mock (`src/mocks/messages.ts`,
  `fixtures/message-channels.ts`: Email by address, MZK Slack by the `slack_id` handle) sends a
  proposal's message to its askers, people only and never the sender, as a `mailto:` or Slack
  link pre-filled with the record and a link back; a record out of reach is 404. Only `proposal`
  subjects exist so far, and instances that send on their own are not modelled.
  Still to build: picker, set editor and stepped frame (component-interfaces.md §6.5–6.7).
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
  each action `isInMenu`): Relink catalog record, Reclassify and Set (or Change) where it is
  available, each a `FormDialog` over `src/api/iterations.ts` (`POST /iterations/:id/relink`,
  `/reclassify`, `/publish`), offered by `can()` against the current iteration's category
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
  Propose uses too; a note for a rescan; the decline form). An approved proposal leaves the
  list and the pane says what was decided. A copy's link is in the pane, not on the row, which
  is one button. A batch's header carries "Approve N…", which opens `bulk-approve-dialog.tsx`
  on `DialogShell` over every open row the batch asked for, loaded a slice at a time as it
  scrolls, the left out in place with why; the server approves the batch whole, so a harvest
  of any size is one call, and the result screen (`cancelLabel={null}`) says what moved and
  what stays. Beside the pane's heading, *Message askers…* opens the
  Message dialog over the proposal. Its advanced field is *Asked* (`asked=from..to` on
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
  the item (`?id=`). `validation-detail.tsx` is the pane: the review note, the facts, *Outstanding
  — n* (Needed) or *Fix it* (Denied) built from `defect-card.tsx` (the texts and the fix in
  place: an inline form for a page count or a field, *Relink…* through the shared dialog), the
  accepted defects with who and when, the attempt, the catalog record and the history. An act
  that takes the item out of the view reports it through `onLeft`, and the page shows it as the
  pane's outcome. Relink and Reclassify are shared dialogs (`src/components/iteration-dialogs.tsx`,
  with `FieldError`), each told what to refetch (`invalidates`) and what to do once done
  (`onDone`).
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

The user's latest watchlist direction is authoritative where docs differ: show notification badges on the relevant navigation destinations; let people save/edit a watchlist from its view and manage watchlists from user options. Do not restore the older design of a standalone Watchlists sidebar row/popover without a new decision. The user has also said the demo filters need rethinking; do not copy them as-is or assume every detail in the filtering draft is approved. A watchlist is a saved filter for one view. Grouping is presentation, not a filter, and must not be saved with it.

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
commits; step 0, the foundation, is done. `step-guide.md` is how each step is
carried out. Its parts are in `component-inventory.md`, with their draft props in
`component-interfaces.md`. The sequence below is the original outline.

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

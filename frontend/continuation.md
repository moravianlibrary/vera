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
  (`vera.sidebar.large|notebook`); below 1280px a hamburger opens it as a sheet. Collapsed, the
  rail opens over the content on hover (`src/hooks/use-sidebar-peek.ts`, navigation.md §4.2):
  200ms in, instant out, fine pointers only, tap to open on touch, keyboard focus opens it, and
  it stays shut after a navigation until the pointer leaves the bar.
  `page-header.tsx` is every view's header (`title`, `actions` on the right; no count line, a
  count belongs to its list) plus `PageContent` for a scrolling body.
  `master-detail.tsx` takes the remaining height: from 1024px a list at half the width (at least
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
  for holders of `watchlist.manage_shared`; a shared tab they may not change shows only a dot
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
  `project`, `priority`, `copy`, `asker`; a requester has only `status`, in the public
  vocabulary) and the page/detail responses with per-field facet counts. `group=batch|project`
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
  denies every ask with one reason, bulk approve skips rescans and asks still being checked;
  each writes the status log. `arrangement.ts` holds the grouping and slicing both lists share.
  `fixtures/watchlists.ts` seeds three shared ones and a few per user. `VITE_MOCK_DOCUMENT_COPIES` (default 1)
  repeats the fixture documents through `src/mocks/volume.ts`, to try lists at volume. `createHandlers(profile)` serves it over MSW.
- Query hooks: `src/hooks/use-session-query.ts`, `src/features/documents/use-documents-query.ts`.
  Sidebar entries and their required permissions: `src/components/layout/navigation.ts`.
- `src/app.tsx` holds the providers and routes. `src/features/documents/` is the Documents view:
  the watchlist tabs, `document-filter-bar.tsx` (search, quick Decision and Progress, Mine,
  then the chips and "+ Add filter", left to right on one wrapping line) and `document-list.tsx`
  (stacked cards, or table rows on a subgrid once the list is 42rem wide; a group-by select in
  its count row, `document-group-header.tsx` over each group) and `document-detail.tsx`, the
  record beside it: the toned status note (`src/domain/status-notes.ts`, which also says whose
  desk it is on), stat tiles and a card per part, built from `src/components/detail-card.tsx`
  and `status-note.tsx`; a requester gets their own ask, why they asked and its story in plain
  words. The pane's actions (Ask for this too, Withdraw, More) are not built yet. The page URL holds the filter,
  `id`, `group` and `watchlist`, the tab the filter was opened from. A search with exactly one match opens it, once per search, so links
  from elsewhere name a document by an identifier (`?q=IT12`); `?id=` is the selection while
  browsing. `propose-dialog.tsx` is Propose: items typed, pasted or from a file, each checked as
  it lands (`src/api/proposals.ts`; identifier formats and line parsing in
  `src/domain/proposals.ts`), then why, a project and, with `request.decide`, approving at
  once, then a report; the mock (`src/mocks/proposals.ts`, `fixtures/catalog.ts`) resolves
  against a small catalog plus every fixture document. Catalog search, record links, barcode
  scanning and photo capture are not built. Still missing there: rendering only the visible rows once thousands are loaded, the reason line under a row, retrying a batch's failed additions,
  the phone Filter sheet and the Batch field. Not yet built in the shell: the Watchlists row
  with its "new" badge (which leaves shared watchlists out until "seen" is kept per person), the running-tasks row, the user menu and phone bottom tabs.
- `src/features/proposals/` is the Proposals view, on Documents' pattern: the watchlist tabs
  (view `proposals`), `proposal-filter-bar.tsx` (search, Decision, which opens on awaiting a
  decision and keeps a value, Proposal custody, then chips), `proposal-list.tsx` (a row per
  document with a line under it saying why it is there; grouped by the batch or requester of
  its earliest ask, `proposal-group-header.tsx`) and `proposal-detail.tsx`, built from the
  record cards Documents uses too (`src/components/record-cards.tsx`: who asked, existing
  copies, the catalog record, history and the heading), plus Placed in. A copy's link is in
  the pane, not on the row, which is one button. Message askers is not built.
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
- Keep responsive behavior intentional: the tablet demo keeps the master–detail split at 1024px; phone presents detail as a sheet. Do not shrink type simply to fit more columns.
- Match repository formatting and naming conventions. Update the Bun lockfile whenever dependencies change. Keep secrets out of source, examples, and browser-visible environment variables.

## First concrete milestone

Implement the app shell and Documents view with MSW fixtures. The page should be usable as a reader and as staff, show the correct *My Documents* / *Documents* label and data reach, support search and basic filter facets, open a record detail, and allow saving the current filter as a watchlist. Use the demos for composition and the current design docs for behavior when they disagree.

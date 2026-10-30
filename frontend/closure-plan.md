# Frontend closure plan

Step-by-step task files for the implementing model are kept out of git in `plans/luna/`
(U0, U1, U2, U3a, U3b, U3c), each run in its own worktree and branch.

Audit of 2026-10-29 on `feat/client-redesign`. It replaces the open parts of
`completion-plan.md` (Sessions C, E, F). Each session is one Codex run. Every session obeys
`ui-gates.md`; review cites its gate IDs.

## State at audit

- `tsc`: clean. Vitest: 68 files, 586 tests pass. Biome: **fails** (`ui/sidebar.tsx`
  noDocumentCookie, `main.tsx` non-null assertion, `use-session-query.ts` imports and format,
  `mocks/mix-catalog.ts` format).
- In flight, uncommitted from the previous agent: Mixes gets `FilterBar`, `WatchlistTabs` and URL
  state (`contract/src/mix-filters.ts`, `features/intentions/mixes-view.ts`, mixes mocks,
  watchlist contract). Finish and commit this before any session below starts.
- Colors: token-clean apart from 6 spots. Type: 81 uses of 4 off-scale `text-[…]` sizes.
- States: 2 of 20 pages use `PaneState`; 13 pages never read a query's error.
- System pages: only an inline *Signed out* in `app-shell.tsx` (raw `<button>`) and `NoAccess`
  in `app.tsx`. No login, not found, forbidden, service unavailable or crash page. Unknown
  paths and forbidden paths silently redirect to `/`. No `errorElement`.
- Not built from the completion plan: Home with destination cards (C), phone gestures (E),
  `completion-gaps.md` audit (F).

## U0 — Land the in-flight Mixes work

The Mixes work was committed in `d3a48990`/`bdd364fe`. Review follow-ups:
1. (Dropped: `hasUnallocatedProportions` cannot reuse `siblingSetOf`, whose shares are not
   nullable as the contract's are.)
2. Mix *Delete…* uses `ConsequenceDialog` and the destructive button variant, not a
   `DialogShell` and `className="text-destructive"`.
3. Tasks, Plugins, Schedules: drop `!pt-0 !pb-0`; give `PageContent` a padding prop instead.
4. Biome clean on the whole of `src` (`ui/sidebar.tsx`, `main.tsx`, `use-session-query.ts`).
5. Rename the generator `PriorityFirst` to `PriorityThenMix` in fixtures, tests and comments
   (`contract/src/lists.ts`, `domain/src/entities.ts`, `mocks/fixtures/lists.ts`,
   `mocks/fixtures/status-log.ts`, `api/lists.test.ts`).

**Review:** G-COMP-1, G-COMP-3, G-STYLE-6, G-DONE-1.

## U1 — Make the gates mechanical

1. Add the type steps from G-STYLE-2 to `globals.css` `@theme` (`--text-2xs`,
   `--text-caption`, `--text-ui` with their line heights). Replace every `text-[0.625rem]`,
   `text-[0.6875rem]`, `text-[0.8125rem]`; map the two `text-[0.9375rem]` to `text-sm` or
   `text-base` by context.
2. Fix the color spots: `plugin-table.tsx:147` (amber text → `text-tone-amber-foreground`),
   `pace-bars.tsx` `bg-neutral-400`, `status-badge.tsx` `dark` variant, `running-tasks-panel.tsx`,
   sidebar's `shadow-[… rgb(…)]` (→ a `--shadow-peek` token), `rounded-[4px]`/`rounded-[1px]`/
   bare `rounded`.
3. Write `frontend/tools/check-ui-gates.ts` and `bun run check:ui`: a grep-based checker of
   every **(check)** gate, with an allowlist file whose every entry carries a reason. Wire it into
   `make check`. It must fail on the current tree before step 1–2 and pass after.

**Review:** checker output before/after; no visual change except intended ones (screenshots of
Plugins, Intentions, sidebar peek, status badges).

## U2 — System pages and error routing

Decisions taken here (G-STATE-2…4); the spec for login is
`docs/reference/access/people.md#access-login-page` and ledger L4.

1. `components/layout/system-page.tsx`: `SystemPage` (logo, title, sentence, ≤2 actions,
   optional slot). Used outside the shell and inside it.
2. Pages: **Login** (`/login`: one entry per enabled Identity instance in order, form for local
   accounts, redirect button otherwise, language pick calling `pickLoginLanguage`; mock serves
   the instances from MSW: Local accounts, MZK Keycloak, Google, Seznam; after login return to
   the page that sent the person there, per `ACCESS-login-return`),
   **Signed out** (replaces the inline one; links to `/login`),
   **No access** (moves from `app.tsx`), **Not found** (`*` route), **Forbidden** (replaces
   `Gate`'s silent redirect), **Service unavailable** (session query fails with 5xx/network;
   retry with backoff, *Try again*), **Crash** (router `errorElement`, with a copyable error id).
3. MSW: a dev switch to simulate 503, network down and slow responses, so the pages can be
   seen (`make frontend-user`-style env var).
4. Tests: routing for 401/403/404/5xx/crash, login entries order, single redirecting instance
   skips the page.

**Review:** G-STATE-2…4, G-PAGE-1; screenshots of all seven pages, four sizes, light/dark.

## U3 — Query states everywhere

1. `components/query-state.tsx`: loading / error with retry / empty, copy per G-STATE-1.
   `Pane` uses it for its loading and error.
2. Move all 20 pages and the drawers onto it. Replace the 20 one-off `Loading …` strings.

**Review:** G-PAGE-5, G-STATE-1; with the U2 MSW switch on, every page shows an error, not a
blank region.

## U4 — Unify duplicates

1. `useSectionPreferences(boardId, sectionIds)` in `hooks/`, replacing
   `use-project-section-preferences.ts` and `use-intention-section-preferences.ts` (same logic,
   two copies). `SectionBoard` in `components/` for the collapsible sections both boards render.
2. Batch group headers: `documents/document-group-header.tsx` and
   `requests/request-group-header.tsx` each define `BatchHeader`; one shared batch header on
   `GroupHeader` with slots for the actions.
3. Badges: `RequestStatusBadge`, `SuspendedBadge`, `verdictBadgeOf`, `ProjectBadges`,
   `RunStateBadge` become `StatusBadge` variants or thin mappings to it.
4. Preferences → Watchlists (`preferences/watchlists-page.tsx`) is the outlier: raw `ui/table`,
   `ui/alert-dialog`, `ui/badge`. Move to `DataTable`, `ConsequenceDialog`, `StatusBadge`.
5. Native controls: `hook-editor.tsx` (4 `<select>`, 3 `<input>`), `list-editor.tsx`
   (3 `<select>`), `propose-ways.tsx`, `propose-dialog.tsx` (inputs, and direct `ui/dialog` and
   `ui/tabs`): move to shadcn and the dialog family. Raw `<table>` in `plugin-drawers.tsx`,
   `intention-dialogs.tsx`, `mix-set-card.tsx` → `DataTable` or a `FactGrid`.
6. `ListToolbar` is used by nobody outside `RecordList`; inline it or document why it is
   separate.

**Review:** G-COMP-1…5; diff should be net-negative lines. Screenshots of each touched view.

## U5 — Home (dropped)

Superseded by [VIEW-landing](../docs/reference/access/views.md#view-landing): there is no Home
page; `/` opens the first sidebar entry, or *No access yet*. The client already does this
(`Landing` in `app.tsx`). Dropped on 2026-10-30.

## U6 — Phone gestures

Completion plan Session E, unchanged. Report what needs a real device.

## U7 — Gaps ledger

Completion plan Session F, unchanged: create `completion-gaps.md`, one row per gap, then
implement only the confirmed, specified ones.

## U7b — Entry links and several publication links (after U2)

Ledger L70 and L69. Frontend and MSW only; the engine builds its side separately.
1. `/ask` (`ACT-entry-link`): opens *Propose…* over the start page with the item landed and
   checked, reason filled; `source` kept on the batch and shown on Requests' batch header and as
   a Requests filter; *Back to …* only to an allowed origin. Tests for every parameter, unknown
   source, disallowed `return`, signed-out round trip, no `request.create`.
2. Publication links (`LC-ITER-links`): contract `links[]` with `isPrimary`, where and who/when,
   replacing `publishedLink`; *Add link…*, *Replace link…*, *Make primary*, *Remove link…*
   through the dialog family; the record lists every link with the primary first, lists and
   tables show the primary with `+N`.

## U8 — i18n sweep (optional, before the Czech pass)

Move the remaining `labels move to i18n` files (110 TODOs) feature by feature. Can run in
parallel with the fake engine work.

## Then: fake engine

After U3 the frontend reports errors and empty states honestly, which the probabilistic engine
needs to be worth running against. Planned separately from the production data sample and the
plugin list.

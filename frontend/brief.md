# Session brief

The one file a session reads before it starts a step of `plan.md`. It holds
the rules, the code map and, per step, exactly which design sections to read.
Read nothing else up front; open a file below only when the step needs it.
`continuation.md`, `component-inventory.md` and `component-interfaces.md` are
reference: look a part up there by its section, never read them whole.

---

## 1. How a session runs

- One session does one step of `plan.md`, or half of one where it says
  *Session break*. Then it reports and **stops**; the user compacts and asks
  for the next. No subagents (they cost far more tokens than they saved).
- Each numbered sub-item of the step is one commit, in order.
- The report, which is all that survives the compaction: the commits (hash and
  subject); what was built and what was left out, with why; decisions taken
  and questions only the user can answer; shared parts added or extended; the
  checks and their result; where the screenshots are.
- The report ends with the prompt for the next session, in a code block ready
  to paste after the compaction:
  ```
  Read frontend/brief.md, then do step <n> of frontend/plan.md
  (<the part, e.g. "4.4–4.5, after the session break">).
  Carried from the last session: <open questions the user answered, shared
  parts added, anything the brief does not say yet; "nothing" if so>.
  ```

**Never:**
- read `app/`, `client/` or `webclient/` for design, or import from them;
- edit `docs/demos/*.html` or the design docs, unless the step says so;
- add navigation groups, dividers or any other taxonomy nobody asked for, or
  change the sidebar entries;
- push, or touch the user's dev server (`.frontend.pid`, port 5173);
- add `Co-Authored-By` or "Generated with" lines to a commit.

**When a decision is missing** (the sources are silent or disagree), do not
invent one. Build what is certain, leave a `TODO(rrandiak): …` naming the
question, and put the question in the report.

**Which source wins:** what the user said (dated *Decided* notes in the code
and docs, and `docs/demos/STATUS.md` *Decisions to trust*) → `rework.md` →
the design docs marked current → the notebook demo → the docs marked behind
(`view-catalog.md`, `page-composition.md`, `docs/README.md`; background only).
`filtering.md` is a draft; the demos' filters are not to be copied.

---

## 2. Conventions

Robert Randiak's coding conventions (the `coding-conventions:conventions`
skill, frontend profile); where the repository decided otherwise it wins:
double quotes, Vitest with jsdom.

- A `//` header on every file: what it is, why, the design doc it follows.
  Comments say why, never what.
- `TODO(rrandiak): …` for deferred work; `TODO(rrandiak): labels move to
  i18n.` in a file with user-facing strings.
- Full names; `is`/`has`/`can` booleans; no boolean parameters; guard clauses
  then a blank line; braces always; `const`.
- Vocabularies as `as const` arrays and zod enums; labels as
  `{ … } as const satisfies Record<Value, string>`.
- zod at the HTTP boundary (`src/api/`), pure derivations in `src/domain/`,
  views in `src/features/<view>/`, shared parts in `src/components/` and
  `src/hooks/`. No page-local data arrays; no dependency without a reason in
  the commit body.
- An action someone may not do is absent, never disabled. The mock enforces
  reach and permissions as the server will; the client only hides.
- Rule of three: the second use of something view-bound moves it to a shared
  part.

---

## 3. What exists

Stack: Bun, React 19, TypeScript, Vite, React Router 7, TanStack Query,
Tailwind v4 (palette in `src/globals.css`), shadcn/ui vendored in
`src/components/ui/` (`bunx shadcn add …` for more), MSW, React Hook Form,
zod v4.

**Shared parts.** Use and extend them; never fork a private copy.

| Need | Use |
|---|---|
| A list view's URL state | `ViewDefinition` (`src/lib/view-definition.ts`; `view` only when it has watchlists) in `features/<view>/<view>-view.ts`, read by `useViewUrlState` |
| Its filter bar | the definition's `fields` → `FilterBar` (`components/filters/`); value, reference, `numberRange` (with `presets`) and `dateRange` fields; the phone's `filter-sheet.tsx`; names via `useReferenceLabels` |
| Saved filters | `WatchlistTabs`; the active tab follows the full live filter. An unmatched filter appears as `Current search`, with actions to save a new watchlist or update an editable one. A new view adds its value to `watchlistViewSchema` (`domain/entities.ts`) and a comparer in `api/watchlists.ts` |
| Digitization Lists filters | `listsView` now declares State, Needs attention and Runs on `FilterBar`; its Current tab is a saved watchlist. `dateRange` fields may set `presets: []` for calendar intervals where relative presets would be misleading. |
| Projects filters | `projectsView` declares Decision, Period, Pace, Project dates (this/last/next calendar week or month), Time elapsed (%) and Delivered (pages) on `FilterBar`; four shared watchlists are seeded. `WatchlistTabs` scrolls the active tab into view horizontally, including after its data loads. |
| Categories filters | `categoriesView` declares Kind, Custody, Needs attention, Documents and Ready pages on the shared `FilterBar`; `WatchlistTabs` has Without custody and Mix gaps seeds. `domain/category-filters.ts` counts matching categories and derives facets; the shared `CategoryTree` keeps ancestors as dimmed context. The Mix picker selects an independent active mix and is saved with the filter; it displays shares without assigning actual output to the mix. Its Show picker stays a display preference, outside watchlists. |
| Intentions filters | `intentionsView` searches names/descriptions and repeat names; Type selects disjoint Targets, Output, and Repeats. Type, State, and Pace/attention are visible quick filters. Repeat frequency, mix, project, counting start/end dates, and planned/delivered/time percentages use the shared filter bar. Project includes named projects, Any project, and No project; these select the intention's project scope without implying financial funding. Percentages against target exclude records without a page target; repeats support their own applicable fields. Relative dates use the index's server day. Shared watchlists seed each type. One board shows Repeats first, then Running, Upcoming, Ended, and Archived; `CardSections` uses two notebook columns and per-person section preferences. |
| Mixes navigation | Categories shows Edit mix (or View mix) beside its mix picker, opening the selected mix's page. Mix detail has a Category level picker for Top level and every category with children; names with subcategories also drill down. Each level has its own proportions and Edit proportions action. Mixes keeps `/mixes` and `/mixes/:mixId` for its catalog, revisions, snapshots, and archive. The sidebar omits Mixes when Categories is available; someone with mix access but no Categories access retains the Mixes sidebar entry. |
| Independent mixes | `api/mix-catalog.ts`, `mocks/mix-catalog.ts`, and `features/intentions/mixes-page.tsx` cover named mixes, Primary, revisions, snapshots, copying, and archive. `/mixes/:id` is the direct editor; `/intentions/:id/mix` remains a contextual comparison link. Project intentions start without a mix. Archives preserve the displayed intention result and selected revision in mock state. See `docs/design/shared/entities/intentions-mixes-redesign.md` for current decisions and open proposals. |
| Remembered card sections | `CardSections` accepts `isOpen`, `onOpenChange` and `isHeadingHidden`; Projects uses `useProjectSectionPreferences` to remember each of its four sections per person in browser storage. A sole populated section has no heading and always shows its content. |
| List beside a pane | `MasterDetail` (`masterWidth="tree"` for a tree) + `RecordList` (columns, card under 42rem, why line, `GroupHeader`) + `usePagedList`; grouping via `groups` in the view definition and `mocks/arrangement.ts` |
| The pane | `Pane` / `paneStateOf` / `Outcome` (`components/pane-state.tsx`); `DetailCard`, `FactGrid`, `StatTiles` with an optional `meter` (`detail-card.tsx`), `StatusNote`, `record-cards.tsx` (askers, copies, catalog, heading; `HistoryCard` takes a log alone, without a document) |
| Actions | `ViewAction` + `ActionBar` (per-tier cap, `isInMenu` for More ▾); `PageHeader actions`, and `control` for a picker the whole view reads (wraps on a phone) |
| A tree beside a pane | `Tree` (`components/tree.tsx`): virtual root, value, ⚠, dimming, arrow keys; `CategoryTree` (`components/category-tree.tsx`: search, *Show* over the values a page offers, counts and/or a mix) with `category-tree-values.ts`; `custodyReachOf`, `unheldCategoriesOf`, `isInSubtree`, `searchedCategoriesOf`, `isOutsideScope`, and for changing the tree `scopeOfCategory` (a `category` scoped record), `placesFor`, `isNameTaken` in `domain/categories.ts`, `siblingSetOf` in `domain/mixes.ts` |
| Who may | `can()` (`domain/permissions.ts`) / `useCan()` with a scoped record; a run's own, self-scoped acts in `domain/tasks.ts` (`canCancelRun`, `canRunAgain`); the permission catalogue with the scopes each takes, `permissionCatalog`; roles and how they are held, permissions with their provenance and who a role's change reaches, `domain/access.ts` |
| When something runs by itself | `domain/schedules.ts`: `cadenceSchema`, `occurrencesOf`, `nextOccurrenceOf`, `repeatCadenceOf`, the 5-minute floor; server and editor preview share it |
| Dialogs | `components/dialogs/`: `DialogShell` (`head`, `onBack`, `secondary` for an editor's *Delete…*; `FormDialog` passes it), `ConsequenceDialog` (A, fed by a server dry run; `cancelLabel` where "Cancel" would read as the act: *Keep running*), `ReasonDialog` (B), `FormDialog` (C), `SteppedDialog` (F, with `StepIndicator`), `SetEditorDialog` (D: a set saved whole, a reason holding Save back, an optional *Who it reaches* step the instance fills, `width="wide"`; Proportions, category custody, the role editor), `PickerDialog` (E: a set ticked from a list, sections, search past 8, what the pick gives above it, a way the dialog does not change said under a row; group, custody and user pickers), `MessageDialog`; a wizard in the pane, `PaneWizard` (`components/pane-wizard.tsx`, routed by the page; Refine); people and groups picked one at a time, `AddSelect` and `RemoveButton` (`components/fields/picked-list.tsx`; Projects and category custody, until they move onto `PickerDialog`); who sees a watchlist, `ShareWatchlistDialog` (`components/filters/`, the server's reach) |
| Doing something | `useActionMutation` → `ActionResult`; refusals are RFC 9457 Problem Details, worded by the action's `refusalTexts[code]`, then `detail`, then by status; `invalidates` lists every query the change shows in |
| Tier | `useTier`, `valueForTier` (phone < 768, small < 1280, notebook < 1600, large); container queries for what the room decides |
| Words | `plural`, `formatDay`, `joinDetails`; a moment against the server's `asOf`, `agoText` and `aheadText` (`lib/format-moment.ts`); a schedule's cadence, `cadenceText` (`lib/format-cadence.ts`) |
| Saying what was done | `NoticeLine` (`components/notice-line.tsx`): a toned note with *Dismiss* and room for a link onwards; in an open drawer when there is one, since it covers the page on a phone |
| Iteration dialogs | `components/iteration-dialogs.tsx` (Reclassify), `classification-fields.tsx` |
| Two panes and a draft | `TransferEditor` (`components/transfer-editor.tsx`), `useDraft` + `isSameSet`, `usePicked`, `LeaveGuard` (`components/leave-guard.tsx`) |
| Words for numbers and days | `formatCount` and `formatPercent` (`lib/format-number.ts`), `formatCalendarDay`, `formatShortCalendarDay` |
| Cards in sections | `CardSections` + `RecordCard` (`components/card-sections.tsx`), sections of cards or `DataTable`s, the whole card a link when it has an `href`; `focusedId` marks and scrolls to a card or a table row |
| A full-width table | `DataTable` (`components/data-table.tsx`), columns per tier, a row opens its record, a note row under a row (`noteOf`), cards on a phone (`cardOf`), nested grouping (`groupBy`: a level collapses, names its own groups so an empty one shows, opens its header as a record; Plugins); no row actions or paging yet |
| Access relationships | `features/access/access-relationships.tsx`: a read-only, single-root neighborhood from a selected user, role, group, custody set, proposal or category; the access page uses `MasterDetail` for its four management views |
| A table whose row opens in a drawer | `TableWithDrawer` (`components/table-with-drawer.tsx`): `above`, the table, `below`, a 28rem drawer (full width on a phone) from the URL that does not hold the page; Tasks |
| Bars against a target | `PaceBars` (`components/visualizations/pace-bars.tsx`): the server's numbers, an even-pace mark; no time bar for an open-ended target |
| A run's progress, and runs over time | `RunProgress` (`components/visualizations/run-progress.tsx`, `card` or `sidebar`), `Timeline` (`components/visualizations/timeline.tsx`: a lane a schedule, dots, bands, hatched when paused); a run's state, `RunStateBadge` (`components/run-state-badge.tsx`); the words for triggers and durations in `features/tasks/task-words.ts` |
| Plugins | kinds, triggers, declarations and the difference between two versions in `domain/plugins.ts` (`declarationDifferenceOf`, `isRunnableContract`); an instance's link, `pluginInstanceHrefOf` (`?i=`); in the mock, each kind's enabled instances in order, `enabledInstancesOf` and friends (`mocks/plugin-instances.ts`), which any kind's consumer reads |
| A mix as bars | `MixBar` (one stacked bar, unallocated hatched), `MixBars` (intended over output) and `DriftMarker` (▲/▼ outside the band, the markers form) in `components/visualizations/mix-bars.tsx`, `shareToneOf` for a category's colour; one sibling set as a table, `MixSetCard` (`components/mix-set-card.tsx`) |
| A record's own page | `RecordPage` (`components/layout/record-page.tsx`: note, cards, aside, history), `PageHeader breadcrumb`, `MembersCard` (`components/members-card.tsx`) |
| A mix's shares | `effectiveShareOf` (`domain/mixes.ts`); `shareWithinOf` and the counting rules (planned, delivered, output, pace, drift, fill, mix owner and trackers, a correcting run's allocation, what a list counts towards and its fill against a mix, who may) in `domain/intentions.ts`; an intention's mix over the tree, its set writes and detach in `api/mixes.ts`; a project's target and pace are its own intention's (`intention.projectId`); `isInPool` in `domain/lists.ts`; mixes are `mocks/fixtures/intentions.ts`; list generators and classifiers are Plugins' instances (`mocks/fixtures/plugins.ts`), with what the mock plays them by in `fixtures/list-generators.ts` and `fixtures/classifiers.ts` |

**Not built yet** (the step that first needs one builds it, as a shared part,
from component-interfaces): `CardGrid` §1.4 (Home),
`SettingsPage` §1.8,
the Sparkline §5;
`DataTable`'s row actions and paging §2.4.

**The mock API** (`src/mocks/`): `handlers.ts` routes every request
(`createHandlers(profile)`); one module per resource applies reach, filters,
facets, order and grouping. `mutations.ts` holds `Outcome`/`Refusal`,
`writeLog`, `replaceIteration`; `problem.ts` answers refusals
(`problemResponse`, `invalidResponse`). `session.ts` resolves the profile into
grants and custody. Fixtures (`mocks/fixtures/`, demo "today" 2026-06-25,
`mocks/today.ts`, and its moment `mockNow()`, 10:40, standing still under tests and moving on in
the browser) already hold `lists.ts`, `projects.ts`, `intentions.ts`, `categories.ts`,
`batches.ts`, `users.ts`, `tasks.ts` (runs and schedules), `plugins.ts` (implementations with their versions, and every instance with its configuration and VERA's settings: the identity providers, the custody rule, generators, classifiers, message and delivery channels; written by Plugins; names via `usePluginInstancesQuery`), `access.ts` (roles, how each person holds them by hand or mapped, groups and direct custody, copied into the database, where Users management and Categories write them; `useGroupsQuery` lists groups, `useRolesQuery` roles by name); the entity schemas are in
`domain/entities.ts`. Every API module has tests over HTTP through MSW
(`src/api/*.test.ts`).

**Hooks mock API built (step 11.1):** `api/hooks.ts` holds the typed contracts and
paths; `domain/hooks.ts` owns batch and retry timing; `mocks/hooks.ts` owns
delivery state against `mockNow()` with fixtures in `fixtures/hooks.ts`.
Delivery channels are Plugins instances. Plugins' instance response includes
linked hooks and its impact includes their active count. `recordHookEvent` is
called by publication and list creation; other producers still need stable
public event data. `features/hooks/` now owns the grouped, filtered Hooks
master–detail, delivery actions and editor/test flow (step 11.2–11.3); it uses
`RecordList`, `FilterBar`, `DetailCard`, `DialogShell`, `ConsequenceDialog`,
`useViewUrlState` and `useActionMutation`. `useHooksQuery` invalidates linked
Plugin data after writes. Preview is a read-only public sample for `hook.read`;
the send-test endpoint still requires `hook.configure`.

**Views built:** `features/documents/`, `features/proposals/`,
`features/validations/` (the best model for a list with a pane and actions:
`validations-view.ts`, `validation-list.tsx`, `validation-detail.tsx`,
`validation-actions.tsx`), and `features/lists/` (browse, the editor,
Generate… and the list's acts; the model for a view without watchlists, for an
editor page, and for acts behind a server dry run), and `features/projects/`
(cards in sections, a record's own page, acts on both; the model for a page
that is not master–detail), and `features/intentions/` (two columns of cards that
open in place; an editor with a server preview, and a hand-off to the Lists editor by URL), and
`features/access/` (Users management: four tabbed, searchable master-detail tables, records with provenance, set editors and pickers), `features/categories/` (a tree beside a pane; the tree changed from the pane, custody written whole, a wizard in the pane), an intention's Mix in `features/intentions/mix-page.tsx` (a tree beside a pane, a set editor with a reach step), and `features/tasks/` (Tasks and Schedules: a table with a drawer, polling while something runs, a timeline, acts on a row; the model for anything read against the server's clock), and `features/plugins/` (a grouped table with two drawers, filtered in place; an editor built from what the record declares; an upload read by the server before it is installed). The sidebar's foot has the Running tasks panel (`components/layout/running-tasks-panel.tsx`). A filtered resource answers its facets with `facetCountsOf` (`api/facets.ts`). Routes in `src/app.tsx`,
sidebar entries in `components/layout/navigation.ts`.

---

## 4. One commit

1. **Mock API first:** zod contract in `src/api/`, fixtures coherent with the
   existing ones, handlers in `src/mocks/`, tests over HTTP; before any UI.
2. **UI** from §3.
3. **Tests** for what behaves: derivations, contracts, hooks. A bug fixed on
   the way gets a test that failed before.
4. **Checks**, from `frontend/`, all clean:
   ```sh
   bunx tsc -b
   bun run test
   F=$(git status --porcelain -uall . | grep -v '^ D\|^D ' | awk '{print $NF}' | sed 's|^frontend/||' | grep -E '\.(ts|tsx|css)$')
   bunx biome check --write $F   # changed files only: vendored ui/ has known errors
   ```
5. **Screenshots.** `make dev-roles` from the repository root (admin 5201,
   curator 5202, digitization 5203, staff 5204, reader 5205). Shoot each
   changed page at 1440×900, 1700×950 and 393×852 (1024×768 when small
   matters) as the users the step is about, look at every shot against the
   demo, fix before committing. Scripts live in the scratchpad
   (`bun add playwright@1.63.0`); move the mouse to the bottom-right corner
   before shooting so the rail stays shut; script dialogs with `getByRole`
   and run each action once for real.
6. **Records:** `../CHANGELOG.md` `[Unreleased]` in the user's words (no entry
   for a refactor with nothing to see). At the step's last commit: mark it
   done in `plan.md`, update `continuation.md` (present tense, what exists and
   where) and §3 of this brief if a shared part was added.
7. **Commit:** Conventional Commits, imperative, a body that says why.

---

## 5. Per step: what to read

The demo of a page is `docs/demos/notebook/<page>.html` →
`docs/demos/shared/page-<page>.js` (with `vera-ui.js`, `vera-data.js`); the
other tiers are `docs/demos/{large,small,phone}/<page>.html`. *STATUS
"Heading"* is a bold heading in `docs/demos/STATUS.md` (its line, as of
2026-10-06, in brackets: search for the heading, lines drift); read from it
to the next bold heading or bullet of the same level. Doc paths are under `docs/design/shared/`. Every step also
reads its row in `entities/permissions.md` §3.

### 4. Digitization Lists — page `lists`
- STATUS "Digitization Lists" (~443), and its bullet under *Carried into the
  pages, 2026-10-01* (~845).
- `view-map.md` §2 *4 — Digitization Lists*; `flows.md` *Lists* L1–L17 and
  *After scanning* P1–P3.
- `entities/intentions.md` §4 (generation) and §5 (a list's intention is
  derived, never attached); `entities/plugins.md` §4.9 (list generator).
- Parts: `TransferEditor` (interfaces §1.3), Selection §9.4, `useDraft` §9.5,
  `SteppedDialog` §6.7 (Generate…).
- Model: `domain/entities.ts` `digitizationListSchema`, `fixtures/lists.ts`.

### 5. Projects — page `projects`
- STATUS "Projects" (~485), and its bullet under *Carried into the pages*
  (~823).
- `entities/projects.md` (whole, short); `flows.md` *Projects* PJ1–PJ6.
- Parts: `CardSections`/`CardGrid` §1.4, `RecordPage` §1.5, `MembersCard`
  §4.4, PaceBar §5, `DataTable` §2.4 (Ended, Rejected).

### 6. Intentions — page `intentions`
- STATUS "Intentions" (~555; the model notes are long and all apply), and
  its bullet under *Carried into the pages* (~850); the *Distributions are not
  a visible entity* decision (~155).
- `entities/intentions.md` §2, §3, §6; `flows.md` *Mixes* M1–M7.
- Parts: PaceBar and MixBar §5; the editor is a `FormDialog`; 6.4 hands its
  allocation to step 4's `TransferEditor`.

### 7. Categories — page `categories`
- **First** `entities/concepts.md` *Category, mix, intention, project*
  (2026-10-07), and STATUS *Category, mix, intention, project, defined hard*.
  They win over the demo, which still edits the mix on Categories with `?i=`
  and gives a project a target of its own.
- STATUS "Categories" (~519), and its bullet under *Carried into the pages*
  (~853), read against the above.
- `entities/intentions.md` §1 (shares, the whole-set write, leaves), §2.3
  –§2.5 (editing a shared mix, on the intention's Mix, who may) and §3.4 (a
  project's intention); `entities/projects.md` §1.1;
  `entities/plugins.md` §4.13 (Classifier); `entities/permissions.md` §2
  (custody scope).
- Parts: `Tree` §2.5, `SetEditorDialog` §6.5 (Proportions; step 9 reuses it),
  `PaneWizard` §1.9 (Refine).

### 8. Tasks and Schedules — pages `tasks`, `schedules`
- STATUS "Tasks" (~616), and its bullet under *Carried into the pages*
  (~859).
- `navigation.md` §6 (the Running tasks panel); `page-composition.md` §5
  *Tasks* (current, unlike the rest of that file); `entities/plugins.md` §2.4
  (triggers).
- Parts: `TableWithDrawer` §1.6, `DataTable` §2.4; the timeline is new.

### 9. Users management — page `access`
- Four views at `/access`: Users, Roles, Groups, and Custodies. Searchable,
  scroll-loading tables open provenance details in a docked pane (phone sheet). Custodies manages named
  proposal custody sets and inspects category custody. Open proposals in a set are plugin output.
- Read `entities/users-management-redesign.md`, `entities/permissions.md` §1,
  §4, `entities/identity.md`, and `entities/proposal-custody.md` §1.
- Parts: `FilterBar`, `DataTable`, `MasterDetail`, existing access editors.
  Shared watchlists live in Preferences rather than this page.

### 10. Plugins — page `plugins`
- STATUS "Plugins" (~729).
- `entities/plugins.md` §1–§2 and §4 (the kinds, for each one's settings);
  §2.7–2.8 are Proposed.
- Parts: `TableWithDrawer` §1.6, `SteppedDialog` §6.7 (upload).

### 11. Hooks — page `hooks`
- STATUS "Hooks" (~748).
- `entities/plugins.md` §4.12 (delivery channel); `entities/messaging.md`.
- Parts: `MasterDetail`, `RecordList` with `GroupHeader`, `FormDialog`.

### 12. Home, Preferences and the shell — page `home`
- STATUS "Home" (~811), and *From the component pass, 2026-10-06* (~114):
  Preferences, phone gestures, shared watchlists.
- `navigation.md` §3.1 (gestures), §5 (watchlists), §7 (user menu), §8
  (Home).
- Parts: `CardGrid` §1.4, `SettingsPage` §1.8, phone gestures §8.1.

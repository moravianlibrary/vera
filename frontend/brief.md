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
| Saved filters | `WatchlistTabs`; a new view adds its value to `watchlistViewSchema` (`domain/entities.ts`) and a comparer in `api/watchlists.ts` |
| List beside a pane | `MasterDetail` (`masterWidth="tree"` for a tree) + `RecordList` (columns, card under 42rem, why line, `GroupHeader`) + `usePagedList`; grouping via `groups` in the view definition and `mocks/arrangement.ts` |
| The pane | `Pane` / `paneStateOf` / `Outcome` (`components/pane-state.tsx`); `DetailCard`, `FactGrid`, `StatTiles` with an optional `meter` (`detail-card.tsx`), `StatusNote`, `record-cards.tsx` (askers, copies, catalog, heading; `HistoryCard` takes a log alone, without a document) |
| Actions | `ViewAction` + `ActionBar` (per-tier cap, `isInMenu` for More ▾); `PageHeader actions`, and `control` for a picker the whole view reads (wraps on a phone) |
| A tree beside a pane | `Tree` (`components/tree.tsx`): virtual root, value, ⚠, dimming, arrow keys; `custodyReachOf`, `unheldCategoriesOf`, `isInSubtree` in `domain/categories.ts`, `siblingSetOf` in `domain/mixes.ts` |
| Who may | `can()` (`domain/permissions.ts`) / `useCan()` with a scoped record |
| Dialogs | `components/dialogs/`: `DialogShell` (`head`, `onBack`, `secondary` for an editor's *Delete…*; `FormDialog` passes it), `ConsequenceDialog` (A, fed by a server dry run), `ReasonDialog` (B), `FormDialog` (C), `SteppedDialog` (F, with `StepIndicator`), `MessageDialog`. Not built: `SetEditorDialog` (D), `PickerDialog` (E), see component-interfaces §6.5–6.6 |
| Doing something | `useActionMutation` → `ActionResult`; refusals are RFC 9457 Problem Details, worded by the action's `refusalTexts[code]`, then `detail`, then by status; `invalidates` lists every query the change shows in |
| Tier | `useTier`, `valueForTier` (phone < 768, small < 1280, notebook < 1600, large); container queries for what the room decides |
| Words | `plural`, `formatDay`, `joinDetails` |
| Iteration dialogs | `components/iteration-dialogs.tsx` (Reclassify), `classification-fields.tsx` |
| Two panes and a draft | `TransferEditor` (`components/transfer-editor.tsx`), `useDraft` + `isSameSet`, `usePicked`, `LeaveGuard` (`components/leave-guard.tsx`) |
| Words for numbers and days | `formatCount` (`lib/format-number.ts`), `formatCalendarDay`, `formatShortCalendarDay` |
| Cards in sections | `CardSections` + `RecordCard` (`components/card-sections.tsx`), sections of cards or `DataTable`s, the whole card a link when it has an `href`; `focusedId` marks and scrolls to a card or a table row |
| A full-width table | `DataTable` (`components/data-table.tsx`), columns per tier, a row opens its record; no grouping, notes or paging yet |
| Bars against a target | `PaceBars` (`components/visualizations/pace-bars.tsx`): the server's numbers, an even-pace mark; no time bar for an open-ended target |
| A mix as bars | `MixBar` (one stacked bar, unallocated hatched), `MixBars` (intended over output) and `DriftMarker` (▲/▼ outside the band, the markers form) in `components/visualizations/mix-bars.tsx`, `shareToneOf` for a category's colour |
| A record's own page | `RecordPage` (`components/layout/record-page.tsx`: note, cards, aside, history), `PageHeader breadcrumb`, `MembersCard` (`components/members-card.tsx`) |
| A mix's shares | `effectiveShareOf` (`domain/mixes.ts`); `shareWithinOf` and the counting rules (planned, delivered, output, pace, drift, fill, mix owner and trackers, a correcting run's allocation, what a list counts towards and its fill against a mix, who may) in `domain/intentions.ts`; `isInPool` in `domain/lists.ts`; mixes are `mocks/fixtures/intentions.ts`, list generators `mocks/fixtures/list-generators.ts` until plugins (step 10) |

**Not built yet** (the step that first needs one builds it, as a shared part,
from component-interfaces): `CardGrid` §1.4 (Home),
`TableWithDrawer` §1.6, `LinkedColumns` §1.7, `SettingsPage` §1.8,
`PaneWizard` §1.9, the other visualizations §5;
`DataTable`'s grouping, note rows, row actions and paging §2.4.

**The mock API** (`src/mocks/`): `handlers.ts` routes every request
(`createHandlers(profile)`); one module per resource applies reach, filters,
facets, order and grouping. `mutations.ts` holds `Outcome`/`Refusal`,
`writeLog`, `replaceIteration`; `problem.ts` answers refusals
(`problemResponse`, `invalidResponse`). `session.ts` resolves the profile into
grants and custody. Fixtures (`mocks/fixtures/`, demo "today" 2026-06-25,
`mocks/today.ts`) already hold `lists.ts`, `projects.ts`, `intentions.ts`, `categories.ts`,
`batches.ts`, `users.ts`, `access.ts`; the entity schemas are in
`domain/entities.ts`. Every API module has tests over HTTP through MSW
(`src/api/*.test.ts`).

**Views built:** `features/documents/`, `features/proposals/`,
`features/validations/` (the best model for a list with a pane and actions:
`validations-view.ts`, `validation-list.tsx`, `validation-detail.tsx`,
`validation-actions.tsx`), and `features/lists/` (browse, the editor,
Generate… and the list's acts; the model for a view without watchlists, for an
editor page, and for acts behind a server dry run), and `features/projects/`
(cards in sections, a record's own page, acts on both; the model for a page
that is not master–detail), and `features/intentions/` (two columns of cards that
open in place; an editor with a server preview, and a hand-off to the Lists editor by URL), and
`features/categories/` (a tree beside a pane, a picker in the header). Routes in `src/app.tsx`,
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

### 9. Users & Groups — page `access`
- STATUS "Users & Groups" (~671); the *Shared watchlists have an audience*
  decision (~139) and the *No `group_roles`* and *Guest is a role* ones (~179).
- `view-catalog.md` *Users & Groups* (current there, the rest is behind);
  `entities/permissions.md` §1, §4; `entities/identity.md`;
  `entities/proposal-custody.md` §1.
- Parts: `LinkedColumns` §1.7, `SetEditorDialog` (from step 7),
  `PickerDialog` §6.6.

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

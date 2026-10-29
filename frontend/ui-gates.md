# UI gates

Hard rules for every frontend change. A change that breaks one is rejected in review, whatever
else it does. `brief.md` explains the architecture; this file says what is allowed. Where they
disagree, this file wins for page shapes, components and styling.

Each gate has an ID so a review can cite it (`G-STYLE-3`). Gates marked **(check)** are enforced
by `bun run check:ui` once session U1 of `closure-plan.md` lands; until then the reviewer greps.

---

## 1. Pages: every route has exactly one shape

| Shape | Composition | Routes |
|---|---|---|
| **Master–detail** | `PageHeader` → `WatchlistTabs`? → `FilterBar`? → `MasterDetail` (master: `RecordList` with `GroupHeader`, or `Tree`; detail: `Pane` over `PaneState`, body of `DetailCard`s) | Documents, My documents, Requests, Validations, Lists, Hooks, Properties, Categories, Access, Mixes |
| **Board** | `PageHeader` → `WatchlistTabs`? → `FilterBar` → `SectionBoard` (collapsible sections, card grid, remembered open state) | Projects, Intentions |
| **Table + drawer** | `PageHeader` → `FilterBar`? → `TableWithDrawer` (`DataTable` + `DetailDrawer`) | Tasks, Schedules, Plugins |
| **Record page** | `PageHeader` with back → `RecordPage` → `DetailCard`s | Project, Intention mix, Mix |
| **Wizard / editor** | `PageHeader` → `PaneWizard` or `TransferEditor` | Category refine, List editor |
| **Settings** | `PageHeader` → `TabStrip` sections → `SettingsCard`s | Preferences |
| **System** | `SystemPage` (no shell, or inside the shell for in-app states; see §4) | Login, Signed out, No access, Not found, Forbidden, Service unavailable, Crash, Email-link pages |

- **G-PAGE-1** A new route names its shape in its file header and uses that composition. A new
  shape needs a decision in this table first.
- **G-PAGE-2** The shell never scrolls; `PageContent` or the shape's own regions do.
- **G-PAGE-3** Selection, filters, open record and open drawer live in the URL through
  `useViewUrlState`. Component state is only for things a reload may forget.
- **G-PAGE-4** A view that can be filtered and appears in `docs/reference/access/views.md` as
  watchlist-eligible shows `WatchlistTabs`. One that is not, does not.
- **G-PAGE-5** Every query-backed region renders all of: loading, error, empty, gone, ready
  (§4). A page that ignores `isError` is not done.

## 2. Components: use the shared one or extend it

- **G-COMP-1** Features import from `@/components/*`, not from `@/components/ui/*`, for anything
  that has a shared wrapper: dialogs (`FormDialog`, `ReasonDialog`, `ConsequenceDialog`,
  `SteppedDialog`, `PickerDialog`, `SetEditorDialog`, `MessageDialog`, `DialogShell`), tables
  (`DataTable`), drawers (`DetailDrawer`), sheets, tabs (`TabStrip`), status (`StatusBadge`).
  Allowed directly in features: `button`, `input`, `textarea`, `checkbox`, `radio-group`,
  `switch`, `select`, `label`, `popover`, `dropdown-menu`, `tooltip`, `separator`. **(check)**
- **G-COMP-2** No native `<select>`, `<input>`, `<textarea>`, `<table>` in `features/`. Native
  `<button>` only when it is a list row or tree node that a shared component cannot express, with
  a comment saying why. **(check)**
- **G-COMP-3** A component defined in a feature that another feature also needs moves to
  `components/` in the same change. Two near-identical local components (same props, same markup
  shape) are a review failure, not a follow-up.
- **G-COMP-4** Status is a `StatusBadge` variant (tone + label + icon or text that carries the
  meaning without color). No feature-local badge components.
- **G-COMP-5** Per-person remembered UI state (open sections, sidebar) goes through one hook
  per kind, never a feature-local `localStorage` wrapper. **(check: `localStorage` only in
  `hooks/` and `components/layout/`)**
- **G-COMP-6** A shared component that gains a prop updates `brief.md` §3 and
  `component-interfaces.md` in the same change.

## 3. Styling

- **G-STYLE-1** Colors only from `globals.css` tokens: `background`, `foreground`, `card`,
  `muted`, `accent`, `primary`, `secondary`, `destructive`, `border`, `input`, `ring`,
  `group-band*`, `chart-1..5`, `tone-{blue,red,green,amber,purple,slate}[-foreground]`,
  `sidebar-*`. No Tailwind palette colors (`text-amber-700`, `bg-neutral-400`, `bg-black`), no
  hex/rgb/oklch in TSX, no `dark:` color overrides (dark mode is the tokens' job). **(check)**
- **G-STYLE-2** Type scale is the named steps only:

  | Token | Size | Use |
  |---|---|---|
  | `text-2xs` | 0.625rem | counters, rail labels |
  | `text-caption` | 0.6875rem | fine print, table group meta |
  | `text-xs` | 0.75rem | secondary text, table cells, badges |
  | `text-ui` | 0.8125rem | controls, list rows |
  | `text-sm` | 0.875rem | body, card content |
  | `text-base` | 1rem | dialog titles |
  | `text-lg` / `text-xl` | — | page titles, system pages |

  No `text-[…]`. **(check)** Do not shrink type to make a layout fit.
- **G-STYLE-3** Radius: `rounded-md` controls, `rounded-lg` cards, panels and popovers,
  `rounded-full` pills, dots and avatars. Edge-only radii (`rounded-l`, `rounded-t`) are allowed
  for joined segments. No bare `rounded`, no `rounded-[…]`. **(check)**
- **G-STYLE-4** Arbitrary values: allowed for grid templates (`grid-cols-[…]`,
  `grid-rows-[…]`), `min()`/`calc()` sizes and `data-[…]`/`group-data-[…]` variants. Not allowed
  for color, shadow, z-index, radius, spacing or font size. Repeated arbitrary sizes become a
  token or a component prop. **(check)**
- **G-STYLE-5** Inline `style` only for data-driven geometry (bar widths, timeline positions,
  tree indentation by depth).
- **G-STYLE-6** Spacing follows the component it sits in; a page does not restyle a shared
  component through `className` beyond layout (width, grid placement, margin).
- **G-STYLE-7** Responsive: tier (`useTier`) decides navigation, docking, dialogs and the action
  cap; container queries decide columns. No ad-hoc `window.innerWidth`.
- **G-STYLE-8** Every interactive element shows focus with the `ring` token, and has hover,
  disabled and pending states. Motion respects `prefers-reduced-motion`.

## 4. States and system pages

- **G-STATE-1** One shared `QueryState` (or `PaneState` for panes) renders loading, error and
  empty. Loading copy is `Loading <plural noun>…`; error copy is
  `Could not load <plural noun>.` plus *Try again*; empty copy names what is missing and, when
  the person can, the action that fills it.
- **G-STATE-2** An `ApiError` with status 401 shows **Signed out** / login; 403 shows
  **Forbidden** in the shell; 404 on a record shows the pane's *gone* state; 5xx, network
  failure or a session query that cannot load shows **Service unavailable** with retry; a
  render crash shows **Crash** from the router's `errorElement`. A blank screen is never
  acceptable.
- **G-STATE-3** An unknown path shows **Not found** with a link home, instead of a silent
  redirect. A known path the person may not open shows **Forbidden**, naming who can grant it
  (`docs/design/shared/navigation.md`: an unavailable entry is an invitation to ask).
- **G-STATE-4** System pages share `SystemPage`: logo, title, one sentence, at most two
  actions, the language pick on the login page. Same component in and outside the shell.

## 5. Copy and i18n

- **G-COPY-1** New strings go through i18n keys; do not add to the 110 `labels move to i18n`
  TODOs. Touching a file with that TODO moves its labels.
- **G-COPY-2** The demos' design-explaining fine print never becomes UI text.

## 6. Every change

- **G-DONE-1** `bunx tsc -b`, `bun run test`, `bunx biome check src` and `bun run check:ui`
  pass. Biome is clean on the whole of `src`, not only changed files.
- **G-DONE-2** Screenshots at 393×852, 1024×768, 1440×900 and 1700×950, light and dark, for
  every changed view, listed in the change's report.
- **G-DONE-3** Tests cover derivations and interactions, not markup snapshots.
- **G-DONE-4** One concern per commit, Conventional Commits, no co-author trailers.

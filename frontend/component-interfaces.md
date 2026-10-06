# Component interfaces — draft

Draft props and contracts for the parts listed in `component-inventory.md`.
For each part: the interface, the configurations the pages need, and what
changes per tier. Nothing here is built. The names follow the conventions
(no abbreviations, `is`/`has` booleans, `as const` vocabularies). The types
are sketches, not checked by tsc.

Sources: `docs/design/shared/view-rules.md` (tiers, budgets, action caps),
`navigation.md` §3 and §8.4, `filtering.md` §3, `docs/demos/shared/vera.css`
and `page-*.js` (per-tier columns and layouts).

---

## 0. Tiers

### 0.1 The four tiers

A tier is a display, not a breakpoint (`rework.md`). Type stays the same and
the layout gives way, except at large, which steps back to 15px.

| Tier | Width (view-rules) | Reference | Root size | Navigation | Chrome budget |
|---|---|---|:-:|---|:-:|
| `large` | ≥ 1600px | 1920×1200 | **15px** | expanded sidebar | 28 |
| `notebook` | 1280–1599px | 1440×900 | 16px | rail, expandable | 18 |
| `small` | 768–1279px | 1024×768 | 16px | hamburger → left sheet | 10 |
| `phone` | < 768px | 393×852 | 16px | ☰ beside the title → left sheet; no bottom bar | 6 |

```ts
// src/hooks/use-tier.ts
export const tiers = ["phone", "small", "notebook", "large"] as const;
export type Tier = (typeof tiers)[number];

// The tier the window is in, from view-rules.md's ranges. The shell stamps it on <html> as
// data-tier, which sets the root size (15px at large) and per-tier tokens such as row height.
export function useTier(): Tier;

// A value that differs per tier. Notebook is required, since every page is designed there
// first. A missing tier takes the value of its nearest neighbour towards notebook:
// large → notebook; small → notebook; phone → small → notebook.
export type PerTier<Value> = { notebook: Value } & Partial<Record<Exclude<Tier, "notebook">, Value>>;
export function valueForTier<Value>(values: PerTier<Value>, tier: Tier): Value;
```

### 0.2 Tier or container

- **Use the tier** for what the display decides: the navigation, whether
  a pane docks or becomes a sheet, the dialog form, the action cap, the
  filter depth and the card-grid column count.
- **Use the container width** (Tailwind `@container`) for what the room
  decides: list columns, fact columns and stat-tile columns. The room
  changes with the sidebar and the docked pane, not only with the window.
  This is how `DocumentList` and `ProposalList` already work.

```ts
// Container widths a list or pane lays out by, in rem (Tailwind's @container sizes).
export const listWidths = { cards: 0, table: 42, wide: 56, full: 72 } as const;
export type ListWidth = keyof typeof listWidths;
```

What each tier gives a list, in rem at that tier's root:

| Shape | large | notebook | small | phone |
|---|---|---|---|---|
| master–detail list (half) | ~60 → `wide` | ~42 rail / ~37 expanded → `table` or `cards` | ~30 → `cards` | full width ~24 → `cards` |
| full-width table (Plugins, Tasks) | ~120 → `full` | ~85 → `full` | ~60 → `wide` | ~24 → `cards` |

> **Decided 2026-10-06:** the threshold stays at 42rem. At notebook the list
> is a table with the rail and turns to cards with the sidebar expanded.

### 0.3 Rules that hold at every tier

| Rule | large | notebook | small | phone |
|---|:-:|:-:|:-:|:-:|
| Primary-styled actions per screen (view-rules §5.2), the rest in `…` | 3 | 3 | 2 | 1 |
| Detail beside the list | docked | docked | docked, narrower list | full-screen sheet with Back |
| *Select a …* empty pane | shown | shown | shown | absent |
| Filter (filtering.md §3) | bar + Advanced | bar + Advanced in a modal | bar; advanced chips shown and removable only | one *Filter (n)* button → bottom sheet |
| Stat tiles | 3 | 3 | 2 | 1 |
| Fact grid columns | 2 | 2 | 2 | 1 |
| Pane measure cap | 64rem | — | — | — |
| Bulk actions | ✓ | ✓ | ✓ | at most 2, by long-press |
| Irreversible actions primary-styled | may be | may be | may be | **never** |

---

## 1. Page shapes

### 1.1 `PageHeader` + `ActionBar` (✅ header; 🆕 actions)

The header takes declared actions instead of a node. The cap in §0.3 is
then applied once, here and in the pane, rather than by each view.

```ts
export interface ViewAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  // Filled, at most the tier's cap; the rest fall into "…" in declared order.
  isPrimary?: boolean;
  // Red, and never primary on a phone (view-rules §5.3).
  isDestructive?: boolean;
  // An action to run, or a place to go. Never both.
  onSelect?: () => void;
  href?: string;
  // Opens a dialog: the label ends with "…".
  opensDialog?: boolean;
}

export interface ActionBarProps {
  // Already filtered by permission and record state: an action that is absent is not passed,
  // never passed disabled (view-rules §5.1).
  actions: readonly ViewAction[];
  // How many may be primary; defaults to the tier's cap.
  primaryCap?: number;
  size?: "header" | "pane";
}

export interface PageHeaderProps {
  title: string;
  actions?: readonly ViewAction[];
  // A line under the title at a detail page, e.g. "Projects / Moravica 2026".
  breadcrumb?: readonly { label: string; href: string }[];
}
```

**Configurations**

| Page | Header actions |
|---|---|
| Documents | *Propose…* (primary) |
| Proposals | — |
| Digitization Lists | *New list* (primary, `list.create`) |
| Projects | *New project* (primary, `project.create`) |
| Categories | — (*+ Top-level category* is on the root) |
| Intentions | *New intention*, *New repeat* |
| Schedules | *New schedule* |
| Users & Groups | *New local account*, *New group*, *New custody*, *New role*; one *New…* on the phone |
| Plugins | *Upload plugin code* |
| Hooks | *New hook* |

**Per tier:** at large and notebook the title is on the left and the actions
on the right. At small, ☰ sits before the title and the actions over the cap
fold into `…`. On the phone it is the same as small: ☰ and the title on the
left, one primary action and a `…` on the right, all on one line. There is
nothing fixed at the bottom of the screen: no tab bar and no action bar.

### 1.2 `MasterDetail` (✅, to extend)

```ts
export interface MasterDetailProps {
  master: ReactNode;
  detail: ReactNode;
  // Names the pane, and the sheet's heading on a phone.
  detailTitle: string;
  detailDescription?: string;
  // The selection is the URL's: `?id=` and friends (§9.1).
  isDetailOpen: boolean;
  onDetailClose: () => void;
  // The master's width when docked. "half" for a list read as a table, "fixed" for a tree or a
  // narrow list beside a wide record.
  masterWidth?: PerTier<"half" | { rem: number }>;
  // What the pane shows with nothing selected; never shown on a phone.
  emptyDetail?: ReactNode;
}
```

**Configurations**

| Page | master | `masterWidth` | `?` param | emptyDetail |
|---|---|---|---|---|
| Documents | RecordList | `half` | `id` | *Select a document* |
| Proposals | RecordList | `half` | `id` | *Select a proposal* |
| Documents Validations | RecordList | `half` | `id` | *Select an item* |
| Digitization Lists (browse) | RecordList | `half` | `list` | *Select a list* |
| Hooks | RecordList, grouped by subject | `half` | `hook` | *Select a hook* |
| Categories | Tree | `{notebook: {rem: 24}, small: {rem: 20}}` | `c` | the *All categories* root, never empty |

**Per tier**

| | large | notebook | small | phone |
|---|---|---|---|---|
| list | half, columns `wide` | half, columns `table` | half (min 18rem), `cards` | full width, `cards` |
| pane | docked, measure ≤ 64rem | docked | docked, padding 1rem | sheet over the list, Back in its head |
| selection change | pane swaps | pane swaps | pane swaps | sheet slides in and pushes a history entry; swipe ← → for the next or previous row; Back, ‹ or a swipe down closes it |

> **Decided 2026-10-06:** master–detail docks across the whole small tier,
> as in the demos, so the split moves from 1024px down to 768px. Below that,
> on the phone, the pane is a sheet.

### 1.3 `TransferEditor` (🆕) — Digitization Lists new and edit

```ts
export interface TransferEditorProps<Item> {
  // The strip on top: name, dates, target, mix, generation report.
  header: ReactNode;
  // What the editor started from and what it holds now (§9.5).
  draft: Draft<ReadonlySet<string>>;
  target: TransferPane<Item>;   // "On this list"
  source: TransferPane<Item>;   // "Ready to list"
  onMove: (ids: readonly string[], to: "target" | "source") => void;
  // "+N −M since opened", Save and Discard; Save waits for the server's refusals (§9.7).
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export interface TransferPane<Item> {
  title: string;
  items: readonly Item[] | undefined;
  columns: readonly ColumnDefinition<Item>[];
  // A head action, e.g. "Generate…" on the target; absent without a generator.
  action?: ViewAction;
  // The pool's own filter: category and search.
  filter?: ReactNode;
  // The line under a row: "generated — reason", "Taken off — back to Ready when you save",
  // a copy that appeared after approval.
  whyOf?: (item: Item) => ReactNode;
  // Below the pool: "12 more in Periodicals are waiting in review".
  footnote?: ReactNode;
  paging: PagedList;  // the pool can be large
}
```

**Configurations:** Lists `?new` and `?edit=ID` only. The same frame later
fits *Members* when a project has many of them, but nothing needs that yet.

**Per tier**

| | large | notebook | small | phone |
|---|---|---|---|---|
| panes | side by side, columns `wide` | side by side, `table` | **stacked**, each ≥ 16rem tall, `cards` | stacked, `cards` |
| move | buttons between the panes, and per row | same | a button per pane head ("Move 3 down") | same, picks by long-press |
| header strip | one row | wraps to two | wraps; the mix collapses to 2 columns | stacked fields |
| leaving with changes | blocked with *Discard changes?* | same | same | same |

### 1.4 `CardSections` + `CardGrid` (🆕) — Projects, Intentions, Home

```ts
export interface CardSection<Item> {
  id: string;
  title: string;                 // "Upcoming", "Ended", "Archived"
  items: readonly Item[];
  isCollapsedByDefault?: boolean; // Ended ▸, Archived ▸
  // An Ended section may turn into a compact table instead of cards.
  presentation?: "cards" | { table: readonly ColumnDefinition<Item>[] };
}

export interface CardSectionsProps<Item> {
  sections: readonly CardSection<Item>[];
  renderCard: (item: Item) => ReactNode;
  columns: PerTier<number>;
  // A tile at the head that counts items (never pages): "3 running · 1 behind pace".
  tile?: ReactNode;
  // `?p=` / `?i=`: scroll to the card and mark it.
  focusedId?: string | null;
}

// One card: title, badges, bars, a line of actions; Intentions expand in place.
export interface RecordCardProps {
  title: string;
  href?: string;
  badges?: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;             // PaceBars, MixBars
  note?: ReactNode;             // StatusNote: "No intention yet — Create one"
  actions?: readonly ViewAction[];
  expanded?: ReactNode;         // shown when expanded
}
```

**Configurations**

| Page | sections | columns | card body | presentation of the last sections |
|---|---|---|---|---|
| Projects | Active and upcoming · Ended · Rejected | `{large: 3, notebook: 2, small: 1}` | PaceBars (time, planned, delivered) | Ended and Rejected as tables |
| Intentions | two columns, *Targets* and *Tracking*, each with Running · Upcoming · Ended ▸ · Archived ▸ | one per column | PaceBars (targets) or MixBars (tracking) | cards |
| Home | one, no title | `{large: 4, notebook: 3, small: 2, phone: 1}` | — | phone: rows, not boxes |

**Per tier:** Intentions keeps its two columns at large and notebook. At small
and phone it shows one column, chosen by a *Targets / Tracking* switch
(`?col=track`). Projects collapses its detail grid to one column at small.

### 1.5 `RecordPage` (🆕) — Project detail

```ts
export interface RecordPageProps {
  header: PageHeaderProps;       // with breadcrumb back to the index
  note?: ReactNode;              // the pace in words
  aside?: ReactNode;             // a narrow column: facts, members
  children: ReactNode;           // the cards
}
```

**Per tier:** two columns (cards and aside) at large and notebook. One at
small and phone, with the aside on top.

### 1.6 `TableWithDrawer` (🆕) — Plugins, Tasks, Schedules

```ts
export interface TableWithDrawerProps<Row> {
  table: DataTableProps<Row>;    // §2.4
  // The open row, from the URL (`?run=`, `?impl=`, `?inst=`).
  openId: string | null;
  onClose: () => void;
  drawerTitle: string;
  drawer: ReactNode;
  // Running runs on top, tiles, the timeline.
  above?: ReactNode;
}
```

**Configurations**

| Page | above | rows | drawer |
|---|---|---|---|
| Tasks | tiles (Running, Failed in 7 days, Next run) and running cards | finished runs | the trigger, the items (All / Errors), what changed, the log; *Cancel* / *Run again* / *Download log* |
| Schedules | Timeline | schedules + intention repeats | — (rows open the editor dialog) |
| Plugins | — | type → implementation → instance | implementation contract, or instance configuration and runs |

**Per tier:** the drawer is 28rem at every tier and full width on the phone.
On the phone the table becomes cards.

### 1.7 `LinkedColumns` (🆕, bespoke) — Users & Groups

```ts
export interface LinkedColumn<Item> {
  id: "roles" | "users" | "groups";
  title: string;
  items: readonly Item[];
  renderItem: (item: Item, state: "selected" | "linked" | "dimmed" | "plain") => ReactNode;
}

export interface LinkedColumnsProps {
  columns: readonly [LinkedColumn<Role>, LinkedColumn<User>, LinkedColumn<GroupOrCustody>];
  // Lines from one item to another: solid by hand, dashed when mapped by an Identity instance.
  links: readonly { from: string; to: string; kind: "direct" | "mapped" | "member" }[];
  selected: { column: string; id: string } | null;  // ?u= ?g= ?r=
  onSelect: (column: string, id: string) => void;
  record: ReactNode;  // under the columns
}
```

**Per tier:** three columns with lines in the gutters at large, notebook and
small (narrower gutters). On the phone, tabs (Roles, Users, Groups,
Custodies, Watchlists), no lines, and links shown as tags ("via Periodicals
Curators").

**Shared watchlists here** (proposal; it changes filtering.md §4.5 and §5).
The third column holds groups, proposal custodies and **shared watchlists**.
A shared watchlist links to the groups and roles in its audience, so
selecting a role highlights the watchlists shared with it.

```ts
// Replaces scope: "personal" | "shared". Personal has no audience.
export type WatchlistAudience =
  | { kind: "personal" }
  | { kind: "everyone" }
  // Members of these groups and holders of these roles (directly or mapped), as a union. Never
  // past who may open the view.
  | { kind: "some"; groupIds: readonly string[]; roleIds: readonly string[] };

// The record under the columns.
export interface SharedWatchlistRecordProps {
  watchlist: Watchlist;
  audience: WatchlistAudience;
  // Resolved by the server: who it reaches, and who it would reach but who cannot open the view.
  reach: { userCount: number; outOfViewCount: number };
  // Share…, Rename…, Edit filter, Make personal…, Delete… (watchlist.manage_shared).
  actions: readonly ViewAction[];
}
```

The group, role and user records each gain a *Watchlists* card: shared with
this group, shared with this role, and what this person sees.

### 1.8 `SettingsPage` (🆕) — Preferences

`/preferences/:section`. The user menu leads here, and `/watchlists` redirects
to the Watchlists section.

```ts
export const preferenceSections = ["watchlists", "display", "account"] as const;
export type PreferenceSection = (typeof preferenceSections)[number];

export interface SettingsSection {
  id: PreferenceSection;
  label: string;
  // Absent sections are not passed: Account's password only for a local account.
  render: () => ReactNode;
}

export interface SettingsPageProps {
  title: string;                        // "Preferences"
  sections: readonly SettingsSection[];
  currentId: PreferenceSection;         // from the route
}
```

**Watchlists section**

```ts
export interface WatchlistManagerProps {
  // Grouped by view in sidebar order; the order within a view is the popover's.
  own: readonly WatchlistGroup[];
  sharedWithMe: readonly WatchlistGroup[];      // read-only, with Hide
  unreachable: readonly Watchlist[];             // a view they can no longer open: greyed, Delete
  onReorder: (view: WatchlistView, orderedIds: readonly string[]) => void;
  onBadgeChange: (watchlistId: string, hasBadge: boolean) => void;
  onHide: (watchlistId: string, isHidden: boolean) => void;
}

export interface WatchlistGroup {
  view: WatchlistView;
  rows: readonly {
    watchlist: Watchlist;
    filterSummary: string;              // "Material type: Periodical · Decision: Pending"
    itemCount: number | null;
    newCount: number | null;
    // Open, Rename…, Edit filter (opens the view on the tab), Share… / Delete…
    actions: readonly ViewAction[];
  }[];
}
```

Each row reuses DataTable (§2.4), grouped by view.

**Display section**

```ts
// The person's settings, kept on the server so they follow them between devices. Until the
// endpoint exists they stay in localStorage, as the sidebar and the remembered tab are today.
export interface UserSettings {
  sidebar: Partial<Record<"large" | "notebook", "expanded" | "collapsed">>;
  // Per view: reopen the last tab, or always a given one ("all" or a watchlist id).
  openingTab: Partial<Record<WatchlistView, { kind: "last" } | { kind: "fixed"; watchlistId: string | null }>>;
  density: "comfortable" | "compact";
  dateFormat: "relative" | "absolute";
}

export function useUserSettings(): {
  settings: UserSettings;
  update: (change: Partial<UserSettings>) => Promise<void>;
};
```

`useSidebarPreference` and `useRememberedWatchlist` then read from
`useUserSettings` instead of localStorage.

**Per tier**

| | large | notebook | small | phone |
|---|---|---|---|---|
| sections | a list on the left, the form on the right (≤ 48rem) | same | same, narrower list | the list is the page; a section opens as its own screen with Back |
| watchlist table | View · Watchlist · Filter · Items · New · Badge · actions | same | Watchlist · New · Badge · `…` (filter folded) | cards; drag replaced by Move up / Move down |

### 1.9 `PaneWizard` (🆕) — Categories refine

It uses the same step frame as `SteppedDialog` (§6.7), drawn inside the pane
and routed (`?refine=1`). On the phone it is the full-screen sheet.

---

## 2. Lists

### 2.1 `ColumnDefinition`

One declaration serves the cards and the table. A column too wide for the
room moves into the first cell's second line instead of disappearing. Plugins
already does this ("instance · type" at small).

```ts
export interface ColumnDefinition<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  // The track in the shared grid: "minmax(9rem,1fr)", "max-content", "fit-content(9rem)".
  track: string;
  isNumeric?: boolean;
  // The narrowest room it has its own column in. Below it, `foldedAs` (if any) goes into the
  // first column's second line, and in the card layout into the card's meta line.
  from?: ListWidth;
  foldedAs?: (row: Row) => ReactNode;
}
```

### 2.2 `RecordList` (♻️ from DocumentList and ProposalList)

```ts
export interface RecordListProps<Row, Group> {
  rows: readonly Row[] | undefined;
  rowId: (row: Row) => string;
  columns: readonly ColumnDefinition<Row>[];
  // The card layout's slots: the first column is the title; these fill the rest.
  card: { heading: (row: Row) => ReactNode; meta: (row: Row) => ReactNode };
  // The one line under each row that says why it is here (view-rules §1.1).
  whyOf?: (row: Row) => ReactNode;
  toolbar: ListToolbarProps;
  groups?: { items: readonly Group[]; startsAt: (group: Group) => number; header: (group: Group) => ReactNode };
  paging: PagedList;
  selection:
    | { kind: "one"; selectedId: string | null; onSelect: (id: string) => void }
    | { kind: "many"; picked: Picked; onToggle: (id: string, range: boolean) => void };
  emptyText: string;
  loadingText: string;
}

export interface ListToolbarProps {
  count: string | undefined;            // "34 documents · 41 asks"
  groupings?: { options: readonly { value: string; label: string }[]; value: string | null;
    onChange: (value: string | null) => void };
  // While a selection exists (view-rules §1.2: conditional chrome).
  selectionActions?: readonly ViewAction[];
}

export interface PagedList {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}
```

**Configurations**

| View | columns (wide → narrow) | why line | groupings | selection |
|---|---|---|---|---|
| Documents | Document · Status · Priority · Pages · Asked · Registries | the status note | batch, project | one |
| Proposals | Document · Status · Askers · Pages · Asked · Existing copy | copy, checking, project, reasons | batch, requester | one |
| Validations | Item · Defects · Category · Waiting · Priority | the outstanding defects | category, defect | one |
| Lists (browse) | List · State · Runs · Items · Pages · Delivered | — | — | one |
| Hooks | Hook · Channel → recipient · Event · 7 days · State | deliveries that gave up | subject (fixed) | one |
| List editor panes | ☐ · Document · Category · Priority · Pages | generated, taken off, copy | — | many |
| Bulk approve dialog | ☐ · Document · Pages | rescan, being checked | — | many |

**Per tier** follows from §0.2. At `cards` every row is a card: the title,
then one meta line with the badges and the folded columns, then the why line
clamped to two lines. At `table` and up the rows are on a subgrid with a
sticky header, and the why line runs across the row in a single line with an
ellipsis.

### 2.3 `GroupHeader` (♻️ frame from both group headers)

```ts
export interface GroupHeaderProps {
  title: ReactNode;            // "B-2026-014 · Catalogue import"
  meta?: ReactNode;            // "by Jana, 3 Sep · via file"
  counts?: ReactNode;          // "12 asks · 3 listed with an earlier ask"
  action?: ViewAction;         // "Approve 9…", "Retry failed"
  // A footnote of what the action leaves out: "2 rescans, 1 still being checked".
  footnote?: ReactNode;
  isCollapsible?: boolean;
}
```

It sticks under the toolbar and the table header. On the phone the action
moves into the header's `…`.

### 2.4 `DataTable` (🆕) — full-width tables

```ts
export interface DataTableProps<Row> {
  rows: readonly Row[] | undefined;
  rowId: (row: Row) => string;
  // Per tier, as the demos declare them; the dropped ones fold into the first cell (§2.1).
  columns: PerTier<readonly ColumnDefinition<Row>[]>;
  // Nested grouping: Plugins is type → implementation → instance.
  groupBy?: readonly GroupLevel<Row>[];
  // A note row under a row, full width: a failed run's red line with "Run again".
  noteOf?: (row: Row) => ReactNode;
  rowActions?: (row: Row) => readonly ViewAction[];
  onOpen?: (id: string) => void;
  openId?: string | null;
  paging?: PagedList;
  emptyText: string;
}

export interface GroupLevel<Row> {
  keyOf: (row: Row) => string;
  header: (key: string, rows: readonly Row[]) => ReactNode;
  isCollapsible: boolean;
}
```

**Configurations, columns per tier** (taken from the demos):

| Table | large | notebook | small | phone |
|---|---|---|---|---|
| Tasks, finished runs | What · Plugin · Trigger · Started · Took · State · Result | What · Trigger · Started · Took · Result | What · Result | cards |
| Schedules | What · Plugin · Cadence · Overlap · Last · Next · actions | What · Cadence · Last · Next · actions | What · Next · actions | cards |
| Plugins, instances | Instance · Configuration · Linked to · Runs · Last run · State | Instance · Configuration · Runs · Last run · State | Instance · Runs · State | Instance · State |
| Projects, Ended | Project · Dates · Target · Delivered | same | Project · Delivered | rows |

### 2.5 `Tree` (🆕) — Categories

```ts
export interface TreeProps<Node> {
  roots: readonly Node[];
  childrenOf: (node: Node) => readonly Node[];
  nodeId: (node: Node) => string;
  label: (node: Node) => ReactNode;
  // The number the Show picker chose: share of parent, of the whole, intended vs actual,
  // documents, pages, ready.
  value?: (node: Node) => ReactNode;
  // ⚠ on a parent whose sibling set is under 100.
  warning?: (node: Node) => string | null;
  // A scoped intention dims the rest of the tree.
  isDimmed?: (node: Node) => boolean;
  selectedId: string | null;   // ?c=
  onSelect: (id: string) => void;
  expandedIds: ReadonlySet<string>;
  onExpandedChange: (ids: ReadonlySet<string>) => void;
  // "All categories", above the roots.
  virtualRoot?: { label: string; value?: ReactNode };
}
```

Arrow keys move and expand. The width per tier is the master's (§1.2).

---

## 3. Filters and watchlists

### 3.1 The view declaration (§9.2) drives the bar

```ts
export type FilterFieldKind =
  | { kind: "vocabulary"; values: readonly string[]; labels: Record<string, string> }
  | { kind: "reference"; reference: ReferenceKind }   // users, projects, batches, custodies…
  | { kind: "answer" }                                // Yes / No
  | { kind: "dateRange" }                             // Asked, Started
  | { kind: "numberRange"; unit: string };            // Pages > 1000 (Advanced)

export interface FilterFieldDefinition<Query> {
  key: keyof Query & string;
  label: string;
  field: FilterFieldKind;
  // On the bar itself, reading "any" when empty; otherwise a chip once picked.
  isQuick?: boolean;
  // Only the Advanced editor builds it; smaller tiers show it as a removable chip.
  isAdvanced?: boolean;
}
```

### 3.2 `FilterBar` (♻️)

```ts
export interface FilterBarProps<Query> {
  definition: ViewDefinition<Query>;
  query: Query;
  facets: Facets | undefined;          // counts per value, from the first slice
  onQueryChange: (query: Query) => void;
  searchPlaceholder: string;
  // Toggles that are not fields, e.g. Documents' "Mine".
  extras?: ReactNode;
}
```

**Configurations**

| View | quick fields | chips | advanced |
|---|---|---|---|
| Documents | Decision, Progress (staff); Status (reader) | Category, Project, Batch, Material type, Existing copy, Restriction… | Pages range |
| Proposals | Decision, Proposal custody | Material type, Project, Existing copy, Asked by, Batch, Askers, After the project's approval | **Asked** date range |
| Validations | Show (Review needed…), Category | Defect, Priority | Waiting range |
| Lists | Show (Planned and running / Done / Everything) | Intention | dates |
| Tasks | State, Trigger | Plugin, Started by | Started range |
| Plugins | Type, State | — | — |
| Hooks | State | Subject, Channel | — |

**Per tier**

| | large | notebook | small | phone |
|---|---|---|---|---|
| search | field | field | field | field |
| quick fields | on the bar | on the bar | on the bar, wrapping | inside the sheet |
| chips | on the bar | on the bar | on the bar | the row of chips under one *Filter (n)* button |
| + Add filter | popover | popover | popover | inside the sheet |
| Advanced | inline editor | modal | read-only chip, removable | read-only chip, removable |
| watchlist tabs | tabs | tabs | tabs, scrolling | a select ("All ▾") |

### 3.3 `WatchlistTabs` (✅)

No change to its props. On the phone it needs a compact form (a select plus
the `+`), and the count stays opt-in.

---

## 4. Detail-pane parts

### 4.1 `PaneState` (♻️ from the Proposals page)

```ts
export type PaneState<Detail> =
  | { kind: "none" }                         // nothing selected
  | { kind: "loading" }
  | { kind: "gone"; text: string }           // "This proposal is no longer waiting here"
  | { kind: "outcome"; outcome: Outcome }    // after a decision
  | { kind: "ready"; detail: Detail };

export interface Outcome {
  title: string;
  tone: "green" | "slate";
  heading: string;                           // "Decided"
  summary: string;                           // "Approved into Periodicals at High"
  next?: { label: string; href: string };    // "Open in Documents"
}

export interface PaneProps<Detail> {
  state: PaneState<Detail>;
  emptyText: string;
  render: (detail: Detail) => ReactNode;
}
```

Used by Documents, Proposals, Validations (after Accept or Deny), Lists and
Hooks. On the phone `none` never shows, since the sheet is closed.

### 4.2 `PaneHeading` (♻️ from `RecordHeading`)

```ts
export interface PaneHeadingProps {
  title: string;
  identifier?: string;          // mono line
  badges?: ReactNode;
  subline?: ReactNode;
  actions?: readonly ViewAction[];   // ActionBar size "pane", cap per tier
  breadcrumb?: readonly { label: string; href: string }[];  // Categories path
}
```

### 4.3 `HistoryCard` (♻️ for any subject)

```ts
export type HistorySubject =
  | { kind: "document"; id: string }
  | { kind: "project"; id: string }
  | { kind: "list"; id: string }
  | { kind: "category"; id: string }
  | { kind: "access"; id: string }      // user, group, custody, role
  | { kind: "hook"; id: string };

export interface HistoryCardProps {
  subject: HistorySubject;
  audience: "staff" | "public";         // the public wording and dedup (oncePerCause)
  limit?: number;                       // "Show all N"
}
```

### 4.4 `MembersCard` (🆕)

```ts
export interface Member {
  kind: "user" | "group";
  id: string;
  role?: string;                        // "manager", "member"
  // How it is held: "direct", "via Periodicals Curators", "mapped by MZK Keycloak".
  provenance?: Provenance;
}

export interface MembersCardProps {
  title: string;                        // "Members", "Who decides"
  members: readonly Member[];
  action?: ViewAction;                  // "Edit members…"
  emptyText: string;
}
```

Used for project members, group members, custody members and category
custody.

### 4.5 `DefectCard` (🆕) — Validations

```ts
export interface DefectCardProps {
  defect: Defect;                       // internal text, what askers read, plugin
  // Nothing is corrected here but the page count, which re-runs the checks (decided 2026-10-06);
  // the rest is repaired in the catalog and picked up by Recheck.
  canEnterPageCount?: boolean;
  verdict?: Verdict;                    // accepted by whom and when, with Revoke
}
```

### 4.6 Already built

`DetailCard`, `FactGrid`, `DetailRow`, `StatTiles`, `FinePrint`, `Muted`,
`StatusNote`, `AskersCard`, `CopiesCard`, `CatalogCard`. Only their
per-tier column counts move from `lg:` to container queries (§0.2).

---

## 5. Visualizations

Every one of them takes numbers the server computed.

```ts
export interface PaceBarsProps {
  target: number;                       // pages
  timeElapsed: number;                  // 0..1
  planned: number;
  delivered: number;
  // Shown on planned and delivered; absent when nothing is funded yet.
  evenPace?: number;
  verdict?: "onPace" | "behindPace" | "fullyPlanned" | "targetMet" | { shortBy: number };
  density?: "card" | "detail";
}

export interface MixBarsProps {
  categories: readonly { id: string; label: string; intended: number; actual: number }[];
  band: number;                         // ±5 points
  // Tracking cards stack the two bars; the Categories row shows ▲/▼ only.
  form: "stacked" | "markers";
}

export interface SparklineProps {
  points: readonly number[];            // seven days
  tone?: Tone;
  label: string;                        // accessible text: "12 sent in 7 days"
}

export interface RunProgressProps {
  done: number;
  total: number | null;                 // unknown → indeterminate
  errors: number;
  timeLeft?: string;
  form: "card" | "sidebar";
}

export interface TimelineProps {
  range: "day" | "week" | "month";
  rows: readonly { id: string; label: string; runs: readonly Date[]; isPaused: boolean }[];
  now: Date;
}
```

**Per tier**

| | large | notebook | small | phone |
|---|---|---|---|---|
| PaceBars labels | beside the bar | beside | beside | above the bar (4rem label column) |
| MixBars | every category | every category | every category | the top five, then *+N more* |
| Timeline axis ticks | every 3 h / day | same | same | every 6 h / 10 days; denser bands sooner |
| Stat tiles in Tasks | 3 across | 3 | 2 | one line of text |

---

## 6. Dialogs

### 6.1 `DialogShell` (🆕) — every dialog

```ts
export interface DialogShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;                        // "Delete Moravica 2026?", "Members — Periodicals"
  // Steps drawn in the head, numbered and joined by a line (the original Submit Proposals).
  steps?: { labels: readonly string[]; current: number };
  width?: "regular" | "wide";           // 36rem / 56rem (role editor, transfer-like pickers)
  // While true, closing asks "Discard changes?" first (page-composition §1, editor).
  isDirty?: boolean;
  footer: DialogFooter;
  children: ReactNode;
}

export interface DialogFooter {
  // Back, on the left, in stepped dialogs.
  secondary?: { label: string; onSelect: () => void };
  primary: {
    label: string;
    isDestructive?: boolean;
    isPending?: boolean;
    isDisabled?: boolean;               // only while a required field is empty
    onSelect: () => void;
  };
  cancelLabel?: string;                 // "Cancel"; "Close" on a result screen
}

// A server refusal, kept beside the fields that were typed.
export interface DialogRefusal {
  status: 403 | 404 | 409 | 422;
  message: string;
  field?: string;
}
```

**Per tier**

| | large | notebook | small | phone |
|---|---|---|---|---|
| form | centred, 36rem (wide 56rem), 8vh from the top | same | same; wide becomes full width minus 1rem | **full-screen sheet**, head and foot fixed |
| footer | Back left · Cancel · Primary | same | same | Primary full width; Cancel in the head as × |
| destructive primary | red filled | red filled | red filled | red outline (never primary on phone) |
| step labels | numbers and labels | same | same | numbers only, the current label beside |

> **Decided 2026-10-06:** a full-screen sheet on the phone, where the demos
> draw the centred modal. It suits the long forms (Propose, the hook editor)
> and leaves room for the on-screen keyboard.

### 6.2 Kind A — `ConsequenceDialog`

```ts
export interface ConsequenceDialogProps {
  title: string;                        // "Delete L-2026-012?"
  // Fetched from the server's dry run when opened, never computed here.
  consequences: UseQueryResult<readonly Consequence[]>;
  confirmLabel: string;                 // "Delete list"
  isDestructive: boolean;
  onConfirm: () => Promise<void>;
}

export interface Consequence {
  text: string;                         // "214 documents return to the pool as Ready"
  tone?: "plain" | "amber" | "red";
}
```

| Instance | Consequences said |
|---|---|
| Delete list | returned to the pool, digitized keep their status, cancelled stay held, blocked go to Enqueued |
| Mark list Done | how many move to Digitized, how many are not digitized yet |
| Delete project | only while empty: "nothing depends on it" |
| Delete category | only a leaf with no documents |
| Delete role | what each holder keeps |
| Delete custody | its proposals fall to the fallback; rules that still name it |
| Delete or disable plugin instance | what stops, per type ("the last generator — Generate disappears") |
| Delete hook | undelivered deliveries are dropped |
| Delete schedule | stops running by itself, runs stay |
| Detach intention | gets its own copy of the mix |
| Discard delivery | not sent; nobody is told |

### 6.3 Kind B — `ReasonDialog`

```ts
export interface ReasonDialogProps {
  title: string;
  // What every asker reads; required whenever a reader can see the result (view-rules §5.4).
  publicText?: { label: string; isRequired: boolean; hint: string };
  internalNote?: { label: string; isRequired: boolean };
  // Fields before the texts: the rule (Forbid), the defects (Deny), the cause (Could not be
  // digitized).
  fields?: ReactNode;
  // What the action reaches: "3 askers will read this".
  reach?: ReactNode;
  confirmLabel: string;
  isDestructive: boolean;
  onConfirm: (texts: { publicText: string; internalNote: string }) => Promise<void>;
}
```

| Instance | public text | internal | extra fields |
|---|:-:|:-:|---|
| Decline proposal | required | optional | — (♻️ from `DecideCard`) |
| Reject project | required | optional | what stays with other askers |
| Deny in validation | follows the defect pick | optional | which defects are substantial |
| Forbid | required | optional | rule |
| Cancel item (Lists, Validations) | required | optional | — |
| Could not be digitized | required | optional | cause |
| Pause schedule, pause hook | — | required ("shown on the row") | — |
| Cancel run | — | optional | — |

### 6.4 Kind C — `FormDialog`

```ts
export interface FormDialogProps<Values> {
  title: string;
  schema: z.ZodType<Values>;            // zod at the boundary; React Hook Form inside
  defaultValues: Values;
  render: (form: UseFormReturn<Values>) => ReactNode;
  // A warning computed from the values, e.g. "an approved project: dates still change",
  // "this list will not count towards X".
  warningOf?: (values: Values) => ReactNode;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
}
```

| Instance | fields |
|---|---|
| New / Edit project | name, description, dates, target, manager |
| Approve project | priority; lists what it approves and the copies it skips |
| New / Edit intention | name, funding, category subtree, mix (*Track* / *Own, copied from*), target, start (locked once created), end |
| New / Edit repeat | template, cadence, *archive previous* |
| New / Edit schedule | plugin instance, Repeat, overlap, next three runs |
| New / Edit hook | name, event, filter, channel, recipient, message template, timing, retries, *Send a test* |
| New / Edit plugin instance | configuration (CodeField), triggers |
| New / Edit group, custody | name, description; a custody's rule shown read-only |
| New / Edit category | name, parent (not under a leaf with documents) |
| New local account | name, login, roles |
| Keep runs for | days, failed and cancelled days |
| Reclassify | category, priority; *handed over* when outside custody |
| Set where it is available | the link |

### 6.5 Kind D — `SetEditorDialog`

The set is saved whole, and Save first shows who the change reaches.

```ts
export interface SetEditorDialogProps<Entry> {
  title: string;
  entries: readonly Entry[];
  renderEntry: (entry: Entry, onChange: (next: Entry) => void) => ReactNode;
  // Refusals the client can see before asking: over 100, no access.manage left.
  invalidReasonOf: (entries: readonly Entry[]) => string | null;
  // The second step: what changes and who it reaches, from the server.
  reach: (entries: readonly Entry[]) => Promise<ReactNode>;
  onSave: (entries: readonly Entry[]) => Promise<void>;
}
```

| Instance | entry | invalid when | reach |
|---|---|---|---|
| Proportions | child category, percent (empty = no share, 0 = excluded) | sum > 100 | the intentions tracking this mix, ticked; unticked keep the old one |
| Role editor (wide) | permission × scope | nobody keeps `access.manage` | the users who gain or lose what |
| Category custody | group or user | — | who it reaches, with provenance |

### 6.6 Kind E — `PickerDialog`

```ts
export interface PickerDialogProps<Item> {
  title: string;
  search: (text: string) => UseQueryResult<readonly Item[]>;
  itemId: (item: Item) => string;
  renderItem: (item: Item) => ReactNode;
  initiallyPicked: ReadonlySet<string>;
  // Per item: "manager" for one member.
  roleOf?: { options: readonly string[]; value: (id: string) => string };
  // "Adding somebody here gives them …".
  consequenceOf?: (picked: ReadonlySet<string>) => ReactNode;
  onSave: (picked: ReadonlySet<string>) => Promise<void>;
}
```

| Instance | items | role |
|---|---|---|
| Project members | users | manager (one), member |
| Group members, custody members | users, groups | — |
| Groups of a user | groups | — |
| Roles of a user | roles | — (mapped roles shown, not removable) |
| Link an identity | identity instances + subject | — |
| **Share watchlist…** | Everyone, or groups and roles | — ; `consequenceOf` says how many people it reaches and any of them who already keep the same filter |

`Share watchlist…` needs one more shape than a flat list: a choice between
*Personal*, *Everyone* and *Some*, with a group-and-role picker under *Some*.
It is the picker with a `mode` header:

```ts
export interface ShareWatchlistDialogProps {
  watchlist: Watchlist;
  audience: WatchlistAudience;
  groups: readonly Group[];
  roles: readonly Role[];
  // From the server: "reaches 14 people; 2 of them already keep this filter".
  reachOf: (audience: WatchlistAudience) => UseQueryResult<{ userCount: number; duplicateCount: number }>;
  onSave: (audience: WatchlistAudience) => Promise<void>;
}
```

It opens from the watchlist tab's menu (replacing *Share with everyone*),
from Preferences → Watchlists, and from the Users & Groups record.

### 6.7 Kind F — `SteppedDialog`

```ts
export interface DialogStep<State> {
  label: string;                        // "Items", "Details", "Submitted"
  render: (state: State, setState: (next: State) => void) => ReactNode;
  canAdvance: (state: State) => boolean;
  // Leaving the step may call the server (Generate's preview, Upload's validation).
  onAdvance?: (state: State) => Promise<State>;
}

export interface SteppedDialogProps<State> {
  title: string;
  steps: readonly DialogStep<State>[];
  initialState: State;
  // The last step, after submitting: a result screen with "Close" and a link onwards.
  result: (state: State) => ReactNode;
  submitLabel: (state: State) => string;  // "Propose 12", "Approve 9"
  onSubmit: (state: State) => Promise<State>;
}
```

| Instance | steps |
|---|---|
| Propose (✅) | Items → Details → Submitted |
| Bulk approve (✅) | Items with category and priority → Result |
| Generate a draft | pages, categories, *Shape by* intention, generator → preview of the fill → into the editor |
| Correcting list | allocation per category (intended, output, new, after, Ready) → into the editor (`?alloc=`) |
| Upload plugin version | file → validation result → activate |
| Test hook | preview per interface → sent |
| Change the mix (Kind D's reach) | the edit → the trackers to tick |

### 6.8 `MessageDialog` (🆕)

```ts
export interface MessageDialogProps {
  about: { label: string; href: string };   // "Brněnský deník · D23", its link
  // Resolved by the server from the record: askers, project members, admins.
  recipients: UseQueryResult<readonly Recipient[]>;
  // Message plugin instances (mailto, Slack, ticket); one is picked.
  channels: readonly MessageChannel[];
  // VERA keeps no text: this hands off, usually as a pre-filled redirect.
  onHandOff: (channelId: string, recipientIds: readonly string[]) => void;
}
```

Used by *Message askers…* (Proposals), *Message members…* (Projects),
*Message admins…* (Validations, Forbidden) and the list owners (Documents).

---

## 7. Fields

| Field | Interface sketch | Notes per tier |
|---|---|---|
| `Field` ✅ | `{label, hint?, error?, children}` | — |
| `CategorySelect` ✅ | `{value, onChange, isLeafOnly, scopeId?}` | phone: full-width |
| `PrioritySelect` ✅ | `{value, onChange, prefilledFrom?}` | — |
| `ReferencePicker` 🆕 | `{reference: "users" \| "groups" \| "projects" \| "intentions" \| "lists", value: string[], onChange, isMultiple, filter?}` | a popover with search; phone: a sheet |
| `IntentionSelect` 🆕 | `ReferencePicker` with `filter: isMixOwner` | no chains |
| `DateField`, `DateRange` 🆕 | `{value, onChange, min?, max?}`; DateRange adds presets (last 7 days, this month) | phone: native date input |
| `StartField` 🆕 | `{value: {kind: "now"} \| {kind: "on", date}}` | — |
| `PagesField` 🆕 | `{value, onChange, target?}` showing *N of target* | — |
| `PercentageField` 🆕 | `{value: number \| null, onChange}`, empty = no share | — |
| `ScopeSelect` 🆕 | `{permission, value, onChange}`, offering only the scopes it accepts | — |
| `RepeatField` 🆕 | `{value: {every: number, unit: "minutes" \| "hours" \| "day" \| "week" \| "month"}, onChange}`, plus the next three runs | shortest 5 min |
| `CodeField` 🆕 | `{language: "jq" \| "json", value, onChange, validate?}` | phone: read-only with *Edit on a larger screen* |
| `TemplateField` 🆕 | `{value, placeholders: string[], onChange}` | — |
| `ReasonFields` 🆕 | Kind B's two texts as one component | — |

---

## 8. Shell

```ts
// The four tiers' navigation, picked by useTier().
export interface ShellProps { children: ReactNode }

// small and phone: ☰ before the page title opens the sidebar as a left sheet (no bottom tabs,
// decided 2026-10-06). Only the button opens it: a swipe in from the edge is the system's Back.
export interface NavigationButtonProps { onOpen: () => void }

// Phone: swiping between sidebar entries uses useSwipeBetween (§8.1) over the visible entries,
// enabled only while nothing is open over the page.

export interface WatchlistPanelProps {       // the sidebar foot, grouped by view, counts
  watchlists: readonly WatchlistSummary[];
}

export interface RunningTasksPanelProps {    // absent when nothing runs
  runs: readonly RunSummary[];
}

export interface UserMenuProps {             // Preferences, Change password, Sign out
  session: Session;
}

export interface HomeCard {                  // navigation.md §8.3
  entryId: string;
  job: string;                               // in the words of the person doing it
  waiting?: { count: number; label: string };  // absent at zero
}
```

**Per tier**

| | large | notebook | small | phone |
|---|---|---|---|---|
| navigation | expanded sidebar | rail (toggle remembered per tier) | ☰ beside the title → sheet | ☰ beside the title → sheet; swipe ← → for the next or previous entry |
| Watchlists | foot row → popover | rail dot → popover | in the sheet | in the sheet |
| Running tasks | panel with bars | a dot on the rail | in the sheet | in the sheet |
| user menu | foot popover | foot popover | in the sheet | in the sheet |
| Home | 4 columns | 3 | 2 | rows |

### 8.1 Phone gestures

The same horizontal swipe means one thing per layer: on a page it moves
between sidebar entries, and on an open record it moves between records.
Closing is never a horizontal swipe, so the two never compete.

| Gesture | Where | Does |
|---|---|---|
| **Swipe ← / →** on a page | nothing open over it | next / previous sidebar entry the person holds, in sidebar order, no wrap |
| **Swipe ← / →** on a record | the open record sheet (master–detail) or drawer (Tasks, Plugins) | next / previous row of the list it was opened from, in the list's order and grouping, loading the next slice near the end. The list behind follows, so closing lands on the record you ended on |
| **Back** | any record, drawer, filter sheet, nav sheet or dialog | closes it. Three ways: the system's Back (button or edge swipe), the ‹ in the sheet's head, or a **swipe down** started on the sheet's head |
| **Long-press** a row | lists with picking (list editor, bulk approve) | starts picking, then a tap toggles (view-rules §5.5) |
| Pull down *(optional)* | the top of a list | refetch; only if focus refetching proves not enough |

**What keeps them apart**

- **One layer at a time.** The entry swipe is off while anything is open. The
  record swipe lives only on the sheet.
- **Not on things that scroll sideways.** Neither swipe starts on watchlist
  tabs, chips, a wide table or a text field.
- **Not at the screen's edges.** Neither swipe starts within the edge zones,
  where iOS and Android put their own Back. So the nav sheet opens only from
  ☰.
- **Back has a history entry to pop.** On the phone, opening a record pushes a
  history entry. Moving between records replaces it, so Back closes the sheet
  in one step however many records you swiped through.
- **Not in dialogs.** A dialog takes no horizontal swipe, and with typed text
  it answers Back with *Discard changes?* (§6.1).
- **The motion shows where you are going.** The page or record follows the
  finger and settles, or springs back below a threshold. The neighbour's name
  peeks in from the side ("Proposals ›", "D24 ›"), and at an end nothing moves.

```ts
// A horizontal swipe between neighbours, shared by the entry and record layers.
export function useSwipeBetween<Item>(options: {
  items: readonly Item[];                 // entries, or the list's loaded rows
  currentId: string | null;
  idOf: (item: Item) => string;
  labelOf: (item: Item) => string;        // the name that peeks in
  onSelect: (id: string) => void;
  onNearEnd?: () => void;                 // the record layer loads the next slice
  isEnabled: boolean;
}): { bind: SwipeHandlers; previous?: Item; next?: Item };

// Swipe down from a sheet's head to close it, beside the system's Back and the ‹.
export function useSwipeToClose(onClose: () => void): SwipeHandlers;
```

---

## 9. Shared behaviour

### 9.1 `useViewUrlState` (♻️ from both pages)

```ts
export interface ViewUrlState<Query, Grouping extends string> {
  query: Query;
  setQuery: (query: Query, openedWatchlistId?: string | null) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
  grouping: Grouping | null;
  setGrouping: (grouping: Grouping | null) => void;
  watchlistId: string | null;
  // Nothing named but the grouping: the remembered tab may open (§3.3).
  isBare: boolean;
  // Bumped when a tab replaces the filter, so the bar drops its typed search.
  filterReplacements: number;
}

export function useViewUrlState<Query, Grouping extends string>(
  definition: ViewDefinition<Query, Grouping>,
  // "id" for most; "list", "c", "run", "hook" elsewhere.
  selectedParam?: string,
): ViewUrlState<Query, Grouping>;
```

Changes use `replace`. Opening a record from another page uses `push`, so
Back returns to where you came from.

### 9.2 `ViewDefinition`

```ts
export interface ViewDefinition<Query, Grouping extends string = never> {
  view: WatchlistView;                  // "documents" | "proposals" | "validations" | …
  querySchema: z.ZodType<Query>;
  toSearchParams: (query: Query) => URLSearchParams;
  parseSearchParams: (params: URLSearchParams) => Query;
  isSameQuery: (first: Query, second: Query) => boolean;   // the watchlist comparer
  fields: readonly FilterFieldDefinition<Query>[];
  groupings: readonly { value: Grouping; label: string }[];
  groupingParam: string;
}
```

Every list view declares one: Documents, Proposals, Validations, Lists, Tasks,
Plugins and Hooks. The filter bar, watchlist tabs, `useViewUrlState` and the
mock read it.

### 9.3 `usePagedList`

```ts
export function usePagedList<Page extends { items: unknown[]; nextCursor: string | null }>(
  queryKey: QueryKey,
  fetchPage: (cursor: string | null) => Promise<Page>,
): {
  items: Page["items"] | undefined;
  summary: Page | undefined;            // the first slice: totals, groups, facets
  paging: PagedList;
  isLoading: boolean;
};
```

### 9.4 Selection

```ts
// One record: the URL's (§9.1).
// Several: in memory, cleared when the query changes.
export interface Picked {
  ids: ReadonlySet<string>;
  toggle: (id: string, extendRange?: boolean) => void;
  setMany: (ids: readonly string[], isPicked: boolean) => void;   // a group's "select all"
  clear: () => void;
}
export function usePicked(orderedIds: readonly string[], resetKey: unknown): Picked;
```

On the phone a long-press starts picking (view-rules §5.5).

### 9.5 `useDraft`

```ts
export interface Draft<Value> {
  original: Value;
  current: Value;
  set: (next: Value) => void;
  isDirty: boolean;
  reset: () => void;
}
export function useDraft<Value>(original: Value, isEqual?: (a: Value, b: Value) => boolean): Draft<Value>;

// Blocks a route change while dirty, asking "Discard changes?" (React Router's useBlocker).
export function useLeaveGuard(isDirty: boolean): void;
```

### 9.6 `useCan`

```ts
// Whether the session may do this to this record, scope included: any, custody (proposal or
// category), own, managed. The server decides again; the client only hides.
export function useCan(): (permission: Permission, record?: ScopedRecord) => boolean;

export type ScopedRecord =
  | { kind: "proposal"; custodyIds: readonly string[]; askerIds: readonly string[] }
  | { kind: "iteration"; categoryId: string }
  | { kind: "project"; managerId: string; memberIds: readonly string[] }
  | { kind: "run"; startedById: string };
```

### 9.7 `useActionMutation`

```ts
// One mutation per action. A refusal comes back as a value for the dialog to show; the lists,
// details and watchlist counts it touches are invalidated without being awaited.
export function useActionMutation<Input, Value>(options: {
  call: (input: Input) => Promise<Value>;
  invalidates: (input: Input, value: Value) => readonly QueryKey[];
}): {
  run: (input: Input) => Promise<{ value: Value } | { refusal: DialogRefusal }>;
  isPending: boolean;
};
```

### 9.8 Labels and formatting

```ts
export function useLabelOf(reference: ReferenceKind): (id: string) => string;
export function plural(count: number, noun: string, pluralNoun?: string): string;
export function formatDay(date: string): string;          // ✅
export function formatRelative(date: string): string;     // "3 days ago", "in 2 h"
export function formatPages(count: number): string;       // "1 240 pp"
```

### 9.9 Keyboard

- ↑ and ↓ move the selection in a RecordList or Tree, and Enter opens it.
- Esc closes the pane sheet, the drawer or the dialog, and focus returns to
  the row.
- In a picking list, Space toggles and Shift+Space extends the range.

---

## 10. Open questions

1. ~~**Root size at large.**~~ **Decided 2026-10-06:** 15px, as designed. To
   build: `data-tier` on `<html>` (§0.1).
2. ~~**Split at 768–1023px.**~~ **Decided 2026-10-06:** docked across all of
   small; the sheet only on the phone (§1.2).
3. ~~**Table threshold.**~~ **Decided 2026-10-06:** left at 42rem; an
   expanded sidebar at notebook shows cards (§0.2).
4. ~~**Phone dialogs.**~~ **Decided 2026-10-06:** a full-screen sheet (§6.1).
5. ~~**Phone navigation.**~~ **Decided 2026-10-06, replacing navigation.md
   §3's bottom tabs:** ☰ beside the title opens the sidebar sheet, as at
   small. The page's actions are at the top right. Nothing is fixed at the
   bottom. Gestures, decided 2026-10-06 (§8.1):
   - swipe ← → moves between sidebar entries with nothing open, and between
     records on an open record;
   - Back (system, ‹, or a swipe down on the sheet's head) closes what is open.
6. **User settings on the server.** Preferences assumes a settings record per
   person (§1.8). Until it exists, Display writes localStorage as today.
7. **Watchlist audience.** Everyone, or groups and roles (§1.7).
   **Decided 2026-10-06:**
   - `seen` is kept per person, so shared watchlists badge too, and *Hide*
     uses the same per-person row.
   - Sharing that reaches someone who already keeps the same filter is
     allowed with a **warning**, not refused.
   - Only holders of `watchlist.manage_shared` share, with anyone. A group's
     members get no special right to share with their group.

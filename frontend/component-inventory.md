# Component inventory

What the whole client is built from: the twelve pages of the notebook demos
(`docs/demos/STATUS.md`, `docs/demos/shared/page-*.js`) taken apart into shapes,
parts, dialogs and the behaviour they share. Each item says whether it exists,
needs generalizing out of Documents or Proposals, or is new.

**Status:** ✅ have · ♻️ have, but bound to one view, so generalize · 🆕 new.

---

## 1. Page shapes

A page is one of a few shapes. The shape owns the layout, the scrolling and
the narrow-tier fallback. A view only fills it.

| Shape | Pages | Status | Notes |
|---|---|:-:|---|
| **Master–detail** | Documents, Proposals, Validations, Lists (browse), Hooks | ✅ `layout/master-detail.tsx` | 50/50 at ≥768 (all of small; decided 2026-10-06), sheet on the phone. The master must also take a tree (Categories) and grouped rows (Hooks) |
| **Tree + detail** | Categories | 🆕 on MasterDetail | the master is a tree with a *Show* picker per row number, and a virtual root, *All categories* |
| **Two-pane transfer editor** | Lists (new / edit, `?new`, `?edit=`) | 🆕 | a header strip (name, dates, target, mix, report), then *On this list* ⇄ *Ready to list*, each with checkboxes, a filter and bulk move. A draft until Save, with *+N −M since opened* |
| **Card index** | Projects (active and upcoming), Intentions (two columns: Targets / Tracking), Home | 🆕 | a card grid in collapsible sections (running → Upcoming → Ended ▸ → Archived ▸), a compact table under it for the ended ones, and a tile that counts |
| **Detail page** | Projects (`?p=`) | 🆕 | a full-width record with the same cards as a pane |
| **Grouped table + drawer** | Plugins (type → implementation → instance), Tasks (runs), Schedules | 🆕 | collapsible group rows, then a drawer (side sheet at every tier) for the row |
| **Linked columns** | Users & Groups | 🆕 bespoke | Roles · Users · Groups and custodies, with lines in the gutters and the record under them. Tabs on the phone |
| **Timeline** | Schedules | 🆕 bespoke | 24 h / 7 days / Month: a dot per run, a band when dense, hatching when paused |
| **Wizard in the pane** | Categories refine (`?refine=1`) | 🆕 | numbered steps inside the detail pane, routed so it survives a reload |
| **Settings page** | Preferences (`/preferences`, from the user menu; not a sidebar entry) | 🆕 | a section list on the left and forms on the right: Watchlists (absorbs the planned `/watchlists` page), Display, Account. See *Not in the demos* below |

### Not in the demos

**Preferences — `/preferences`.** It is reached from the user menu's
*Preferences*, and `/watchlists` redirects to its Watchlists section.

| Section | What it holds | Notes |
|---|---|---|
| **Watchlists** | every watchlist the person owns, grouped by view in sidebar order: Open, Rename, Edit filter, Delete, Badge on/off, drag to reorder; *Shared with me*, read-only, with *Hide*; *No longer reachable*, greyed, with Delete | filtering.md §4.3, moved here |
| **Display** | the sidebar expanded or collapsed per tier; the tab each view opens on (*the last one used* or a fixed one); list density; date format; later, the language | today the sidebar and the remembered tab are in localStorage. A user-settings record on the server makes them follow the person across devices |
| **Account** | name and identities (read-only, *Signs in with*); Change password for a local account only; Sign out of other sessions | identity.md |
| **Notifications** | later: which badges show on sidebar entries | only if the badge gets settings beyond on/off |

**Shared watchlists in Users & Groups.** This is a proposal, and it changes
filtering.md §4.5 and §5. A shared watchlist gets an **audience** in place of
the single *shared* scope:
- **Everyone** who opens the view, as today.
- **Groups:** the members of the chosen groups.
- **Roles:** the holders of the chosen roles, directly or mapped.
- Groups and roles can be combined, and the audience is their union. It can
  never reach past who may open the view.

Where it appears:
- **Users & Groups:** a fourth record kind, *Shared watchlists*, listed beside
  groups and custodies. The record shows the view, the filter, the audience and
  who it reaches. The group, role and user records each gain a *Watchlists*
  card (*Shared with this group*, *… with this role*, *What this person sees*).
- **The tabs:** *Share with everyone* becomes *Share…*, a picker with
  Everyone / Groups / Roles.

Decided 2026-10-06:
- **`seen` is per person.** Shared watchlists count in the badge, and *Hide*
  uses the same per-person row.
- **Duplicates warn.** Sharing that reaches someone who keeps the same filter
  says so and goes ahead.
- **Only `watchlist.manage_shared` shares,** with everyone, groups or roles.

**Common to every shape:** the page header (✅ `PageHeader`) with actions
gated by permission. The body scrolls itself and the shell never does. On the
phone, one column at a time.

---

## 2. Lists

`DocumentList` and `ProposalList` are the same machine with different
columns. Generalize before the third copy (Validations).

| Part | Status | What it does |
|---|:-:|---|
| **RecordList** | ♻️ from `document-list.tsx`, `proposal-list.tsx` | container-query layout: stacked cards when narrow, table rows on one subgrid when wide. Column declarations (header, cell, the width at which it appears), the selected row, a *why line* under each row, the loading skeleton, an empty state, the load-more sentinel (✅ `use-load-more.ts`) |
| **GroupHeader** shell | ♻️ from both `*-group-header.tsx` | a sticky header with a title, a meta line, counts and a group action (*Approve N…*, *Retry failed*). The views keep the content; the frame, stickiness and toggle are shared |
| **Grouping picker + count line** | ♻️ | "*N documents · M asks* · Group by ▾", above the list |
| **Selectable rows** | 🆕 | checkboxes with select all in a group, shift-click for a range and a count of what is picked. Needed by the list editor, the bulk approve dialog (♻️ it already has a private version) and the Members pickers |
| **DataTable (grouped)** | 🆕 | aligned columns with collapsible group rows and row → drawer, for Plugins, Tasks, Schedules, the Projects *Ended* and *Rejected* tables and Hooks deliveries. The vendored `ui/table.tsx` is the base |
| **Tree** | 🆕 | Categories: expand and collapse, a number per row from the Show picker, ⚠ on an incomplete sibling set, dimming outside a scope, selection in the URL |
| **Card grid** | 🆕 | Projects, Intentions, Home: a card with a title, badges, bars and an action line, and an expand for detail (Intentions) |

---

## 3. Filters and watchlists

| Part | Status | Notes |
|---|:-:|---|
| QuickFilter, FilterChip, AddFilterMenu | ✅ `filters/filter-controls.tsx` | |
| **FilterBar** shell | ♻️ from both `*-filter-bar.tsx` | search, quick fields, chips and *+ Add filter*. Each view supplies only a field declaration (key, label, kind, vocabulary or reference, labels). `enumField` and `referenceField` move out of the views |
| WatchlistTabs, remembered tab | ✅ | already generic over `view` |
| **Date-range field** | 🆕 | *Asked* (Proposals), *Started* (Tasks), list dates. filtering.md §3 |
| **Advanced editor** | 🆕 | filtering.md §3.3, the TODO in both bars |
| **Phone filter sheet** | 🆕 | the bar collapses to *Filter (n)* and a sheet |
| **Show / scope switch** | 🆕 | the tab-like switch for Intentions *Targets / Tracking* on narrow tiers and Users & Groups columns on the phone |

---

## 4. Detail-pane parts

| Part | Status | Used by |
|---|:-:|---|
| DetailCard, FactGrid, DetailRow, StatTiles, FinePrint, Muted | ✅ `detail-card.tsx` | every pane |
| StatusNote (toned strip) | ✅ | every pane |
| RecordHeading, AskersCard, CopiesCard, CatalogCard | ✅ `record-cards.tsx` | Documents, Proposals, Validations |
| **HistoryCard** for any subject | ♻️ | today document only. Projects, lists, categories, access (status-log `access` subject), and Hooks deliveries all have a history |
| **PaneState**: none selected / gone / outcome | ♻️ from `proposals-page.tsx` | "Select a …", "no longer here", and the green *Decided* outcome with its link onwards. Validations needs the same thing after Accept |
| **ActionBar + More ▾** | 🆕 | the primary actions plus a menu of the rest, each gated by permission and record (Documents: Relink, Reclassify, Set where it is available; Validations: Reclassify, Cancel; Lists: Cancel, Could not be digitized) |
| **MembersCard** | 🆕 | people and groups with a role tag (manager, member, *via group*). Projects, groups, custodies |
| **Defect card** with fix in place | 🆕 | Validations: per defect its texts and *Enter page count…* / *Correct 260$c…* / *Relink…* |
| **Provenance tags** | 🆕 | *direct*, *via Periodicals Curators*, *mapped by MZK Keycloak*. Users & Groups, Categories custody |

---

## 5. Visualizations

| Part | Status | Used by |
|---|:-:|---|
| **PaceBars**: time / planned / delivered against a target, with the even-pace mark and *On pace* / *Behind pace* | 🆕 | Projects cards and detail, Intentions target cards, Lists (planned vs delivered) |
| **MixBars**: intended vs output stacked, drift per category with the ±5 band | 🆕 | Intentions tracking cards, Categories *Intended vs actual*, Lists editor (the fill against a mix) |
| **Sparkline** (7 days) | 🆕 | Hooks rows |
| **Run progress** | 🆕 | Tasks running cards, the sidebar *Running tasks* panel (`ui/progress.tsx` is the base) |
| **Timeline** | 🆕 | Schedules |

All of these take numbers the server computed. None of them counts.

---

## 6. Dialogs

There are about fifty dialogs in the demos, but they are only six kinds. Build
the kinds, then each dialog is a configuration of one.

| Kind | Instances | Status |
|---|---|:-:|
| **A. Consequence confirm**: "Delete X?" plus what happens, counted by the server; danger tone; no reason | Delete list / project / category / role / custody / hook / schedule / instance / intention; Disable instance; Mark list Done; Discard delivery; Detach intention | 🆕 |
| **B. Reason dialog**: the text every asker reads (required) plus an internal note | Decline proposal (♻️ inline in `DecideCard`), Reject project, Forbid, Cancel item, Could not be digitized, Pause schedule or hook, Cancel run, Deny in validation (with the defect pick) | 🆕 (extract) |
| **C. Form editor**: fields, validation, may refuse to close while dirty | New / Edit project, intention, repeat, schedule, hook, plugin instance, group, custody, category; New local account; Keep runs for; Reclassify; Approve project (priority + what it approves) | 🆕 |
| **D. Set editor**: one sibling set or grid saved whole, a preview of what it reaches before Save | Proportions (sum ≤ 100, remainder shown), Change the mix (ticks trackers), Role editor (permission × scope grid, refuses to leave no `access.manage`), Custody grants | 🆕 |
| **E. Picker**: search and tick people, groups or items | Members (project, group, custody), Groups of a user, Roles of a user, Link an identity | 🆕 |
| **F. Stepped**: numbered steps, Back on the left and Next on the right, ending on a result screen | Propose (✅), Bulk approve (✅, has a result screen), Generate a draft, Correcting list, Upload plugin version (validates before activating), Test hook (preview, then send) | ♻️ the step frame and result screen from Propose |
| **Message…** | Proposals, Projects, Validations, Lists | 🆕 one shared dialog: resolve recipients, pick a Message plugin, hand off (messaging.md) |

**What every dialog shares (`DialogShell`):**
- **Style:** the original demos' style (`rounded-xl`, `p-6`, `rounded-lg`
  controls), with the title and the record it acts on.
- **Submitting:** a pending state. A server refusal (the `Outcome` 403 / 409
  / 422) appears inline, never as a toast, and the form keeps what was typed.
- **Closing:** only deliberately, once something is typed (page-composition
  §1). The buttons get *Discard changes?* rather than Cancel.
- **The trigger:** absent without the permission, never disabled
  (navigation.md). The dialog does not check again.
- **On success:** invalidate the list, the detail and the watchlist counts
  without awaiting them (the lesson from `useDecisionMutations`), then close
  or show the result screen.
- **Reason fields** (*What they are told* / *Internal note*) as one component
  with its own "required" and "who reads it" hints.
- **Consequence previews** come from a server dry-run endpoint, never computed
  in the client.

---

## 7. Fields

| Field | Status | Used by |
|---|:-:|---|
| Field (label + hint), CategorySelect (leaves), PrioritySelect | ✅ `classification-fields.tsx` | Approve, Bulk, Propose, Reclassify |
| **UserPicker / GroupPicker** (search, several) | 🆕 | Members, custody grants, *Asked by* |
| **ProjectSelect, IntentionSelect** (owners only, no chains), **ListSelect** | 🆕 | Propose details, Generate, Intentions mix |
| **DateField, DateRange**, *Starts now / Starts on* | 🆕 | Lists, Projects, Intentions, filters |
| **PagesField** (a number with a unit, a target) | 🆕 | Lists, Intentions, Generate |
| **PercentageField** in a set | 🆕 | Proportions |
| **ScopeSelect** (any / custody / own / managed, only what the permission accepts) | 🆕 | Role editor |
| **RepeatField** + next three runs preview | 🆕 | Schedules, Intentions repeats |
| **CodeField** (jq, JSON config) | 🆕 | Custody rule, plugin configuration |
| **TemplateField** with placeholders | 🆕 | Hook message |

---

## 8. Shell

| Part | Status |
|---|:-:|
| AppShell, Sidebar, rail peek, sidebar preference, PageHeader | ✅ |
| **Watchlists** popover in the sidebar foot, grouped by view, with counts | 🆕 |
| **Running tasks** panel (absent when nothing runs) | 🆕 |
| **User menu** (Preferences, Change password, Sign out) | 🆕 |
| **Preferences page** (§1 *Not in the demos*) | 🆕 |
| **Home**: no entry → a line; one → redirect; more → cards | 🆕 |
| **Toasts**, only for things that happen away from where you are (a run finished) | 🆕 |

---

## 9. Shared behaviour to abstract

These are the hooks and contracts behind the components. Most of the
duplication today is here, not in the markup.

1. **URL as the view's state: `useViewUrlState`.** ♻️ `documents-page.tsx`
   and `proposals-page.tsx` each carry the same `replaceParams`, `setFilter`
   (keep `id`, `group`, `watchlist`), `setGrouping`, `select`, `isBareView`,
   `filterOf` / `queryOf`. One hook takes the view's query codec and returns
   them.
2. **A view's declaration, `defineView`.** One object per view: query schema,
   `toSearchParams` / `parse` / `isSame` (watchlist comparer), filter fields
   with labels, groupings, list columns. The filter bar, watchlist tabs, list
   and the server mock all read it. Today the same facts are spread over
   `api/*`, `*-filter-bar.tsx` and `api/watchlists.ts`.
3. **Paged list query.** ♻️ infinite query + `useLoadMore` + "the first slice
   carries the totals, groups and facets", identical in both views.
4. **Selection.** One selected record in the URL (`?id=`, plus `?list=`,
   `?run=`, `?c=`, `?u=` on other pages) that opens the pane or drawer.
   Several picked in memory (a `Set`, cleared when the filter changes) for
   bulk, transfer and pickers.
5. **Draft editing.** The original, the draft, a diff (*+N −M*), dirty
   tracking, a guard on route change (`useBlocker`) and on dialog close,
   Save / Discard. The list editor, the set editors and every form editor.
6. **Permissions.** `hasPermission(session, permission)` exists. It also
   needs the scope against a record (`can(session, "request.decide", row)` →
   custody / any / own / managed), because actions in a pane depend on the
   record, not only the role. The server stays authoritative; the client only
   hides.
7. **Mutations.** The mock's `Outcome {value} | {refusal}` mapped to a typed
   error the dialog shows. An invalidation set per subject (list, detail,
   watchlist counts, reference data). Not awaited.
8. **Reference names.** ✅ reference queries. Add `useLabelOf(kind)` so that
   lists, chips and cards stop each writing `users.find(…)?.name ?? id`.
9. **Labels.** `as const satisfies Record<…, string>` tables per vocabulary,
   in one place per domain, ready for i18n. Today some live in filter bars
   and some in badges.
10. **Formatting.** Dates (absolute, relative, *in 3 days*), page counts,
    `plural`, and ID shortening (`M.docIdShort`).
11. **Responsive rules.** Container queries for anything inside a list or
    pane, and `useMediaQuery` only for docked vs sheet. Columns declare the
    width at which they appear.
12. **Keyboard.** ↑/↓ move the selection in a list, Esc closes the pane or
    drawer, and focus returns to the row. Optionally, after a decision, move
    on to the next undecided row.

---

## 10. Plan

The order of the work, one step per view split into commits, is in
`plan.md`.

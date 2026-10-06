# View Rules

Rules every view must satisfy before it is designed or built. A view that cannot
fill in the declaration in §6 is not ready to be drawn.

**Vocabulary**

- **View** — one actor's job over one scope. Which views exist, and which page
  each one lives on, is [[view-map]].
- **Role view** — two views sharing a page behind a switcher. Documents was
  built with three (My Requests, Validator, Digitization); [[view-map]] splits
  them onto separate routes, so the term is now the exception rather than the
  norm. The rules below apply per view either way.
- **Size variant** — the layout of one view at one size tier.

**Size tiers.** Decided once, identical across all views. They map 1:1 onto the
viewports already declared in `manifest.yaml`:

| Tier | Range | manifest viewport | Demo |
|------|-------|-------------------|------|
| `large` | ≥ 1600px | Desktop 1920 | `docs/demos/large/` |
| `notebook` | 1280–1599px | Laptop 1440 | `docs/demos/notebook/` |
| `small` | 768–1279px | Tablet 1024 | `docs/demos/small/` |
| `phone` | < 768px | Mobile 393 | `docs/demos/phone/` |

---

## 1. Visual points

Every element that can independently pull the eye costs points. Two budgets,
because they fail in different ways: chrome crowds the *screen*, record weight
crowds the *scan*.

### 1.1 Record budget — points one row or card may spend

| | large | notebook | small | phone |
|---|---|---|---|---|
| **budget** | 12 | 8 | 6 | 5 |

| Element | Points |
|---------|--------|
| plain text field (title, category, date) | 1 |
| monospace / numeric field (id, signature, pages) | 1 |
| colored badge (status, priority) | 1.5 |
| chip group | 1.5 first chip, +0.5 each further, cap 3 |
| inline control (checkbox, expand, row menu) | 1 |
| thumbnail / avatar | 2 |
| status footnote | 1 — **exempt**, may push a record 1 over |

The footnote exemption is deliberate: a row you must not act on blindly is
worth the point.

### 1.2 Chrome budget — everything that is not the record list

| | large | notebook | small | phone |
|---|---|---|---|---|
| **budget** | 28 | 18 | 10 | 6 |

| Element | Points |
|---------|--------|
| navigation: expanded sidebar / icon rail / ☰ only | 4 / 2 / 1 |
| filtering: docked rail / horizontal bar / button + chips | 5 / 3 / 1 |
| search field (visible) / behind an icon | 1 / 0.5 |
| overview: full chart (legend + axis) / compact bar / collapsed | 3 each / 1 each / 0.5 total |
| detail: docked panel / split pane / transient | 6 / 5 / 0 |
| role switcher | 2 |
| list chrome (pagination, count, columns button) | 1 — **0.5** when it is a count only |
| primary CTA / secondary action | 2 / 1 |
| selection toolbar | 2 — **conditional**, counted only while a selection exists |

Two accounting notes, both learned by actually measuring the demos rather than
tallying them by hand:

- **Secondary actions attached to a component already counted are part of it.**
  The filter rail's *Save as Watchlist* and *Clear all*, the overview's
  *Configure* and *Download*, pagination's prev/next — none are separate line
  items. Only free-standing actions, typically a CTA in the top bar, are counted
  on their own. Otherwise every component gets taxed twice.
- **A chip group is priced as a group, including its overflow counter.** The
  `+2` after a collapsed chip list belongs to the group, not to a text field.

### 1.3 Rules

1. **Transient surfaces cost 0 while closed and are exclusive while open.** A
   drawer, sheet, modal or full-screen detail *replaces* the chrome beneath it,
   never adds to it. This is the only reason the phone tier can afford a detail
   view at all.
2. Conditional elements may exceed budget, but only while their condition holds:
   the **selection toolbar** (while a selection exists), the **status footnote**
   (while a record has a reason), and the **role switcher** (only an actor
   holding more than one role view ever sees it — §4.2). A view is judged on its
   base cost; conditional points are reported separately as `base+conditional`.
3. **Over budget is not fixed by shrinking type.** Move something to a transient
   surface, or drop it. Shrinking is how a view becomes unreadable while still
   technically fitting.
4. Weights are fixed. Budgets are tunable — but raise them *here*, for every
   view at once. A single view needing more is usually a view doing two jobs.
5. **A persistent toggle is counted at its expensive setting, not its default.**
   The notebook sidebar defaults to the icon rail at 2 but expands to 4, and the
   preference is remembered ([[navigation]] §4.3) — so a user may sit at 4
   forever. Measure notebook chrome with the sidebar **expanded** and treat the
   collapsed rail as headroom. This is the opposite of rule 2: a transient
   surface is dismissed by the next click, a remembered one is not.

### 1.4 Conformance of the current Documents demos

> **⚠ This table measures demos that no longer exist.** It was taken from the
> three-role-switcher `documents.html`, which [[view-map]] has since split into
> *My Requests*, *Documents*, *Documents Validations* and part of *Digitization
> Lists Generation*. The rebuilt demos in `docs/demos/{large,notebook,small,phone}/`
> **declare** their costs from this document rather than having them counted —
> so the figures below are the last real measurement and the ones above each
> rebuilt page are predictions. Re-measure from the rendered DOM and replace
> this section; notebook Validations, predicted at 17 of 18, is the one to do
> first.

**Measured from the rendered DOM**, not tallied by hand — every record in every
role view is counted and the worst one is reported. Chrome is shown as
`base+conditional`; only the base is judged (§1.3 rule 2).

| Variant | Record | Chrome | |
|---------|--------|--------|---|
| large / My Requests | 9 / 12 | 23+2 / 28 | ✅ reader view |
| large / Validator | 12 / 12 | 26+2 / 28 | ✅ record full |
| large / Digitization | 11 / 12 | 25+2 / 28 | ✅ |
| notebook / My Requests | 6 / 8 | 11+2 / 18 | ✅ reader view |
| notebook / Validator | 5 / 8 | **17+2** / 18 | ⚠️ one point of headroom |
| notebook / Digitization | 8 / 8 | 14+2 / 18 | ✅ record full |
| small / My Requests | 6 / 6 | 4+2 / 10 | ✅ record full |
| small / Validator | 6 / 6 | 4+2 / 10 | ✅ record full |
| small / Digitization | 6 / 6 | 4+2 / 10 | ✅ record full |
| phone / My Requests | 5 / 5 | 5.5+1 / 6 | ✅ record full |
| phone / Validator | 5 / 5 | 5.5+1 / 6 | ✅ record full |
| phone / Digitization | 4.5 / 5 | 5.5+1 / 6 | ✅ |

What the budgets forced out, and why each was the right thing to lose:

- **notebook Digitization** — `size` dropped. Eight columns cost 9 points; size
  is the column a batch decision least depends on.
- **small list rows** — priority badge dropped. Status and priority together cost
  7.5; priority is one tap away in the detail.
- **small Digitization** — signature and the project subline dropped (8 → 6).
  What survives is what the decision turns on: capacity (pages), order
  (priority), eligibility (dig state). Signature is for pulling from the shelf
  afterwards and lives in the detail.
- **phone cards** — the `no issues` chip dropped. A chip announcing the *absence*
  of a problem is pure noise. Card composition is now per role view: Digitization
  trades the expand chevron for the page count, because pages is the number its
  decision turns on; the other two keep expand and move their meta line into it.
- **phone chrome** — the hamburger and the segmented role switcher both went.
  The bottom tab bar's *More* already opened the same drawer, so the hamburger
  was a second section-nav mechanism on the smallest screen; the role switcher
  moved onto the title as a dropdown. *Reversed 2026-10-06: the bottom tabs
  went instead, and ☰ before the title is the phone's navigation
  ([[navigation]] §3).*
- **large Digitization shows two charts, not three.** That view carries the
  *Generate List* CTA, and at 26 base the chrome has no room for it. *By status*
  is the chart a batch decision leans on least, so it goes. This one only
  surfaced when the demos were measured — the hand tally had missed the CTA
  entirely and reported 28 where the real figure was 30.

Two cells are worth watching. **large / Validator is at 12/12**: adding the unit
ID line under the catalog ID took it to the ceiling, so the next column added
there has to displace one. **Four variants sit at a full record budget**, which
is the expected steady state — the budget is meant to be spent, not hoarded.

> **The notebook figures are restated under rule 5**, +2 on each, because they
> were measured with the sidebar collapsed and the toggle is remembered. This is
> arithmetic on the existing measurement, not a re-measurement — the demos
> themselves have not changed. It costs **notebook / Validator** its slack: at
> 17 of 18 it has room for one more point of chrome and no more, and it is the
> variant to re-measure first when the views are rebuilt.

### 1.5 Layout per tier

Decided 2026-10-06. What the display decides, and what the room decides.

- **The tier decides** the navigation ([[navigation]] §3), whether the detail
  docks, the dialog's form, the action cap (§5 rule 2) and the filter depth (§2).
- **The room decides** a list's columns and a pane's fact and tile columns:
  the width of the list or pane itself, which also changes when the sidebar or
  the detail opens. A list is a table at **42rem** and up, and stacked cards
  below.

| | large | notebook | small | phone |
|---|---|---|---|---|
| master–detail | docked, half and half | docked | **docked**, as in the demos | the detail is a full-screen sheet over the list |
| list in master–detail | table | table with the rail; **cards with the sidebar expanded** | cards | cards |
| dialogs | centred, 36rem (wide 56rem) | same | same | **full-screen sheet**, head and foot fixed |
| header actions | top right | top right | top right, ☰ before the title | top right, ☰ before the title; one primary and `…` |
| fixed at the bottom | — | — | — | **nothing**: no tabs, no action bar |
| root size | **15px** | 16px | 16px | 16px |

- **Docked from 768px.** The detail docks across all of `small`, not only
  from 1024px.
- **Cards at notebook with the sidebar expanded.** The list's half falls
  under 42rem, so it shows stacked cards. The threshold was left where it is,
  not lowered to keep the table.
- **The phone's dialog is a sheet** because the long forms (Propose, the hook
  editor) and the on-screen keyboard do not fit a centred box at 393px.
- **Gestures on the phone** are [[navigation]] §3.1: swipe between entries on
  a page and between records on an open record, and Back closes.

---

## 2. Overview filtering vs advanced filtering

Three distinct mechanisms, deliberately not merged:

- **Overview filtering** — clicking a segment or legend entry in the overview
  strip. Adds exactly one `property = value` predicate. One property, OR within
  it, always a visible removable chip.
- **Facet filtering** — checkbox lists per property. AND across properties, OR
  within a property. Equality only.
- **Advanced filtering** — everything beyond equality: ranges (`pages > 1000`),
  negation, absence (`no registry state`), cross-entity predicates (documents
  whose project carries intention X), grouping.

| Tier | Overview | Facets | Advanced |
|------|----------|--------|----------|
| large | ✅ docked charts | ✅ docked rail | ✅ expression builder in rail |
| notebook | ✅ compact strip | ✅ dropdown per property | ✅ in a modal |
| small | ✅ expand to click | ✅ drawer | 👁 display + remove only |
| phone | ✅ collapsed, one chart | ✅ bottom sheet | 👁 display + remove only |

**Rules**

1. **Filter sets are portable across tiers.** Anything constructible at a bigger
   tier must be visible and removable at a smaller one even when it cannot be
   *built* there. `Pages > 1000` renders as a read-only chip on phone. Never
   silently drop a predicate — a filtered list that lies about its filters is
   worse than no filtering.
2. Overview charts are computed over the **already-filtered** set, and clicking
   a segment narrows further. Clicking never resets.
3. Advanced filtering is the only path to a saved watchlist. Watchlists are
   therefore authored on desktop and consumed everywhere — which is the correct
   division of labour, not a limitation.
4. Wherever the filter UI is collapsed, the control shows the active predicate
   count as a badge.
5. **Actor gate**: a property the actor may not read is not filterable by them.
   Otherwise filters become an oracle for probing forbidden records.

---

## 3. Search

One box per view. What it searches is derived from the **shape of the input**,
and the chosen interpretation is always shown and always overridable.

Pattern table — shared across views, extends [[identifier-types]] and
[[document-identity]]:

| # | Rule | Pattern | Searches | Match |
|---|------|---------|----------|-------|
| 1 | scope | `^(title\|author\|sig\|cat\|project\|unit\|catalog):\s*(.+)` | that property only | as given |
| 2 | catalog-id | `^MZK\d{2}-\d{9}$` | catalog ID | exact |
| 3 | cnb | `^cnb\d{9}$` | identifiers → catalog ID | exact |
| 4 | issn | `^\d{4}-\d{3}[\dX]$` | identifiers → catalog ID | exact |
| 5 | isbn | `^97[89][-\d]{10,14}$` | identifiers → catalog ID | exact |
| 6 | barcode | `^MZK-\d{4}-\d{6}$` | unit ID (barcode form) | exact |
| 7 | volume-number | `^(roč\.\|sv\.\|vol\.)\s*\d+` | unit ID (volume-number form) | exact |
| 8 | signature | `^[A-Z]{2}\d-\d{4}$` | signature | exact |
| 9 | entity-ref | `^#\d+$` | proposal / addition / list id | exact, navigates |
| 10 | year | `^\d{4}(-\d{4})?$` | catalog year **and** unit ID | range overlap, then text |
| 11 | quantity | `^[<>]=?\s*\d+$` | page count | comparison |
| 12 | text | *(fallback)* | title + catalog title + author + unit ID | prefix / fuzzy |

> `TODO(Tenancy):` **rules 2, 6 and 8 are MZK's, not VERA's.** The `MZK…`
> prefixes and the signature shape are one library's conventions sitting in a
> shared table. They work until a second library is added, at which point
> patterns become per-library configuration — the same move plugin and registry
> adapters need ([[relationships]] §7). Rules 1, 3–5 and 9–12 are institution-
> neutral and stay.

**The third unit-ID form has no pattern.** A volume *name* (`1918-1925`,
`Jarní číslo`) is free text, so rules 6 and 7 catch only barcodes and volume
numbers. This is why rule 10 searches the unit ID as well as the catalog year,
and why rule 12 includes the unit ID in the text index — it is the only way a
volume name is ever found. Do not try to pattern-match it.

**Rules**

1. **Never search every property silently.** An unexplainable result set is
   worse than an empty one.
2. The resolved rule renders as a chip — `ID match · MZK01-001284756` — with a
   one-click switch to "search as text instead".
3. Ambiguity resolves to the first matching rule and offers the alternative in
   that chip. (`1926` → year, offering pages.)
4. **Exact rules (2–8) short-circuit**: a single hit navigates straight to the
   record. This is the barcode-in-hand case and it is the most frequent staff
   interaction in the building.
5. Search is scoped to the view's own entity. Rule 8 is the only crossing.
6. Search appears in **every** tier. At 1 point it is the cheapest control there
   is, and the only filtering that scales down to phone without loss.
7. A view declares which rules it enables; it does not define its own patterns.

---

## 4. Actors

| Actor | Who | Sees |
|-------|-----|------|
| `reader` | anyone who can sign in, including non-library users | own proposals and requests, public status text only |
| `staff` | library staff, desk and acquisitions | all documents, descriptive fields, no approval rights |
| `curator` | subject curator | validation queue, approve / deny with reason, category and priority |
| `dig-curator` | curator managing digitization | lists, batches, projects, capacity, scheduling |
| `admin` | system administrator | plugins, hooks, tasks, raw payloads, re-runs |

**These five are bundles, not a ladder.** Grants compose, and holding one does
not imply the ones above or below it — somebody may hold *My Documents* and
project membership and nothing else ([[navigation]] §2 rule 2). The names are
shorthand for talking about common cases; the sidebar and every permission
check are assembled per grant. A rule phrased *"a reader sees…"* is describing
a bundle and will be wrong for somebody.

**A guest is a role, not a kind of user.** Non-library users propose documents
too, and they are not a separate actor — they hold an account like anyone else,
with a **verified email**, and nothing but authorship over what they submitted.
How an external identity becomes a VERA user is the **IdP plugin's** job: its
default role (for example `guest`, `reader`, or none) and its mapping from user
attributes to roles ([[permissions]] §1.1, decided 2026-09-26).

Two things follow that views depend on:

- **`request.created_by` always points at a user**, so provenance is never
  blank and *My Documents* works for a guest exactly as it does for staff.
- **Every requester is reachable.** A verified email means a decision can be
  delivered rather than merely displayed, so a guest who never signs in again
  still learns their proposal was declined. What gets sent is the **public**
  text of §4.3 — a notification leaves the application, so the internal wording
  must never be the one that goes out.

**Rules**

1. A view declares **one primary actor**, optionally one secondary. A third
   means the view is doing two jobs — split it into role views, which is exactly
   what Documents already is.
2. **A role switcher is not a permission mechanism.** It offers only role views
   the actor actually holds; an actor with one role sees no switcher at all.
3. **Every status reason carries two texts, public and internal.** The view
   renders the one the actor is cleared for. A reader sees *"Not available for
   digitization (rights restriction)"*; a curator sees *"Depositor MZA prohibits
   digitization until 2030, deposit contract art. 4.2"*. This closes the
   "no way to read the forbidden message" gap without leaking contract terms.
4. A property the actor cannot read is **absent, not blanked**. A `—` placeholder
   still reveals that something exists. The exception is status itself: the
   *fact* is always visible, only the *reason* is graded.
5. Actor selects **defaults, not availability**: curator lands on
   `Status = Review Needed`, dig-curator on the current project.

---

## 5. Actions

**Rules**

1. Actions are declared per (view, actor, record state). A state with no action
   for that actor shows none — never a disabled button with no explanation.
2. **Primary action cap per screen**: phone 1, small 2, notebook 3, large 3.
   The cap applies to filled/primary-styled buttons; overflow goes to `…`.
3. Irreversible or externally visible actions (Deny, Revoke, Forbid, Cancel,
   Generate list, Export) always require a reason or a confirm step, are
   **never** primary-styled on phone, and always write a status-log entry.
   **Cancel is in this list despite being reversible** — Resume undoes the
   state but not the consequence, because the item has already left its list
   ([[status-model]] §2.5) and comes back as `Ready`, not to the position it
   held. A reversible action with an irreversible side effect is confirmed like
   an irreversible one.
4. The reason from rule 3 becomes the status footnote of §1, and must be written
   as two texts per rule 4.3 whenever a reader can see it.
5. Bulk actions exist only where selection exists, and selection exists only in
   dig-curator views. Phone allows at most 2 bulk actions, entered by long-press.
6. Every state-changing action is attributed — actor and timestamp — in the
   [[status-log]]. The log is the audit trail, not a courtesy.

### Documents — action matrix

| Action | reader | staff | curator | dig-curator | admin | Allowed states |
|--------|:--:|:--:|:--:|:--:|:--:|---|
| Watch | ✅ | ✅ | ✅ | ✅ | ✅ | any |
| Propose digitization | ✅ | ✅ | ✅ | ✅ | ✅ | not Forbidden |
| Edit descriptive fields | | ✅ | ✅ | ✅ | ✅ | not Denied / Forbidden |
| Set category / priority | | | ✅ | ✅ | ✅ | any |
| Approve (override issues) | | | ✅ | | | Review Needed |
| Revoke approval | | | ✅ | | | Approved |
| Deny digitization *(reason)* | | | ✅ | | | not Denied / Forbidden |
| Forbid *(reason)* | | | ✅ | | ✅ | any |
| **Cancel** *(reason)* | | | ✅ | ✅ | ✅ | not yet `Digitized` |
| **Resume** | | | ✅ | ✅ | ✅ | cancelled |
| Add to list / new list from selection | | | | ✅ | | `Ready` |
| Generate list | | | | ✅ | | view-level |
| Export selection | | | ✅ | ✅ | ✅ | — |
| Re-run plugin / force re-sync | | | | | ✅ | any |
| View raw payload | | | | | ✅ | any |

> **The matrix is a projection of [[permissions]], not a source.** Each column
> is one shipped role and each ✅ is that role holding the permission at some
> scope — curator ticks are `@custody`, admin ticks are `@any`. Cancel and
> Resume are separately grantable even though all three roles hold both
> ([[permissions]] §3). If the two ever disagree, the permission table is right.

---

## 6. The view declaration

Every view fills this in **before** it is designed. All fourteen are filled in
at [[view-catalog]], together with what each view deliberately excludes.

> **Worked example, pre-dating the merge.** *My Requests* is now *My Documents*
> — the reader's reach of `/documents` ([[navigation]] §1.1). The declaration
> is kept as written because it is a worked example of the format; the real
> one is redone with the per-page layouts.

```yaml
view: my-requests
route: /requests                     # own page — no longer a role view
nav: My Requests                     # navigation.md §1, rail MR
actor: { primary: reader, secondary: staff }
tiers: [large, notebook, small, phone]

points:                              # notebook chrome measured EXPANDED, §1.3 rule 5
  record: { large: 9,    notebook: 6,    small: 6,   phone: 5 }
  chrome: { large: 23+2, notebook: 11+2, small: 4+2, phone: 5.5+1 }

filtering:
  overview: [status, dig-state]      # no priority — a curation concern
  facets:   [status, dig-state]
  advanced: { tiers: [], operators: [] }          # none, at any size
  defaults: {}

search:
  rules: [scope, catalog-id, cnb, issn, isbn, barcode, volume-number, year, text]
  scope: documents

actions:
  primary:  []                       # no approve, no deny, no bulk
  secondary: [Watch]
  overflow: [Propose digitization]
  bulk:     []

columns:
  large:    [title, catalogId, unit, status, dig, category, updated]
  notebook: [title, unit, status, dig, category]
  small:    [title, unit, status, dig]
  phone:    [title, unit, status, dig]

reason_text: public                   # §4.3 — never the internal wording
detail:
  shows: [status, category, pages, updated, dig-state, catalog-record, history]
  hides: [priority, signature, project, size, metadata-issues, catalog-sync]
  provenance: in-history              # linked log entries, not a separate box
```

And the curator's, for contrast:

```yaml
view: validation
route: /review/documents             # own page — the switcher is gone
nav: Documents Validations           # navigation.md §1, rail DV
actor: { primary: curator, secondary: staff }
tiers: [large, notebook, small, phone]

points:                      # measured, must be <= §1 budgets
  record: { large: 12,   notebook: 5,    small: 6,   phone: 5 }
  chrome: { large: 26+2, notebook: 17+2, small: 4+2, phone: 5.5+1 }   # base+conditional

filtering:
  overview: [status, priority, dig-state]
  facets:   [status, priority, project, category]
  advanced: { tiers: [large, notebook], operators: [range, negate, absent] }
  defaults: { status: [Review Needed] }

search:
  rules: [scope, catalog-id, cnb, issn, isbn, barcode, volume-number,
          signature, year, text]
  scope: documents

actions:
  primary:  [Approve]
  secondary: [Deny, Revoke]
  overflow: [Edit, Cancel]   # §5 rule 3 — reason required
  bulk:     []

columns:                     # which columns survive, per tier — a decision,
  large:    [title, catalogId, unit, status, issues, category, priority, pages, size, sync]
  notebook: [title, status, issues, priority]        # not automatic truncation
  small:    [title, unit, status, issues]
  phone:    [title, status, issues]
```

---

## 7. Open questions

- ~~**Status vocabulary conflict.**~~ **Resolved** by [[status-model]]: the two
  lists were never one enum. Four axes are stored — decision, restriction,
  validation, progress — and both the badge (§4.3) and the stage names in
  [[view-map]] are projections of them. §5's overview filter takes the derived
  badge; advanced filtering takes the axes.
- **Who authors the public reason text** — the plugin that sets the status, or
  the curator at action time? Rule 4.3 needs an owner.
- Does a **volume name** need a normalised form for sorting? `1918-1925` and
  `Jarní číslo` do not sort together, and digitization lists are usually built in
  volume order. See [[document-identity]].
- ~~Do `staff` and `reader` differ enough to need separate role views of
  Documents?~~ — **answered** by [[navigation]] §1.1: neither role views nor
  two pages, but **one page at two reaches**. The row is the same — a
  document, its askers, then its iteration — and the grant decides how many of
  them you see: authorship with `request.read_own` alone (*My Documents*), the
  grant's scope with `iteration.read` (*Documents*). Graded reason text (§4.3)
  handles the rest. This superseded an earlier answer that made them two
  pages, *My Requests* and *Documents*.

## Related

- [[view-map]] — which views exist, and which actor owns each
- [[navigation]] — the shell these views sit in, and its chrome cost per tier
- [[status-model]] — §4 the badge, §2 the axes advanced filtering queries
- [[relationships]] — §5, the three ways a view reaches documents
- [[priority-levels]] · [[document-identity]] · [[identifier-types]] — the
  properties §1 budgets and §3 searches

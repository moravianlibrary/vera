# Navigation

The application shell: what is in the sidebar, in what order, and what it
becomes at each size tier. [[view-map]] decides *which views exist*; this
decides how a person gets to them.

---

## 1. The entries

Twelve, in one order — `docs/demos/rework.md` § Client views, with the
document pages re-cut around the document (§1.1). **One flat list: no groups,
no dividers, and no names for runs of entries** (§2):

| # | Entry | Rail | Route | View ([[view-map]]) |
|---|-------|:----:|-------|------|
| 1 | **Documents** — *My Documents* for a reader | `Do` | `/documents` | Documents |
| 2 | **Proposals** | `Pr` | `/review/proposals` | Proposal Review |
| 3 | **Documents Validations** | `DV` | `/review/documents` | Validation |
| 4 | **Digitization Lists** | `DL` | `/lists` | Digitization Lists — browse and compose |
| 5 | **Projects** | `Pj` | `/projects` | — entity |
| 6 | **Categories** | `Ca` | `/categories` | — entity |
| 7 | **Intentions** | `In` | `/intentions` | — entity |
| 8 | **Tasks** — *My Tasks* without `task.read` | `Ta` | `/tasks` | — entity |
| 8a | **Schedules** | `Sc` | `/schedules` | — entity (added 2026-09-26, the user's request) |
| 9 | **Users & Groups** | `UG` | `/access` | — entity |
| 10 | **Plugins** | `Pl` | `/plugins` | — entity |
| 11 | **Hooks** | `Ho` | `/hooks` | — entity |

Above them: the **logo**, which navigates Home, and the **expand / collapse
button**. Below them, after a rule: **Watchlists** (§5), then **Running tasks**
(§6), then the **user menu** (§7).

### 1.1 The document pages, re-cut around the document

rework.md listed six entries that act on a document — *Documents, Documents
Validations, Digitization Lists Generation, Proposals, Additions*, plus an
added *My Requests* — and *Digitization Lists* further down. They are now
**four**, and the reason is one sentence from
[[concepts]] §Request: *a proposal and an addition are not other things, they
are names for where a request currently is.*

**My Requests and Documents are one entry.** Both were a list of the same
thing — a document, with the people who asked for it and, once approved, its
current iteration ([[view-map]] §2.1). They differed only in *scope*, and scope
is the grant's business, not the sidebar's:

| Actor holds | Entry reads | Rows |
|---|---|---|
| `request.read_own` only | **My Documents** | what I asked for, from the moment I asked — public reasons only |
| `iteration.read` | **Documents** | everything I may read, with *Mine* as a filter |

The label follows the reach: the same page, named for what it shows you. A
reader's *My Documents* starts at the proposal, so the fault the old split was
guarding against — a user following their request up to approval and then
losing it ([[relationships]] §5.1) — cannot happen: the row never changes page,
only its badge.

**Additions is gone as an entry.** An addition is a proposal approved at the
moment it is made ([[status-model]] §2.8), so it enters through *propose*, and
what is left of the old page — ingest that failed — is a status, *Could not be
added*, filtered for in Documents ([[view-map]] §2.1).

**Digitization Lists Generation and Digitization Lists are one entry.** The
same actor switches between them — browsing lists, building one, fixing one —
which is the one condition under which a page hosts more than one view
([[view-map]] §1). Browsing is master–detail; creating and editing are **one
editor**, because a new list is an empty list ([[view-map]] §2.4).

**The first four are in pipeline order**: *Documents → Proposals → Documents
Validations → Digitization Lists* — the path an item takes, top to bottom. The
merged Digitization Lists takes Generation's place, fourth, rather than its
own old place after Intentions, because building lists is where items leave
the pipeline, and that answers the question §1.3 used to leave open.

### 1.2 Rail abbreviations are not prefixes

Three entries begin with `D` — *Documents*, *Documents Validations*,
*Digitization Lists* — so first-two-letters does not work. **Initials of the
multi-word names do**, and all twelve come out unique without renaming
anything:

| Single word | Multi-word |
|---|---|
| `Do` Documents · `Pr` Proposals · `Ca` Categories · `In` Intentions · `Ta` Tasks · `Sc` Schedules · `Pl` Plugins · `Ho` Hooks · `Pj` Projects | `DV` Documents Validations · `DL` Digitization Lists · `UG` Users & Groups |

*My Documents* keeps `Do`: it is the same entry under a narrower label, and a
rail that changed its letters with the label would make one entry look like
two.

Read as a rule: **a one-word entry takes its first two letters, lower-cased
second; a multi-word entry takes its initials, both capitals.** The casing is
doing real work — it tells you at a glance whether you are looking at an
abbreviation or a truncation, which is what makes `Do` and `DV` scan as
different kinds of thing rather than as two spellings of *Documents*.

`Pj` for **Projects** is the one exception in the first column, because `Pr` is
taken by *Proposals* and *Proposals* is the older and more-used word.

### 1.3 ~~The one thing worth re-deciding~~ — decided

The document entries used to run *My Requests → Documents → Documents
Validations → Digitization Lists Generation → Proposals → Additions*, intake
last, so a person tracing an item walked **up** the list. With intake folded
into Documents and generation into Digitization Lists (§1.1), the first four
are in pipeline order, and [[view-map]] §4's *which view has it now* reads
downwards, the same way as the sidebar.

---

## 2. One flat list, and no counts on it

The twelve render as **one list in one order**, with no group headers.

> **There are no groups at all** — not in the sidebar, not on Home, not as a
> way of talking about the entries. An earlier draft put the entries under
> *Work / Plan / Operate / Configure* headers with a count on each; the headers
> were dropped from the sidebar first, kept as vocabulary, and then **removed
> entirely**: the division was invented, not asked for, and rework.md's list is
> one flat list in one order. Where a rule needs to pick some entries — the
> phone's swipe order (§3.1), the resolution of `/` (§8) — it picks by
> **position in the list and by what the actor holds**, never by a group.

**No per-entry count**, either. A bare number beside a nav entry does not say
what it counts: *3* next to *Documents Validations* could be three documents,
three defects or three anything. Counts need a surface that names them, and
that surface is **Watchlists** (§5), where every row is labelled. A view's own
volume belongs in its page header — *"4 of 11 in custody"* — where there is
room to say what the numbers are.

**Rules** — 1 is [[view-map]] §3, restated because the shell is where it is
enforced:

1. An entry the actor cannot reach is **absent, not disabled**. No greyed rows,
   no lock icons — an unavailable entry that is visible is an invitation to ask
   why.
2. **The sidebar is assembled per entry, not per actor.** Grants compose; the
   five names in [[view-rules]] §4 are a shorthand for common bundles, not a
   ladder where holding one implies the ones below. A person may hold *My
   Documents* and *Projects* and nothing else, and the list simply contains
   those two. Any rule phrased as "a reader sees…" is describing a bundle and
   will be wrong for somebody.

   > **Which grant reveals which entry** is [[permissions]] §5. Each entry
   > declares one permission and is visible when the user holds it at any
   > scope — **including *My Documents***, which requires `request.read_own`.
   > No entry is unconditional: a user whose role was misconfigured empty sees
   > an empty sidebar, which is a failure somebody notices rather than one that
   > hides.
3. **The list keeps its order regardless of what is in it.** Entries are
   filtered out, never reflowed or re-sorted, so the same entry sits in the
   same relative place for everybody and muscle memory survives a change of
   role.

---

## 3. Size tiers

| Tier | Nav | Chrome cost | Budget |
|------|-----|:-----------:|:------:|
| `large` | expanded sidebar | **4** | 28 |
| `notebook` | icon rail, expandable | **2** (4 expanded) | 18 |
| `small` | ☰ before the title → left sheet | **1** | 10 |
| `phone` | ☰ before the title → left sheet | **1** | 6 |

Costs are [[view-rules]] §1.2. The four built demos already implement this
row-for-row, so the shell is not new work at `large`, `small` or `phone` — only
the entry list and §4's behaviour are.

> **Notebook views must fit at 4, not 2.** The rail is only the *default*; the
> toggle is persistent (§4.3), so a user may leave the sidebar expanded
> forever. A notebook view measured at 16 with the rail is at 18 without it,
> and 18 is the ceiling. Measure notebook chrome with the sidebar **expanded**
> and treat the collapsed rail as headroom, not as the baseline.

**`small` has no rail.** It is a hamburger, because a 12-entry rail at that
width competes with the table for horizontal space it cannot spare, and small
is where a touch device is most likely to be.

**`phone` has no bottom bar** (decided 2026-10-06; it replaces the bottom tabs
and *More*). It works like `small`: ☰ sits before the page title and opens the
sidebar as a left sheet. The page's actions are at the top right, on the same
line: one primary and `…` ([[view-rules]] §5 rule 2). **Nothing is fixed at the
bottom of the screen**, neither tabs nor actions, so the last rows of a list
are never covered. Moving between entries is the swipe in §3.1.

### 3.1 Phone gestures

Decided 2026-10-06. The same horizontal swipe means one thing per layer. On a
page it moves between entries; on an open record it moves between records.
Closing is never a horizontal swipe, so the two never compete.

| Gesture | Where | Does |
|---|---|---|
| **Swipe ← / →** on a page | nothing open over it | next / previous sidebar entry the person holds, in sidebar order, no wrap |
| **Swipe ← / →** on a record | the open record sheet ([[view-rules]] §1.4), or a drawer (Tasks, Plugins) | next / previous row of the list it was opened from, in the list's order and grouping, loading more near the end. The list behind follows, so closing lands on the record you ended on |
| **Back** | a record, drawer, filter sheet, the nav sheet or a dialog | closes it, in any of three ways: the system's Back (button or edge swipe), the ‹ in the sheet's head, or a swipe down started on the sheet's head |
| **Long-press** a row | lists with picking (the list editor, bulk approve) | starts picking; after that a tap toggles ([[view-rules]] §5 rule 5) |

What keeps them apart:

- **One layer at a time.** The entry swipe is off while anything is open over
  the page. The record swipe exists only on the sheet.
- **Not on things that scroll sideways.** Neither swipe starts on watchlist
  tabs, chips, a wide table or a text field.
- **Not at the screen's edges.** iOS and Android both use a swipe in from
  the edge as their Back. So neither swipe starts there, and the nav sheet
  opens only from ☰.
- **Back takes one step.** On the phone, opening a record pushes a history
  entry and moving between records replaces it. Back then closes the sheet
  however many records were swiped through, and never leaves the page by
  surprise.
- **Dialogs take no swipe.** A dialog with typed text answers Back with
  *Discard changes?*.
- **The motion says where it goes.** The page or record follows the finger,
  with the neighbour's name at the side ("Proposals ›", "D24 ›"). Below a
  threshold it springs back, and at an end nothing moves.

---

## 4. The rail

### 4.1 What it shows

**Two letters, no icons** — rework.md: *"mini bar with short sections names
(just 2 letters)"*, and the original demos draw exactly that. An earlier draft
of this section asked for icon **and** letters; that was not asked for and is
withdrawn. The letters are what disambiguates *Documents* from *Documents
Validations* (`Do` / `DV`), which no icon pair would do as reliably. The foot
of the bar — Watchlists, the user menu — keeps its icons, because those rows
are not entries and have no letters.

**No entry carries a count, so none survives into the rail** — §2. The two
numbers the sidebar does show are Watchlists' total (§5) and the running-task
count (§6), and both become a dot on their icon when collapsed. Neither is an
entry.

**Nothing moves under the pointer.** The collapsed task dot is shorter than
the expanded panel, so the rail reserves the panel's height; otherwise
expanding pushes Watchlists up just as the cursor reaches it.

### 4.2 Hover-expand

Hovering the collapsed rail expands it; navigating collapses it again — and
it **stays** collapsed on the next page until the pointer has left the bar
once, since the cursor is usually still over the rail when the page loads.
While a popover from the foot (Watchlists, user menu) is open, the bar stays
expanded, so the panel's anchor does not slide away as the pointer travels
into it.

1. **It overlays, it does not push.** The expanded panel floats above the
   content. Pushing would reflow the table on every accidental mouse pass,
   which is the difference between a convenience and a fault.

   > Implementation note, because the obvious version is wrong: expanding the
   > sidebar element itself and switching it to `position: absolute` on hover
   > takes it **out of flow**, so the content jumps left by the rail's width —
   > the same fault in the opposite direction. The element must keep its
   > collapsed width in flow and an inner layer must do the growing. This was
   > caught by asserting in the screenshot harness that the content's x
   > coordinate does not change on hover.
2. Because it overlays, it is a transient surface and costs **0**
   ([[view-rules]] §1.3 rule 1). The rail's 2 points already paid for it.
3. **Open on a delay, close immediately.** Roughly 200ms in, 0 out. The delay
   is what stops a cursor crossing to the table from opening it; the instant
   close is what stops it feeling sticky.
4. **Hover-expand does not exist without a pointer.** `notebook` is a size, not
   a device — a touchscreen laptop reports that width. Gate it on
   `(hover: hover) and (pointer: fine)`; where that fails, tapping the rail
   expands it and tapping outside collapses it.
5. **Keyboard focus expands it too, and does not auto-collapse.** Someone
   tabbing through the rail must be able to read where they are, and a panel
   that closes when focus moves inside it is a trap.

### 4.3 The toggle, and remembering it

- **The button is a row inside the bar**, directly under the logo — a
  full-width target with a chevron that rotates. Not a tab clipped to the
  sidebar's outer edge: that reads as a handle belonging to the boundary rather
  than a control belonging to the sidebar, and it is a small target sitting on
  top of the content it is meant to move.
- The preference is stored **per device, not per account**. The same person on
  a 32-inch monitor and a 13-inch laptop wants different answers, and syncing
  the choice to the account guarantees one of the two is wrong. `localStorage`,
  keyed by tier.
- **Default by tier**: `large` expanded, `notebook` collapsed. This is the
  stated default and it is also the right one — the tier boundary is where the
  sidebar stops being free.
- Crossing a tier boundary — resizing, docking a laptop — applies that tier's
  **stored** preference if there is one, otherwise its default. It never
  carries the other tier's choice across.

---

## 5. Watchlists

A watchlist is a **saved filter inside a view** — a *lens* in [[view-map]] §1,
addressable, owned by the user.

**It is one sidebar row that opens a popover**, not a list of rows in the
sidebar. This is the part of the sidebar whose length the *user* controls, so
it is the one part that must not be allowed to grow the sidebar: ten watchlists
would push Hooks off the bottom. A popover has its own scroll and its own
ceiling.

The row carries a **total** — the one number in the sidebar, and the only one
that can be read without ambiguity, because the panel behind it itemises
exactly what it adds up. Collapsed to the rail, the total becomes a dot on the
icon.

Inside the panel:

- **Grouped by view**, and each row names its view. *Awaiting my review* and
  *Awaiting review* are different things in different views, and a bare name
  makes them indistinguishable.
- **Each row carries its own count** — which is what makes the total legible.
- Authored only where advanced filtering exists, `large` and `notebook`
  ([[view-rules]] §2 rule 3). Consumed at every tier.
- It ends with **Manage watchlists**, which opens Preferences → Watchlists
  (§7, [[filtering]] §4.3).

> **Counts are opt-in per watchlist.** A count on a saved lens means running
> that query on every page load, and a watchlist is an *arbitrary* advanced
> predicate. Offering counts on all of them by default is how the sidebar
> becomes the slowest thing in the application.

---

## 6. Running tasks

Present only while something is running — usually absent, not usually zero.

**It is not a row and not a popover. It is a small panel that lives in the
sidebar**, showing each running task with a progress bar:

```
Tasks running                    2
CatalogValidity — nightly sweep 34%
▬▬▬▬▬▬▬▬░░░░░░░░░░░░░░░░░░░░░░
Kramerius — registry refresh     7%
▬▬░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

Collapsed to the rail it becomes a single filled dot carrying the count.

The reason it is a panel rather than a link is that **progress is the whole
message**. A row saying *2 running* tells you nothing you can act on; two bars
tell you whether to wait thirty seconds or go and do something else. It costs
the vertical space of about two nav entries and only while something is
running.

- What appears is what **this user** started (`task.read_own`), plus, for
  `task.read`, everything running. A curator does not need a live feed of the ingest queue; they
  need to know their own re-check finished.
- It renders the same state as *Tasks*. If the two disagree, the panel is
  wrong, because Tasks is the page with room to be right.
- Clicking through goes to *Tasks*.

---

## 7. User menu

One popover at the foot of the sidebar: preferences, change password, logout,
and whatever else accumulates. Not a group, not a route.

- At `small` and `phone` it lives at the foot of the sheet ☰ opens, below the
  entry list.
- **Preferences is a page**, `/preferences`, though not a sidebar entry
  (decided 2026-10-06). Its sections:
  - **Watchlists:** the page [[filtering]] §4.3 describes. `/watchlists`
    leads here.
  - **Display:** the sidebar per tier (§4.3), the tab each view opens on
    (the last one used, or a fixed one; [[filtering]] §4.2), list density
    and date format, and later the language.
  - **Account:** the name and the identities it signs in with, read-only;
    *Change password* for a local account only.

  The settings are kept per person on the server, so they follow the person
  between devices. Until that store exists, the client keeps them in the
  browser.
- **Logout is separated from the rest**, by a rule and by position. It is the
  one item in the menu that cannot be undone by clicking it again.

---

## 8. Home

`/` resolves here, and the logo navigates here. Whether Home is a **page** or a
**redirect** depends on how much the actor can reach:

| Entries the actor holds | `/` is |
|---|---|
| **none** | one line: this account has no access yet, and who to ask |
| exactly one, anywhere in the sidebar | a **redirect** to it — there is no Home page |
| more than one | a **card page** |

The zero row is not a defensive nicety. The system fails closed
([[permissions]] §5) — a user whose roles were never granted has no sidebar and
nothing to land on — and the difference between *that* and a broken application
is one sentence naming who fixes it.

**The count is across the whole list.** This is the part that is easy to get
wrong. Permissions compose — they are not a ladder of five actors, and holding
one grant does not imply the ones below it. Somebody may have proposal rights
over documents *and*, separately, membership of a project: *My Documents* and
*Projects*, nothing else. Counting only the document entries would redirect
them to My Documents and quietly bury the other half of what they can do. Two
entries, two cards, no redirect.

The degenerate case is the one worth naming: a **pure reader holds exactly one
entry**, so their Home *is* My Documents — reached by the logo, by `/`, and by
the sidebar, all landing on the same place. No landing page holding a single
card that says *see my documents*.

### 8.1 What is on the card page

**Cards, not charts.** One card per entry the actor holds, phrased as what you
came to do rather than as the page's name — *check how my proposals went*, not
*My Documents*. Ordered by §1's order, filtered by §2 rule 1, so the card page
cannot drift out of step with the sidebar.

Charts are not excluded from the product, only from here. They belong on a
view's overview strip ([[view-rules]] §2), where clicking one *filters*
something. A chart on Home has nothing to filter, and the counts it would
show already have a home — on the cards themselves (§8.3) and in Watchlists
(§5).

### 8.2 Cards are destinations; actions live in views

A card navigates. It is **not** where an action is performed, because every
action already has a correct home and it is the view the action acts on:

| rework.md card | Card links to | The action itself lives in |
|---|---|---|
| propose a document for digitization | Documents | primary CTA on *Documents* — and *approve now* on the same form for a curator ([[status-model]] §2.8) |
| check how your proposals went | Documents | — it is the view |
| generate a new digitization list | Digitization Lists | *New list* — primary CTA there |

Keeping these separate is what stops Home from slowly becoming a second
application. A card that *performs* rather than navigates is a button that
should have been on the page you land on — and it would be the one copy of that
button nobody maintains.

### 8.3 What a card is made of

Three lines, and a card may have only two of them:

```
Decide what gets digitized            ← the job, in the words of the person doing it
Proposals                             ← where it lands. Same string as the sidebar
7 waiting for your review             ← optional. One number, and it names itself
```

**The job line is the card.** *Check how your proposals went*, not *My
Documents* — §8.1. The entry name underneath is not decoration: it is what makes
the card and the sidebar row visibly the same destination, so learning Home
teaches the sidebar rather than competing with it.

**A card carries a number only when the number is work waiting for this
actor.** That is the whole test, and it is [[view-map]] §3's reasoning about
*Documents* applied one level up: the only number Documents could show is how
many documents exist, which is not a claim that anything is waiting for you.
So:

| Card | Number | |
|---|---|---|
| Documents | *2 batches failed to ingest* — to an admin | ✅ blocked, and only you can unblock it |
| My Documents | *4 still in progress* | ✅ yours, and unfinished |
| Proposals | *7 waiting for your review* | ✅ in your custody, undecided — **including requests held because a copy exists** ([[status-model]] §2.8) |
| Documents Validations | *4 need checking* | ✅ |
| Digitization Lists | *312 ready to be listed* — to someone holding `list.create` | ✅ the pool the editor exists to drain; to a read-only viewer, nothing |
| Tasks | *1 task failed last night* | ✅ failures only — *running* is already a sidebar panel (§6) |
| Documents, to anyone else · Projects · Categories · Intentions · Users & Groups · Plugins · Hooks | — | how many exist is not a claim that anything is waiting |

**Documents is the one card whose number depends on who is looking**, because
it is the one entry that serves three reaches. To an admin (`addition.retry`)
it counts failed batches — the old Additions card, which is where that work now
lives. To a reader it counts their own unfinished items — the old My Requests
card. To staff and curators it carries none: *how many documents exist* is
still not work waiting for anybody.

**This does not reopen §2's no-counts rule, it is that rule's own escape
clause.** A bare number beside a nav entry is unreadable because nothing labels
it; a card has a sentence to say what it counts, which is exactly why counts
were sent to Watchlists (§5) rather than deleted. Home is the second surface
that qualifies.

**At zero the line is absent, not zero.** A card with no third line reads as
*nothing to report*, which is learnable; twelve zeros read as an application
that mostly does nothing. This is [[view-rules]] §4.4 — absent, never blanked —
applied to a count.

**Order is §1's order, always, and never the data's.** Cards do not float to
the top because they have a number. A page that rearranges itself with the
workload cannot be learned, and the entries are already filtered-not-reflowed
in the sidebar (§2 rule 3) for the same reason.

**No group headers.** One grid, in the list's order — Home draws no structure
the sidebar does not have (§2). Twelve cards at most, each led by the job it
does, scan without headings; and a card page that grouped what the sidebar
does not would teach two different maps of one application.

### 8.4 Per tier

The card is the same at every tier. What changes is how many sit side by side:

| | large | notebook | small | phone |
|---|---|---|---|---|
| **columns** | 4 | 3 | 2 | 1 |
| **card** | box | box | box | **row** — job and count stacked, full width |
| **header** | *Signed in as …* | same | same | same |
| **reaching Home** | the logo | the logo | the logo, in the sheet | the logo, in the sheet |

Four things about it are worth the words:

- **The column counts were 3 / 2 / 2 / 1 until it was drawn.** Two columns at
  1440 give each card 660px to carry a forty-character line — a great deal of
  air around three short lines. A column count is a decision rather than an
  arithmetic result ([[view-rules]] §6), which is exactly why it is written
  down per tier, and why drawing it is what corrects it.
- **The phone card is a row, not a shrunken box.** Boxes at 393px are one
  per screenful with twelve to get through. Rows put seven on screen at the
  same type size, which is the tier rule doing its job — the layout gives way,
  the type does not.
- **Home needs no new control at `small` and `phone`.** The logo is already the
  first thing in the sheet ☰ opens, and the logo navigates Home at every
  tier.
- **The header is *Signed in as …*, not *Home*.** Library desk machines are
  shared and stay logged in; whose session this is, is the one genuinely useful
  thing a landing page can say, and it is otherwise buried in the user menu
  (§7).

### 8.5 The declaration

Filled in per [[view-rules]] §6, which every view owes before it is drawn:

```yaml
view: home
route: /                             # resolves before it renders — §8
nav: —                               # reached by the logo, never a sidebar entry
actor: { primary: any, secondary: — }   # assembled per grant, like the sidebar
tiers: [large, notebook, small, phone]

points:                              # notebook chrome measured EXPANDED, §1.3 rule 5
  record: { large: 3, notebook: 3, small: 3, phone: 3 }   # job + entry + count
  chrome: { large: 4, notebook: 4, small: 1, phone: 3 }   # the nav, and nothing else

filtering:
  overview: []                       # §8.1 — a chart here has nothing to filter
  facets:   []
  advanced: { tiers: [], operators: [] }
  defaults: {}

search:
  rules: []                          # §3 rule 5 scopes search to a view's own
  scope: —                           # entity. Home has no entity

actions:
  primary: []                        # §8.2 — cards navigate, they never act
  secondary: []
  overflow: []
  bulk: []

columns:                             # one card per held entry, §1 order, §2 rule 1
  large:    [job, entry, waiting]
  notebook: [job, entry, waiting]
  small:    [job, entry, waiting]
  phone:    [job, entry, waiting]
```

**Home is the only page in the application with headroom at every tier** — 3 of
12 down to 3 of 5 on the record budget, 4 of 28 down to 3 of 6 on chrome. That
is a result, not an oversight: the card is already at its minimum, so nothing
has to be dropped as the screen shrinks, and there is nothing left to drop if a
tier ever gets tighter.

### 8.6 What the headroom is not for

Spending it is how Home becomes a dashboard, so each of these is refused by name:

| Tempting | Where it belongs instead |
|---|---|
| charts of anything | a view's overview strip, where clicking one filters ([[view-rules]] §2) |
| a global search box | the view being searched — search is scoped to one entity (§3 rule 5) |
| the Watchlists panel | the sidebar row it already has (§5); a second copy is a second thing to disagree |
| the running-tasks panel | the sidebar panel it already has (§6), even at `small` and `phone` where that panel sits behind a tap |
| *recently viewed* | nowhere — it reorders itself, which §8.3 forbids |
| an activity feed | the [[status-log]] on the record it happened to |

---

## Related

- [[view-map]] — which views exist, and which actor owns each
- [[view-rules]] — §1.2 chrome budget, §1.3 transient surfaces, §4 actors
- [[relationships]] — §5, the three ways a view reaches documents
- [[status-model]] — §4, the badge the Home counts are counting

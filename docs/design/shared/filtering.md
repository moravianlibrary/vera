# Filtering and watchlists

One way to filter, on every list page, and watchlists that say on the sidebar
entry when something new arrived. Drafted 2026-10-02 for review, from the
user's direction: *unite the ways filtering works, simple where it can be,
advanced where it must; put the watchlist badge on the entry it watches; give
watchlists one place to be managed.*

Replaces, once agreed: [[view-rules]] §2 (*three mechanisms, deliberately not
merged*), [[navigation]] §2 (*no per-entry count*) for watchlist changes only,
and [[navigation]] §5 (counts opt-in). Search ([[view-rules]] §3) is kept as
it is, and becomes one predicate of the same filter.

---

## 1. What the demos do today

Every page filters, and each one does it a little differently:

| Page | Opening state | Quick control | Add filter | Group by | Save as Watchlist |
|---|---|---|---|---|---|
| Documents | everything | *Status: any* · *Mine* | Project (works) · Category, Priority, Existing copy, Asked by (labels) | batch · project | yes |
| Proposals | awaiting a decision | *Show* | Material type, Proposal custody, Project (work) · Existing copy, Asked by, Batch, Since (labels) | batch · requester | yes |
| Validations | review needed | *Show* | Defect, Category (work) · Priority, Project, Since (labels) | — | yes |
| Digitization Lists | planned and running | *Show* | Intention, Created by, Runs (labels) | — | yes |
| Tasks | finished runs | — | State, Trigger, Plugin, Started by (work) | — | yes |
| Users & Groups | everything | — | Show: People, Agents, No role yet | — | no |
| Plugins | everything | — | Type, State | — | no |
| Hooks | everything | — | Sends by, State | — | no |
| Categories | the tree | *Show* (what each row carries, not a filter) | — | — | no |
| Projects, Intentions | cards | — | — | — | no |

Three things are wrong with it. The same idea, *which records*, is a *Show*
select on one page, a chip on another and a checkbox on a third. Half the
filters offered are labels that do nothing. And view-rules §2 keeps
*overview*, *facet* and *advanced* filtering as three separate mechanisms,
when what a person sees is one question asked with more or less precision.

---

## 2. One filter

A filter is **a list of predicates over the view's fields**, plus the search
text. Nothing else. Every control on the bar reads and writes that one list,
and the URL is that list, so a filtered page is always an address:

```
proposals.html?decision=Pending&type=Periodical,Map&asked=>2026-06-01&q=Brno
```

| Predicate | Written | Means |
|---|---|---|
| equals one of | `type=Periodical,Map` | OR within a field |
| not | `type=!Map` | |
| range | `pages=>1000` · `pages=<200` · `asked=2026-06-01..2026-06-30` | numbers and dates |
| empty / present | `copy=none` · `copy=any` | *no registry state*, *has a project* |
| search | `q=Brno` | [[view-rules]] §3, as now |

Predicates on different fields are **AND**. A field appears at most once.

### 2.1 Each view declares its fields

A view does not build its own filter UI. It declares its fields, and the bar
is drawn from the declaration:

```
field
  key        'decision', 'type', 'custody', 'project', 'pages', 'asked'
  label      'Decision', 'Material type', …
  type       enum | ref | text | number | date | bool
  values     for enum and ref: the closed list, counted over the current set
  ops        which of §2 it allows — equality always; range for number and date
  quick      shown on the bar itself, §3.1 — at most two per view
  default    the opening value, e.g. decision=Pending
  reads      the permission it needs; without it the field does not exist (view-rules §2 rule 5)
```

The fields of every view are §6.

---

## 3. Three levels, one bar

The three ways stay, as **three depths of the same filter**, not three
mechanisms. A person goes as deep as the question needs, and every level
produces the same chips.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [Search — title, catalog ID, volume…]  Decision [Awaiting ▾]  Custody [Mine ▾] │
│ Material type: Periodical, Map ×   Asked: after 1 Jun ×   [+ Filter]  Advanced… │
│                                                      Save as watchlist · Clear  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Quick — on the bar

The view's one or two most-asked fields, as selects on the bar: *Decision* on
Proposals, *Validation* on Validations, *State* on Lists and Tasks. This is
what *Show* is today, under the field's real name. Picking a value **is** a
predicate. Its default is the view's opening state, and a quick field at its
default shows no chip.

### 3.2 Filter — chips

**+ Filter** lists every declared field. Picking one opens a small editor:
checkboxes for an enum or a ref, each with its count over the current set
(facets, [[view-rules]] §2), and a field for a number or a date. *Apply*
adds a chip. Clicking a chip reopens its editor; **×** removes it.

Clicking a segment of an overview strip, where a view has one, adds the same
chip.

### 3.3 Advanced — every chip at once

**Advanced…** opens all of the filter as one list of rows: field, operator,
value. That is where *not*, ranges, *empty* and the second value of a range
are edited, and where a field reached through another record is picked
(*project → its state*, *list → its dates*). It writes chips like the others,
and a chip shows the whole predicate: *Pages > 1 000*, *Material type is not
Map*.

**Per tier**: quick and chips everywhere; the Advanced editor at large and
notebook. At small and phone an advanced chip is shown and removable, never
dropped ([[view-rules]] §2 rule 1). Phone keeps its one *Filter* button,
which opens the chips and quick fields as a sheet.

### 3.4 Group by is not a filter

*Group by batch*, *by project*, *by requester* change how the rows are
arranged and keep every row, so they stay a separate control beside the count
and are not saved in a watchlist.

---

## 4. Watchlists

A watchlist is **a saved filter on one view**: the view, its predicates, a
name, an owner. *Save as watchlist* on the bar saves exactly the chips shown,
quick fields included. It can be saved at any tier, since saving is naming
what is already on the bar, not building it (this replaces [[view-rules]] §2
rule 3).

### 4.1 What a watchlist tracks

| | |
|---|---|
| **items** | what matches now |
| **new** | items that **entered** it since its owner last opened it. Leaving does not count: a proposal decided and gone from *Awaiting my review* is not news |
| **seen** | set when the owner opens the watchlist, or the view with exactly its filter |

*New* is computed from status-log events, not by re-running every query on
every page load. An event about a record re-evaluates that record against the
watchlists on its view; it is what made counts too costly to have by
default, and it is why they no longer need to be opt-in.

### 4.2 The badge is on the entry it watches

**The sidebar entry of a view carries a badge when its watchlists have new
items**: the number of distinct new items across that view's watchlists.

```
  Do   Documents
  Pr   Proposals              4
  DV   Documents Validations  1
```

This reverses [[navigation]] §2 for this one number, and the reason that rule
gave is answered: the number does not count the view's volume; it counts what
**changed** in lenses the person drew themselves. Hovering says what it is:
*4 new in your watchlists — Periodicals 3, More than one asker 1*.
Collapsed to the rail it is a dot. A watchlist set to *no badge* (§4.3) is
not counted.

**Opening the entry does not clear it**; opening the watchlist does. The
entry opens on the view's default filter, which is not the watchlist.

### 4.3 The Watchlists row and its page

The **Watchlists** row in the sidebar foot stays. Its popover lists the
watchlists grouped by view, each with *new* and *items*, and ends with
**Manage watchlists**, which opens a page of its own:

```
/watchlists        not a sidebar entry — reached from the Watchlists row

View          Watchlist                    Filter                              Items  New  Badge
Proposals     Periodicals                  Material type: Periodical            10    3    on
              More than one asker          Askers > 1                            1    1    on
Validations   Page counts                  Defect: PageCount                     2    —    on
Documents     High priority, not listed    Priority: Urgent, High · Ready        3    —    off
                                                    [Open] [Rename] [Edit filter] [Delete]
```

- **Every watchlist the person owns**, grouped by view in sidebar order,
  draggable within a view (the order the popover uses).
- **Badge** on or off per watchlist: a lens kept for reference should not ping.
- **Edit filter** opens the view with that filter applied and *Save* in place
  of *Save as watchlist*.
- **A watchlist on a view the person can no longer open** is listed greyed
  under *No longer reachable*, with *Delete*: losing a role must not delete
  someone's lenses, and getting it back brings them back.
- Not a sidebar entry: the twelve stay as they are ([[navigation]] §1). If it
  should become one, that is a decision to take on its own.

### 4.4 What a watchlist is not

- **Not shared**, not yet. A shared lens is a team's queue, which is a view,
  and needs its own decision.
- **Not a notification.** Mail or chat on a watchlist change would be a hook
  on a derived condition, which [[view-catalog]] *Hooks* rules out. The badge
  is the notification.

---

## 5. Stored

```
watchlist
  id, owner_id → user
  view              'proposals', 'validation', … — a sidebar entry id
  name
  filter            jsonb — the predicates, as in the URL (§2)
  badge             bool    default true
  position          int     within its view
  seen_at           timestamptz

watchlist_entry      — what makes "new" cheap
  watchlist_id, record_id
  entered_at        timestamptz
  UNIQUE (watchlist_id, record_id)
```

`new = entries with entered_at > seen_at`. An entry is added when a record
starts matching and removed when it stops.

---

## 6. The fields of each view

**Bold** is quick (§3.1). *Italic* is advanced-only: it needs an operator
beyond equality, or a field reached through another record.

| View | Fields |
|---|---|
| Documents | **Decision** · **Progress** · Mine · Validation · Restricted · Cancelled · Category · Priority · Project · Existing copy · Asked by · Batch · *Pages* · *Asked* · *Iteration count* · *Project → state*. A requester: **Status** only, in the public vocabulary |
| Proposals | **Decision** · **Proposal custody** · Material type · Project · Existing copy · Asked by · Batch · Askers · *Asked* · *After the project's approval* |
| Documents Validations | **Validation** (incl. Forbidden) · Defect · Category · Priority · Project · *Waiting since* · *Found after digitization* |
| Digitization Lists | **State** · Counts towards · Created by · Generated · *Runs* · *Blocked items* |
| Projects | **Decision** · Period · Manager · Member — the cards filter too |
| Intentions | **Kind** (target, tracking) · State · Funding · Scope · *Tracks* |
| Tasks | **State** · Trigger · Plugin · Started by · *Started* |
| Schedules | Plugin · Paused |
| Users & Groups | **Show** (people, agents, no role yet) · Role · Group · Proposal custody · Signs in with |
| Plugins | Type · State · *Has warnings* |
| Hooks | Event · Sends by · State |
| Categories | none — the tree is the record; *Show* there picks what each row displays, not which rows |

**Documents changed its quick fields** (2026-10-05). The single *Status*,
derived by precedence, is gone from the staff bar: a derived badge hides the
dimension underneath it (a scanned document still restricted shows
*Digitized*), so it cannot be filtered on honestly. Staff filter on the
stored dimensions the status is made from ([[status-model]] §1): *Decision*
and *Progress* quick, *Validation*, *Restricted* and *Cancelled* under
**+ Filter**. A document holds the decisions of its current askers; the
other dimensions belong to its current iteration, so a document with none
yet holds none of them. The row still shows one status badge. *Mine* stays
on the bar as a checkbox beside the quick fields. A requester keeps one
quick *Status*, in the public vocabulary, now several values at once.

---

## 7. To decide

1. **The badge counts new items**, distinct across the view's watchlists.
   The alternative is a dot with no number, or the number of watchlists
   that changed.
2. **New means entered since last opened.** Should a status change of an
   item already in the watchlist count too (*Ready → Published* inside
   *High priority, not scheduled*)?
3. **Opening the view does not clear the badge**; only opening the
   watchlist does.
4. **The Watchlists page is not a sidebar entry.**
5. **Projects and Intentions gain filters**, though they are cards today.

## Related

- [[view-rules]]: §2 replaced, §3 search kept
- [[navigation]]: §2 and §5, revised by §4 here
- [[status-log]]: the events that move watchlist entries

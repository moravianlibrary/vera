# Filtering and watchlists

One way to filter, on every list page, and watchlists that say in the navbar
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
| Users management | users | Show: People, Agents, No role yet | Role, Group, Project, Proposal custody set, Category custody; Custodies: member source and Custody plugin | — | no |
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

> **Decided 2026-10-06 — no Advanced editor.** A range field (Pages, Asked)
> is one more entry in *+ Add filter*. Picked, it is a chip reading *any*
> until it is given a value, and the chip opens what the field takes: a range
> of days offers *Last 7 days*, *Last 14 days*, *Last 30 days*, *This month*
> or two days; a count offers the presets its view gives it (Pages: *Under
> 100*, *100–499*, *500–999*, *1,000 and more*) or two ends. A day preset is
> kept as its word (`asked=last-7-days`) so a watchlist stays relative. Every
> tier edits ranges, the phone in its filter sheet. What follows is kept for *not*,
> *empty* and fields through another record, which have no design yet.

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
name, and who sees it: its creator alone, or a system-defined audience
(§4.5).
The view shows its watchlists as tabs above the bar, and **+** at the end of
them saves exactly the chips shown, quick fields included. It can be saved at any tier, since saving is naming
what is already on the bar, not building it (this replaces [[view-rules]] §2
rule 3).

### 4.1 What a watchlist tracks

| | |
|---|---|
| **items** | what matches now |
| **new** | items that **entered** it since **this person** last opened it. Leaving does not count: a proposal decided and gone from *Awaiting my review* is not news |
| **seen** | **per person**: set when they open that watchlist. A system watchlist has one *seen* for each eligible person |

*New* is computed from membership entry events, not by re-running every query
on every page load. A reliable change queue re-evaluates affected records
against relevant watchlists; relative time filters are checked at their time
boundaries. See [[watchlists-and-notifications]].

### 4.2 New item badges

The Watchlists navbar entry counts **watchlists with unseen entries**, not
records or definition changes. Each watchlist tab shows its own number of new
matching records. Hidden watchlists and those with badge disabled do not
contribute to the navbar count. Opening the Watchlists page does not mark a
watchlist seen; opening that watchlist does. Sending its email does not mark
it seen either. See [[watchlists-and-notifications]].

A source view still opens on the tab the person last left there, *All* or a
watchlist, remembered per person and per view (decided 2026-10-05). In
Preferences → Display they can fix a view's opening tab instead
([[navigation]] §7). *All* is the view with no filter. A link that names a
filter or a record opens what it names.

### 4.3 The Watchlists page

**Watchlists** is one navbar page at `/watchlists`, last in the visible list.
It has **My watchlists** and **System watchlists**. A manager sees all system
watchlists and can maintain them; other people see only system watchlists whose
audience and source view they may access. The page lists saved filters and
links each one to its source view. Per-person badge, visibility and delivery
controls live there. This replaces the sidebar-foot popover and Preferences →
Watchlists design from 2026-10-06. See [[watchlists-and-notifications]].

### 4.4 What a watchlist is not

- **Not a Hook.** A person may enable email or chat for records entering a
  watchlist ([[watchlists-and-notifications]]). Its delivery does not create
  an admin Hook or mix mail with Hook mail.
- **Not a role's view.** A watchlist shared with a group or a role is a lens
  its audience can open, not a queue assigned to them (§4.5). Nobody is
  responsible for emptying it.

### 4.5 Personal and system

A watchlist is **personal** or **system**. System watchlists have an audience:

| Audience | Who sees it |
|---|---|
| personal | its owner |
| everyone | everybody who opens the view |
| groups and roles | the members of the chosen groups and the holders of the chosen roles (direct or mapped by an Identity instance), as one union |

Every audience stops at who may open the view, and at the vocabulary it was
drawn for: staff, since a requester's *My Documents* is their own asks.

| | personal | system |
|---|---|---|
| maintained by | its owner, under `watch` | holders of `watchlist.manage_shared` only ([[permissions]] §3) |
| on the tabs | after the system ones | first, marked as *System* |

**Save to my watchlists** asks for a name. A manager may instead **Publish as
system watchlist** and set an audience. Publishing from a personal watchlist
creates a separate copy, leaving the personal one intact. A system tab the
person may not change offers only *Discard* for an edited filter; they may
save that filter as their own personal watchlist.

**System watchlists are managed on `/watchlists`**. Publishing a personal
watchlist creates a separate system copy. Users management does not list
watchlists or show watchlist cards on access records. See
[[watchlists-and-notifications]].

**A filter is saved once among one's own.** Two watchlists on one view are the
same when their filters select the same records, whatever their names. The
server refuses (409) a new watchlist, or a changed filter, that would repeat a
watchlist the person already sees: their own and the shared ones that reach
them. **+** and *Save changes* are disabled, with the name of the watchlist
that already holds the filter.

**Publishing warns instead of refusing.** A system watchlist whose audience
reaches somebody who already keeps the same filter as their own is allowed
(decided 2026-10-06). *Publish* says how many of them there are before saving
("2 of the 14 already keep this filter"), and they see both until they delete
their own. Refusing would let one person's private lens block a lens meant for
a whole group, and the sharer cannot see it to resolve it.

**System watchlists badge like personal ones.** *Seen* is kept per person
(§4.1), so a system watchlist counts new items for each person who sees it,
unless they hid it or switched its badge off.

---

## 5. Stored

```
watchlist
  id, created_by → user who saved or published it
  kind              'personal' | 'system'
  audience          for system: 'everyone' | 'some' — who sees it (§4.5)
  view              'proposals', 'validation', … — a sidebar entry id
  name
  filter            jsonb — the predicates, as in the URL (§2)

watchlist_audience   — only for audience 'some'
  watchlist_id
  group_id | role_id  exactly one
  UNIQUE (watchlist_id, group_id, role_id)

watchlist_viewer     — one per person and watchlist they see
  watchlist_id, user_id
  seen_at           timestamptz
  badge             bool    default true
  hidden            bool    default false
  position          int     within its view, in their tabs
  UNIQUE (watchlist_id, user_id)

watchlist_entry      — what makes "new" cheap
  watchlist_id, record_id
  entered_at        timestamptz
  UNIQUE (watchlist_id, record_id)
```

`new = entries with entered_at > watchlist_viewer.seen_at` for that person.
An entry is added when a record starts matching and removed when it stops.

**Creation history is retained on system watchlists.** Publishing creates a
separate system watchlist, rather than changing a personal one in place.

**What belongs to the person moved to `watchlist_viewer`.** *Seen*, the
badge, the order and *hidden* are each person's, which is what lets a system
watchlist badge (§4.5). A viewer row is created when the person first sees the
watchlist, and it lapses with the audience: leaving a group removes the
watchlist from their tabs and keeps the row, so coming back brings their
settings back.

---

## 6. The fields of each view

**Bold** is quick (§3.1). *Italic* is advanced-only: it needs an operator
beyond equality, or a field reached through another record.

| View | Fields |
|---|---|
| Documents | **Decision** · **Progress** · Mine · Validation · Forbidden · Cancelled · Category · Priority · Project · Existing copy · Asked by · Batch · *Pages* · *Asked* · *Iteration count* · *Project → state*. A requester: **Status** only, in the public vocabulary |
| Proposals | **Decision** · **Proposal custody** · Material type · Project · Existing copy · Asked by · Batch · Askers · *Asked* · *After the project's approval* |
| Documents Validations | **Review** · Forbidden (Yes / No) · Defect · Category · Priority · Project · *Waiting since* · *Found after digitization* |
| Digitization Lists | **State** · Counts towards · Created by · Generated · *Runs* · *Blocked items* |
| Projects | **Decision** · Period · Manager · Member — the cards filter too |
| Intentions | **Kind** (target, tracking) · State · Funding · Scope · *Tracks* |
| Tasks | **State** · Trigger · Plugin · Started by · *Started* |
| Schedules | Plugin · Paused |
| Users management | Users: **Show** (people, agents, no role yet) · Role · Group · Project · Proposal custody set · Category custody. Custodies: Custodians · Custody plugin |
| Plugins | Type · State · *Has warnings* |
| Hooks | Event · Sends by · State |
| Categories | none — the tree is the record; *Show* there picks what each row displays, not which rows |

**Documents changed its quick fields** (2026-10-05). The single *Status*,
derived by precedence, is gone from the staff bar: a derived badge hides the
dimension underneath it (a scanned document still restricted shows
*Digitized*), so it cannot be filtered on honestly. Staff filter on the
stored dimensions the status is made from ([[status-model]] §1): *Decision*
and *Progress* quick, *Validation*, *Forbidden* and *Cancelled* under
**+ Filter**. A document holds the decisions of its current askers; the
other dimensions belong to its current iteration, so a document with none
yet holds none of them. The row still shows one status badge. *Mine* stays
on the bar as a checkbox beside the quick fields. A requester keeps one
quick *Status*, in the public vocabulary, now several values at once.

---

## 7. To decide

1. Decided 2026-10-10: the navbar badge counts watchlists with unseen entries;
   each watchlist tab counts its own new records.
2. Decided 2026-10-10: *new* means entered since last opened. Changes while
   an item keeps matching do not count.
3. Opening the page does not clear badges; opening the watchlist does.
4. Decided 2026-10-10: Watchlists is one navbar page at `/watchlists`.
5. **Projects and Intentions gain filters**, though they are cards today.

## Related

- [[view-rules]]: §2 replaced, §3 search kept
- [[navigation]]: §2 and §5, revised by §4 here
- [[status-log]]: the events that move watchlist entries
- [[watchlists-and-notifications]]: current Watchlists page, system watchlists,
  badges and external delivery decisions

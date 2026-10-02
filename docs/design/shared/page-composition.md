# Page Composition

[[view-catalog]] says what each page *contains*. This says how many **surfaces**
it is made of, which of them have URLs, and which dissolve into drawers as the
screen shrinks.

> **⚠ Behind [[view-map]] §2 for the document pages.** *My Requests* and
> *Documents* are one page now (*My Documents* for a reader), *Additions* is no
> longer a page — its failures are a status in Documents — and eligibility is
> retired ([[status-model]] §2). The sections below for those pages, and every
> *eligibility* column, predate that and are rewritten in the per-page layout
> pass. [[document-use-cases]] §7 is the current map.

A page is rarely one screen. *Categories* alone is a tree browser, a percentage
editor, a custody panel and a wizard — four jobs, three actors' worth of care,
one sidebar entry. You cannot draw it without deciding that first.

---

## 1. Five kinds of surface

| Kind | What it does | Route | Chrome cost |
|------|--------------|:-----:|-------------|
| **index** | the list or tree the page exists for | the page's own | the record budget |
| **detail** | one record, read-mostly, with its history | `/x/:id` | 6 docked · 0 transient |
| **editor** | changes a set of values; must be saved or discarded | — | 0 — transient |
| **wizard** | multi-step, and creates something that did not exist | its own | replaces the page |
| **dialog** | one decision plus its reason | — | 0 |

**Editor is not detail.** A detail can be left at any moment and nothing is
lost. An editor holds unsaved state, so it must be dismissable only
deliberately — and it is the only surface that can refuse to close.

---

## 2. Rules

1. **One index per page.** A page showing two lists is two pages, or one list
   with a filter. The exception is a page whose *same actor* switches between
   genuinely different scopes. There is none left: *Tasks* and *Schedules*
   were one page with two views, and are two entries since 2026-09-26.
2. **Detail is a route.** It has to be linkable from a notification, a status
   log entry, and another view's cross-reference. `/documents/1234` opens the
   index with that record's detail showing.
3. **Detail docks only at `large`.** A docked panel is 6 points
   ([[view-rules]] §1.2); at `notebook` the sidebar alone can be 4 and the
   filter rail 5, so 6 more does not fit under 18. Everywhere below `large` the
   detail is a drawer, and drawers are free (§1.3 rule 1).
4. **An editor that writes a *set* is modal, never inline.** A sibling set of
   percentages is read and written under a lock ([[intentions]] §1.1) — there
   is no such thing as half-saving it, so there must be no UI that suggests
   there is.
5. **A wizard owns the screen.** It is not a panel and not a step inside a
   table. It has its own route so it survives a reload and can be abandoned
   without ambiguity.
6. **A dialog carries a reason or it is not a dialog.** A confirm with no input
   is a speed bump; the irreversible actions in [[view-rules]] §5 rule 3 all
   take text, and the text becomes the [[status-log]] entry.

---

## 3. The document pages

### My Requests — `/requests`

| Surface | Route | Actor | Notes |
|---------|-------|-------|-------|
| index | `/requests` | reader | one row per request, from the proposal phase on |
| request detail | `/requests/:id` | reader | **transient at every tier**, including `large` |
| propose | `/propose` | reader | wizard: identifier → resolve → **pick the unit** → reason |

The detail is transient even at `large` because a reader's chrome should not
grow a permanent panel for a list they check monthly. The propose wizard is a
route so it can be linked to from anywhere — it is the single entry point for
everything downstream.

> The wizard's third step is where a unit is chosen from the catalog's
> enumeration ([[document-identity]]), and its fourth is `request.reason`. Both
> are load-bearing: without the unit there is no duplicate detection, without
> the reason a curator cannot set priority.

### Documents — `/documents`

| Surface | Route | Actor | Notes |
|---------|-------|-------|-------|
| index | `/documents` | staff+ | |
| iteration detail | `/documents/:id` | staff+ | docked at `large`; every property, every registry, full log |
| relink catalog record | — | staff+ | dialog |

The detail is where [[document-properties]] §7 pays off: no budget, every
readable property with its source and tier, every registry with its age.

### Documents Validations — `/review/documents`

| Surface | Route | Actor | Notes |
|---------|-------|-------|-------|
| index | `/review/documents` | curator | |
| validation detail | `/review/documents/:id` | curator | docked at `large`; **per-defect verdicts** |
| deny · forbid · cancel | — | curator | dialogs — each takes a reason |
| accept ineligibility | — | curator | dialog |

**Approve is inline; everything else is a dialog.** Approving accepts the
outstanding defect set as it stands and needs no input ([[status-model]] §2);
denying, forbidding and cancelling all write reasons a requester will read.

### Digitization Lists Generation — `/lists/new`

| Surface | Route | Actor | Notes |
|---------|-------|-------|-------|
| index + selection | `/lists/new` | dig-curator | the only index with checkboxes |
| generate | `/lists/new/generate` | dig-curator | wizard |
| add to existing list | — | dig-curator | dialog |

The generate wizard: **choose an intention → confirm the target → preview →
create**. The preview step is not optional — it is where *what could not be
filled, per category* is shown, and [[intentions]] §4 requires that before the
list exists rather than after.

### Proposals — `/review/proposals`

| Surface | Route | Actor | Notes |
|---------|-------|-------|-------|
| index | `/review/proposals` | curator | one row per document |
| ask detail | `/review/proposals/:id` | curator | docked at `large`; **every asker, reason and date** |
| approve | — | curator | **editor**, not a confirm — see below |
| decline | — | curator | dialog, reason required |

> **Approve is an editor.** It is where category and priority are set
> ([[view-map]] §2) — the only place a human classifies a request — so it
> cannot be a one-click confirm. It opens pre-filled: category suggested from
> the catalog, priority defaulting to `Normal`, and the reasons visible while
> deciding, since *"needed for the March exhibition"* is what argues for
> anything above `Normal` ([[priority-levels]]).
>
> **Bulk approve applies one category and one priority to everything selected**,
> in the same editor. That is the only way a bulk action can set required fields
> without inventing them per item — and it is why bulk *decline* stays
> forbidden, since one reason across many documents is a different claim than
> one classification across many documents.

### Additions — `/additions`

| Surface | Route | Actor | Notes |
|---------|-------|-------|-------|
| index | `/additions` | admin | grouped by batch |
| addition detail | `/additions/:id` | admin | transient; **raw payload**, failure text, attempts |
| retry · re-ingest · delete | — | admin | dialogs |
| overrule a prohibition | — | admin | dialog, reason required — the heaviest act in the system |

---

## 4. Projects · Categories · Intentions

### Projects — `/projects`

| Surface | Route | Notes |
|---------|-------|-------|
| index | `/projects` | planned and delivered as two columns |
| project detail | `/projects/:id` | its intentions, its funded iterations |
| members | — | editor, modal |
| create / edit | — | editor, modal |

### Categories — `/categories`

The most composite page in the application.

| Surface | Route | Notes |
|---------|-------|-------|
| tree index | `/categories` | the whole tree, with a **distribution selector** at the top |
| category detail | `/categories/:id` | counts, custody, links into *Documents* filtered |
| **percentage editor** | — | **modal**, one sibling set at a time, written under a lock |
| custody grants | — | editor, modal |
| refine a leaf | `/categories/:id/refine` | wizard: create child **and move every document into it** |

Three things this composition is doing on purpose:

- **The distribution selector sits on the tree, not on a distribution page.**
  Percentages are a property of the tree, so you pick which distribution you are
  looking at and the tree shows it — rather than navigating to a distribution
  and being shown a tree anyway.
- **The percentage editor is a sibling set, not a node.** You open it on a
  parent and edit its children together, because changing one child is a
  decision about where the difference comes from ([[intentions]] §1.1). It shows
  the unallocated remainder and refuses to save a set over 100.
- **Refining a leaf is a wizard because it moves data.** Creating a child of a
  category that holds iterations is not an edit, it is a migration
  ([[intentions]] §1.2), and it must show what it is about to move.

### Intentions — `/intentions`

| Surface | Route | Notes |
|---------|-------|-------|
| index | `/intentions` | kind, distribution, target, dates, progress |
| intention detail | `/intentions/:id` | **the distribution resolved down the tree**, effective % per leaf; lists serving it |
| create / edit | — | editor, modal |

The detail's resolved view is the only place `effective(node)` is shown as a
number. It is what makes a recursive distribution comprehensible — *Regional is
4% of the whole* is not derivable by eye from two nested percentages.

---

## 5. Digitization Lists · Tasks

### Digitization Lists — `/lists`

| Surface | Route | Notes |
|---------|-------|-------|
| index of lists | `/lists` | dates, size, attached intentions, capacity |
| list detail | `/lists/:id` | its members; membership edited inline |
| delete | — | dialog, **with consequence preview** |

The delete dialog states what it is about to do: *"returns 214 documents to the
pool; 12 already digitized keep their status; 3 held stay held"*
([[status-model]] §2.6). Deleting a list is the one action that silently
un-schedules other people's work.

### Tasks — `/tasks`

| Surface | Route | Notes |
|---------|-------|-------|
| runs | `/tasks` | the default: running runs on top, then what ran, what it changed, what failed; backs the *Running tasks* indicator |
| schedules | `/schedules` — **its own sidebar entry** | what will run by itself, and when ([[registry-status]] §8) — a timeline over the next 24 h / 7 days / month, then the schedules |
| run detail | `/tasks/:id` | drawer: trigger, items, what it changed, log |

**Two entries, not three tabs** (decided 2026-09-26). *Running* is not a
scope, it is a state — the top of the runs list. Making it a tab would be the
mistake [[view-map]] §1 warns about: a run that finishes would vanish from the
tab you were watching it on. *Schedules* is genuinely different — definitions,
not runs — and the user chose to give it its own sidebar entry rather than a
tab on Tasks: what happened and what will happen are seldom asked in one
sitting, and a route of its own is linkable from a plugin instance.

**Schedules are edited here and only here.** A plugin instance shows its
schedules and links to this view; it does not edit them. Intention repeats
are listed too, so everything that happens by itself is in one place; what a
repeat makes is defined on Intentions.

**Runs are never deleted by hand.** They expire under a retention setting
(runs 90 days, failed and cancelled a year), because history is the record of
what changed the data.

**Reach follows the grant.** `task.read` sees every run and *Schedules*;
`task.read_own` sees the runs its holder started, under *My Tasks*.

---

## 6. Users & Groups · Plugins · Hooks

### Users & Groups — `/access`

| Surface | Route | Notes |
|---------|-------|-------|
| users | `/access` | the default index |
| groups | `/access/groups` | members, categories and projects it grants |
| roles | `/access/roles` | the grant table |
| user detail | `/access/users/:id` | **effective roles with provenance**, effective custody resolved |
| group detail | `/access/groups/:id` | members, and **what membership confers** |
| role editor | — | modal: permission × scope grid ([[permissions]] §2) |
| custody grants | — | editor, modal — also reachable from *Categories* |

Both detail surfaces **resolve rather than list**. The user detail answers *what
can this person actually do and reach*, which is a union over direct grants,
group-inherited roles ([[permissions]] §1) and the category tree — and it shows
each one's origin. The group detail answers the same question from the other
end, so the consequence of adding somebody is visible while adding them.

The **role editor** is the one screen where the model is visible as a model: a
grid of permissions against the four scopes, with impossible cells disabled by
the permission's own declaration — `addition.retry` simply has no `own` column
to tick.

### Plugins — `/plugins`

| Surface | Route | Notes |
|---------|-------|-------|
| index | `/plugins` | installed, enabled, last run |
| plugin detail | `/plugins/:id` | config · **property tiers** · **registry mapping** · **agent name + entry point** · schedule |
| upload / update code | `/plugins/:id/upload` | wizard — validation before activation |
| test run | — | dialog |

The four bolded items are the plugin's contract with the rest of the model:
[[document-properties]] §4, [[registry-status]] §3.2, [[view-map]] §6. This page
is where every `TODO(Plugins)` lands, which is why it is the largest undrawn
surface in the application.

### Hooks — `/hooks`

| Surface | Route | Notes |
|---------|-------|-------|
| subscriptions | `/hooks` | |
| subscription detail | `/hooks/:id` | filters, chain, target |
| execution log | `/hooks/executions` | |
| dead letters | `/hooks/dead-letters` | retry, discard |

---

## 7. Summary

| Page | Surfaces | Routed | Blocked |
|------|:--------:|:------:|:-------:|
| My Requests | 3 | 3 | |
| Documents | 3 | 2 | |
| Documents Validations | 4 | 2 | |
| Dig. Lists Generation | 3 | 2 | |
| Proposals | 4 | 2 | |
| Additions | 4 | 2 | |
| Projects | 4 | 2 | |
| **Categories** | **5** | 3 | |
| Intentions | 3 | 2 | |
| Digitization Lists | 3 | 2 | |
| Tasks | 2 | 2 | |
| Schedules | 1 | 1 | |
| Users & Groups | 7 | 5 | |
| Plugins | 4 | 3 | ⚠️ plugin contract |
| Hooks | 4 | 4 | |

**All fourteen are composable.** *Plugins* is the only one drawn as a shell —
its detail tabs are the plugin contract, and their contents arrive with it.

## Related

- [[view-catalog]] — what each surface contains
- [[view-rules]] — §1.2 the costs §2 rule 3 is derived from, §5 dialogs and reasons
- [[navigation]] — the shell every page hangs in
- [[view-map]] — §1 page vs view vs lens

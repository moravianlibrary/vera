# Intentions and their mix

What VERA is *trying* to digitize, expressed as a page target spread over the
category tree — and the thing list generation aims at.

Three ideas, deliberately separate, which the archived system had partly merged.
What each is responsible for, and is not, is defined in [[concepts]]
(*Category, mix, intention, project*):

| | What it is |
|---|---|
| **Mix** | what share of effort each category deserves — **part of an intention**: its own, or tracked from another intention (§2) |
| **Intention** | a target — *this many pages, in this mix, by this date* |
| **Project** | money and people: who paid, and who may ask under it. Its target is **its intention's** (§3.4) |

A **distribution** is how a mix is stored: a revisioned row of percentages that
the intentions sharing one mix point at. It is backend only — nobody picks,
names or opens a distribution (decided 2026-09-26).

---

## 1. Shares are recursive

The top-level categories split 100%. Each parent's children split **their
parent's** share, recursively, all the way down.

```
Periodicals              40%          → 40% of the target
  ├─ Regional            25%          → 25% of 40%  =  10%
  └─ National            75%          → 75% of 40%  =  30%
Monographs               60%
  └─ …
```

```
effective(node) = share(node) × effective(parent)
effective(root) = share(root)
```

**This corrects [[relationships]] §2**, which said the proportions of one
intention sum to 1. They sum to 1 **per sibling set**. A flat reading makes
*Periodicals 40%* and *Periodicals / Regional 10%* look like overlapping claims
on the same target; recursively they nest, and `Regional` is 4% of the whole.

The recursive form is what makes the tree usable at all: a curator setting
shares inside *Periodicals* never has to know or care what *Monographs* is
getting, and re-balancing one branch cannot silently change another.

### 1.1 Percentages, written as a whole set, under a lock

Shares are stored as **percentages**, and a sibling set sums to 100.

```
category_share
  distribution_id
  category_id
  percentage        numeric   — share of the parent's allocation, 0–100
  UNIQUE (distribution_id, category_id)
```

**Relative weights, normalised on read, are the wrong shape** — and the reason
is worth stating because it is not obvious. With weights `A=1, B=1, C=2`, the
shares are 25 / 25 / 50; raising C to 3 makes them 20 / 20 / 60. The rows for A
and B were not touched, but **what they mean changed**. A curator who set
*Regional* to 25% expects it to still be 25% tomorrow, and under weights there
is no way to promise that — every edit anywhere in a sibling set silently
re-prices every other member of it.

A percentage is a commitment. It has to be storable as one.

**The write unit is the sibling set, not the row.** You cannot set one child's
percentage in isolation without deciding where the difference comes from, so the
editor submits the whole set and the whole set is validated:

- the set is read and written **under a lock on the distribution**
  (`SELECT … FOR UPDATE`), so two curators cannot each write a set that was
  valid against a version the other has already replaced
- a distribution-wide lock rather than a per-sibling-set one, because
  distributions are edited rarely and read constantly; the contention does not
  justify the subtlety
- the sum is checked inside the transaction, never in the client

### 1.1.1 When the tree changes underneath

A sibling set that summed to 100 stops doing so the moment a category is added
or removed. Nothing silently rebalances:

| Event | Result |
|-------|--------|
| a category is created | it gets **0%** — it cannot take from allocations somebody already made |
| a category is removed | its share becomes **unallocated**; the set now sums to less than 100 |

An incomplete set is **flagged, not corrected**. The mix editor shows
*"Periodicals: 8% unallocated, 1 category with no share"*, and generation
allocates only what is allocated — 92% of the parent's share — and **reports the
rest as unallocated** rather than scaling the remainder up to fill it.

Scaling up would be the same silent re-pricing weights were rejected for. A
mix that is 8% undecided should produce a list that is 8% short and says so.

### 1.2 Documents live on leaves only

`iteration.category_id` must reference a **leaf**. Internal nodes classify
nothing; they exist to hold structure and to split a share among their children.

This removes a problem rather than creating one. If a node could hold documents
*and* have children, its share would have to split between its own documents and
its subtree — an implicit bucket in every set, which is either invisible (and
silently excludes those documents from generation) or visible (and clutters
every distribution with a row meaning "this category, but not really"). Leaves
only, and the recursion is clean: every percentage divides among children, all
the way down, and documents sit at the bottom.

> Not expressible as a column constraint — *is a leaf* is a statement about
> other rows. It is a trigger or an application invariant, and it needs to be
> one of those rather than a convention, because the failure is silent.

**Custody is unaffected.** It still attaches at any node and inherits downward
([[relationships]] §5.2) — a curator holding *Periodicals* has custody of every
leaf beneath it. Custody is about people and applies to subtrees; classification
is about documents and applies to leaves. Different questions, same tree.

#### A leaf that gains a child

The one thing this rule makes awkward, so it is decided rather than discovered:
**a category holding iterations cannot gain children** while it still holds
them. Refining *Periodicals / Regional* into *Moravian* and *Bohemian* means its
existing documents have to go somewhere first.

The editor offers the obvious path as one action — **create the child and move
every document into it** — which is almost always what is meant, and leaves the
distribution valid: the new child takes 100% of its parent's share, which is
exactly what the parent had.

Rejecting the edit outright would be worse: a curator refining a tree that has
grown too coarse is doing the right thing, and the model should not make it a
migration.

---

## 2. A mix is the intention's own, or tracked from another

> Re-decided with the user on 2026-09-26. This replaces named, pickable
> distributions.

An intention's mix is **its own**, or it **tracks another intention's** —
Overall's, most often. *"Use the percentages from that other intention"* means
exactly that: this intention tracks that one.

```
intention
  tracks_mix_of    → intention  null = its own mix   — NO CHAINS: the one tracked has its own
  distribution_id  → distribution                    — the stored mix, shared by every tracker
```

**No chains.** An intention cannot track one that is itself tracking — the mix
always comes from an intention that owns it, one step away, so nobody has to
follow a path to learn where a percentage comes from.

**Editing a shared mix says whom it reaches first** (§2.3).

**Why the distribution stays underneath.** Mixes change, and history must not:
a list generated last spring has to say which percentages it was generated
against. The distribution is **revisioned**, and provenance names the
revision (§5). That is also why tracking is not a copy — a tracker follows the
owner's edits, and its history follows the revisions.

### 2.1 Choosing the mix

Designed 2026-10-01. On the intention's form (new or edit), one field:

| Mix | Means |
|---|---|
| **Track** *[intention]* | the default for a new intention, set to **Overall**. The picker offers only intentions that **own** their mix, so a chain cannot be picked |
| **Own mix, copied from** *[intention]* | a copy of that intention's mix as it is now, then edited on its own. Copying from Overall is the usual start |

Overall's form has no such field: it always owns its mix (§3.1).

### 2.2 Switching

| From → to | What happens |
|---|---|
| **tracking → own** (*Detach*) | the intention gets a copy of the mix it tracked, as it is at that moment. Nothing changes for anyone else |
| **own → tracking** | its own mix is dropped from use (its revisions stay, for provenance). The form shows the new mix's percentages beside the old, first |
| **own → tracking, while others track it** | it would make a chain. The form lists them and offers to **move them with it**: they then track the same intention it does. Without that, the switch cannot be saved |
| **the tracked intention is archived or ends** | nothing: its trackers keep tracking it, since the mix is still there |

### 2.3 Editing a shared mix

> Re-decided with the user on 2026-10-07. This replaces "unticked trackers
> keep the old mix together, under the longest tracker" (2026-10-01): it moved
> ownership without anybody choosing it, and made the mix an entity of its own.

Percentages are edited on **the intention that owns the mix** (§2.4). Editing
changes the mix for **every intention tracking it** — that is what tracking
means. When others track it, *Save* opens a dialog first:

```
Change the mix of Overall?

These intentions track it and change with it:
  NDK Periodika — 2026         target · running      [ ] Keep the old mix
  Regional catch-up            target · running      [x] Keep the old mix
  Monthly output — July        tracking · upcoming   [ ] Keep the old mix
  Maps watch                   tracking · archived   [ ] Keep the old mix

Regional catch-up will be detached onto its own copy of the mix as it is
now, before the change.

            [Cancel]  [Save for Overall and 3 more]
```

- **Every tracker is listed**, archived and ended ones too, since editing
  changes how their history reads against the mix. A window that is closed
  counts against the mix as it was (§6), so the edit never rewrites a closed
  result.
- **Keep the old mix** is unticked by default. Ticking it **detaches** that
  intention first (§2.2): it gets its own copy of the mix as it is now, and
  owns it. Each detached intention owns its own copy; none tracks another,
  and nothing changes owner.
- **Opening a tracker's mix** shows its owner's mix, with a line:
  *NDK Periodika tracks Overall. Editing changes Overall and 4 more.* Two
  buttons: **Edit Overall's mix** (the dialog above, on save), and
  **Detach NDK Periodika** (§2.2, then edit its own copy).
- **Nobody tracks it**: no dialog, *Save* saves.

### 2.4 The mix is edited on its intention

> Re-decided with the user on 2026-10-07. This replaces editing on
> Categories with an intention picked in its topbar (`categories.html?i=ID`,
> 2026-09-26): the shares are the intention's, so they are edited where the
> intention is ([[concepts]], *Category, mix, intention, project*).

An intention's **Mix** shows the category tree with that intention's shares,
and is where they are edited. It opens from the intention's card on
Intentions (*Edit mix*), as the intention's own page:
`/intentions/ID/mix`.

- **One sibling set at a time**, saved as a set under a lock (§1.1), with
  the unallocated remainder and zero-share children shown (§1.1.1).
- **A tracker** shows its owner's mix and the line of §2.3.
- **A scoped intention** shows its subtree as *Mix within Periodicals*
  (§3.2). Outside the subtree the tree is dimmed and its shares are neither
  shown nor editable: the scope does not use them. A copy still copies the
  whole tree, so widening the scope later finds shares already there.
- **Intended vs actual** compares with the intention's output, in its scope
  and window.

**Categories shows no mix but Overall's, read-only.** Its *Show* may display
Overall's effective share on each row, with a link to *Edit Overall's mix*.
The tree, its classification counts and its custody are what Categories is
for; a category has no share of its own.

### 2.5 Who may

All of it is `intention.edit` on the intention being changed: choosing,
switching, detaching, editing percentages. Editing an owner's mix needs
`intention.edit` on the owner only. Its trackers change with it, which the
dialog says. **Keeping the old mix** for a tracker needs `intention.edit` on
that tracker, since it detaches it; without it the box is not offered.
Moving trackers with an intention that switches to tracking (§2.2) needs
`intention.edit` on each of them.

**Overall's mix needs `intention.edit_overall`** (decided 2026-10-01), held
by admin only. A dig-curator can still detach their own intentions from
Overall and edit those copies.

---

## 3. An intention is a scope and an objective

> Re-decided with the user on 2026-09-26. This replaces the `kind` enum
> (Project | Target | Overall) and the hand-attached lists of the earlier draft.

```
intention
  id, name, description
  project_id       → project  null  UNIQUE    — its project's intention (§3.4): funding and window read from it
  funding_filter   any | none | → project     — scope
  scope_category   → category  null = all     — scope: ONE node, with its subtree
  tracks_mix_of    → intention  null          — objective: the mix, tracked (§2)
  distribution_id  → distribution             — objective: the mix, as stored
  target_pages     int  null                  — objective: none = it only tracks the mix
  counts_from      date                       — LOCKED once created; may be in the future. Null for a project's intention
  ends_on          date null                  — none = open-ended. Null for a project's intention
  is_overall       bool                       — exactly one, protected
  template_id      → intention_template null  — the repeat that made it
  archived_at, archived_by                    — visibility only
  (revision history)
```

**Nothing is attached to an intention.** An iteration counts towards every
intention whose scope it matches — funding and category subtree — so
intentions are overlapping measures of the work, not containers that own it.
A page funded by a grant counts towards that grant's intention, a regional
target and the Overall mix at once. Figures of different intentions overlap
and are never added together.

**Every intention is time-based.** `counts_from` is required and fixed once
created, so nobody quietly recounts history by moving it; to count from
another date, make a new intention from the old one. The end is optional.
A project's intention is the one exception: its window is the project's
period, and follows it (§3.4).
What differs is the target: with one, the intention has progress (and pace,
when it also has an end); without one it **tracks** the mix. The Intentions
page groups them that way — *Targets* and *Tracking* — derived, not stored.

Any intention may count one project's funding. **The project's own
intention** is the one made with the project, and the only one that holds
the project's target (§3.4).

### 3.1 The Overall intention is the authority

**Exactly one, always.** Its scope is fixed to everything, it has no target
and no end, and `counts_from` is the reporting baseline. It is:

- **the default mix for generation** — when the dig-curator picks no other
- **what output is measured against** — *we are 12 points over-weighted on
  periodicals*

It exists from installation, cannot be archived or deleted, and **owns its
mix** — it never tracks another. Its mix is edited like any intention's
(`intention.edit`), and since most intentions track it, the dialog of §2 is
at its longest here. Editing it needs `intention.edit_overall`, admin only
(§2.5).

### 3.2 Scope and the mix

One category node per intention, with its subtree. Inside it the mix is read
**from that node down**: the node is 100%, its children split it by the
mix's shares, recursively. *NDK Periodika* scoped to Periodicals
applies its whole target inside Periodicals; the 20% Periodicals gets
globally does not shrink it. That is a change of reference frame, shown as
*Mix within Periodicals* — not a rescale, and unallocated shares inside the
subtree stay unallocated.

Several unrelated nodes would need their own top-level allocation
(*Periodicals 60 · Maps 30 · 10 unallocated*) — a second allocation layer.
Deferred until librarians need it.

### 3.3 Repeats

A repeat is a **template** that makes concrete occurrences — each its own
intention with its own window, target and progress. Nothing is reset.
Editing the template changes the occurrences still to come; an existing one
is edited on its own. *Archive the previous one* changes visibility only,
never counting. Needs `intention.repeat`, held by admin by default.

```
intention_template
  id, name_pattern ("… — {period}"), every (week | month | quarter)
  funding_filter, scope_category, tracks_mix_of | own mix, target_pages
  archive_previous  bool
```

### 3.4 A project's intention

> Decided with the user on 2026-10-07. A project had a target, planned and
> delivered figures and a pace of its own, beside an intention counting the
> same funding: two verdicts on one grant that could disagree. Now only an
> intention has a target or pace ([[concepts]]).

**Every project has exactly one intention of its own**, made with it:

| | Of a project's intention |
|---|---|
| **scope** | funding = that project, fixed; the category scope is its own (whole tree by default) |
| **window** | the project's `starts` / `ends`, **read from the project, not stored**. Changing the project's dates moves the window and recalculates the intention, and the project form shows the consequence first (*Planned 4,280 → 3,910*, §6) |
| **target** | the project's target pages: entered on the project form, stored here. None = the intention tracks the mix |
| **mix** | tracks Overall when made; edited like any intention's (§2) |
| **name** | the project's, and follows it |

- **It lives and dies with the project.** It is made when the project is,
  listed on Intentions once the project is **Approved**, archived when the
  project is **Rejected**, and deleted with it (only an empty project is
  deleted, [[projects]] §3). It cannot be archived, deleted or detached from
  its project on its own.
- **Who edits what.** Its target and window are the project's, edited on the
  project form under `project.edit@managed`. Its mix and category scope are
  the intention's, under `intention.edit`.
- **Pace only while the project is Approved and running**, as before
  ([[projects]] §1).
- **Other intentions may count the same funding**, with windows of their
  own: *NDK Periodika — Q3* counts the NDK grant for one quarter. They are
  measures beside it; only the project's own one is shown on Projects.


---

## 4. What generation does

**Generation is done by plugins, not by VERA.** A *list generator* is a plugin
kind of its own, in two classes:

| Class | Chooses by | Same input, same output? |
|---|---|---|
| **rule-based** | a declared ordering and the shares below | **yes** — deterministic |
| **AI-based** | a model's judgement over the pool | not guaranteed — which is why every pick carries its reason |

An installation may configure several, of either class, or none. **With none,
there is no *Generate* button** — absent, not disabled ([[view-rules]] §5
rule 1) — and lists are built by hand, which is always possible.

### 4.1 What a generator is given

| Input | | If left out |
|---|---|---|
| **pages** | the target page count | — required |
| **categories** | which categories to draw from | **all** of them |
| **shape by** | **one** intention — it supplies the scope (the pool is narrowed to its funding and subtree) and the mix | **the Overall intention** (§3.1) — there is always one |
| **allocation** | pages per category, fixed in advance — a *correcting run* from a tracking intention out of band, shown and accepted before generating | none — the mix decides |
| **current members** | the list's documents so far, when editing | — a new list has none |

Current members are **fixed**: generating on an existing list tops it up
towards *pages*, it never swaps out what is already there. **Percentages
always come from exactly one intention** — the one shaped by, Overall unless
another is picked (starting from an intention's card preselects it) — and a
generator never invents its own weighting, whatever its class. What the list
then counts towards is derived from what ends up on it (§5). *Furthest behind*
may be offered as a labelled suggestion, never as the default: an undated
intention has no pace, and overlapping intentions describe one shortage several
times. The target per category is its share of the pages, read inside the
intention's scope (§3.2):

```
target(category) = pages × effective_within_scope(category)
```

and choosing *categories* as well narrows the pool without changing the
shares: a share falling on a category left out is **shortfall**, handled like
any other (rule 2 below) and reported.

### 4.2 What every generator must do

VERA enforces these on the result, whichever class produced it — an AI
generator is held to the same contract as a rule-based one, and a result that
breaks it is rejected rather than trimmed:

1. **Draw only from the pool** — iterations that pass the gates
   ([[status-model]] §3) and are not already listed. Page counts come from
   `effective(page_count)` ([[document-properties]] §8).
2. **Report shortfall.** A category that cannot be filled is reported, with
   why, per category. A list silently 8% short of its own plan is worse than
   one that says so. The remainder is re-spread across siblings that still
   have supply, recursively.
3. **0% means excluded.** A category at 0% is not drawn from, even when it has
   supply and even when siblings fall short — shortfall redistributes among
   siblings with a **non-zero** share, never into one somebody deliberately
   zeroed.
4. **Never split a document.** Page counts are lumpy, so a target of 10,000
   pages will not be hit exactly. The tolerance is configurable per generator
   (the archived system's `targetPageCountThreshold`), and the overshoot or
   undershoot is reported, never hidden.
5. **Give a reason for every pick.** For a rule-based generator it is the rule
   — *High priority, asked 12 Mar*; for an AI one it is the model's own
   sentence. A pick nobody can explain cannot be reviewed, and reviewing it is
   the dig-curator's whole job at this point.

**The reference rule-based generator** orders within a category by priority
([[priority-levels]]), then by age of request — the fair tie-break, without
which a run is not deterministic.

### 4.3 What it produces

A **draft**, never a list. The result pre-fills the editor's left pane
([[view-map]] §2.4) with each pick marked *generated* and its reason on the
row, the shortfall report in the header, and nothing saved until the
dig-curator saves it. Generating is a starting point, not a verdict.

The [[status-log]] records which generator, which version and which inputs
produced the draft — for an AI generator the only way to say afterwards why a
list looks the way it does.

### 4.4 Where a generation starts

| From | Pre-filled | |
|---|---|---|
| the list editor, *Generate…* | nothing — Overall shapes it | the ordinary case |
| an intention's card, *Generate a list* | shape by that intention | |
| a **tracking** card out of the ±5 band, *Generate correcting list…* | an allocation per category that brings output back towards the mix; pages fixed | a supply the pool cannot cover stays short |
| a **target** card behind pace, *Generate catch-up list…* | the pages it is short, shaped by that intention (decided 2026-09-26) | |

---

## 5. Intention ↔ list: derived, never attached

What a list **counts towards is worked out**, not picked: from its members and
its start date (§6). The list editor shows it read-only, as pages per
intention — *House mix 3,452 · Regional catch-up 1,740* — because with
funding and category scopes only part of a list may qualify. The figures
overlap and are never totalled.

What a list was **generated with is provenance**, a separate fact:

```
list_generation
  list_id, intention_id, intention_revision
  distribution_id, distribution_revision, resolved_allocation
  pages_requested, constraints, generator, generator_version, at
```

The allocation snapshot matters because distributions are shared and change:
a link to the current one cannot explain yesterday's list. A hand-built list
has none. There is no *authoritative intention* any more — nothing about
counting depends on how a list was made.

The editor warns when the two disagree: a list generated with *NDK Q3* that
starts before 1 July does not count towards it.

> Supersedes the earlier `list_intentions` M:N and the open question on
> auto-attach — the user decided intentions should assign themselves.

---

## 6. Progress against an intention

| | Means |
|---|---|
| **planned** | matching iterations on lists **that still exist** whose **start** falls in the window — a deleted list's items stop counting, in Projects as here (decided 2026-09-26) |
| **delivered** | those of them digitized **in the window** — plan completion, a part of planned |
| **output** | every matching iteration digitized in the window, whenever it was planned |

Windows are start-inclusive, end-exclusive: `[counts_from, ends_on + 1 day)`,
so adjacent monthly occurrences never share an event. A list's start date is
its planning date; a per-item planning date can come later if lists grow long.

Target cards use **planned / delivered** — *did we do what we planned?* The
mix is measured on **output** — *what did we actually produce?* — against the
intended shares, in points, with **±5 points** as display tolerance (not a
change to the mix). Output in a 0% category is flagged as *Excluded category
used* whatever its size.

Rules:
- an iteration counts once per intention, however many memberships it had
- a cancelled, undelivered item stops counting as planned; delivered work
  keeps its attribution
- planned uses the estimated page count, delivered the actual one; they may
  differ without error
- missing dates or page counts are shown as *not counted*, never dropped
  silently
- **editing a scope or window recalculates the whole intention**, and the
  editor shows the consequence first (*Planned 4,280 → 8,839*). Revision
  history keeps the old definition; for closed periods a dated result
  snapshot is kept, and archiving does not imply freezing
- the same holds for re-categorisation, re-funding and mix edits:
  past attribution uses the historical facts, and distributions are
  versioned

[[relationships]] §5.3 warns that a project's planned pages and its actual
documents must never be summed together. The same holds here, one level down.

---

## Related

- [[relationships]] — §2 the cardinalities, §5.2 custody on the same tree
- [[view-map]] — §2.4 Digitization Lists, whose editor consumes all of this
- [[document-properties]] — §8 where the page counts come from
- [[priority-levels]] — the ordering inside a category
- [[status-model]] — §3 the gates supply must pass

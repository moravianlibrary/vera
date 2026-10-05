# Status Model

Answers the open question in `docs/demos/rework.md` § Enums: *one big enum, or
several?*

**Four axes, one displayed value.** The four are independent, each with its own
owner and its own vocabulary. Three are stored as columns; validation is itself
derived, from a defect set and an append-only record of who accepted what (§2).
The displayed badge is derived from all four by a precedence rule, and is never
a source of truth.

This also closes the status-vocabulary conflict left open in [[view-rules]] §7
and [[view-map]] §5.

---

## 1. Why it cannot be one enum

The proof is already in the rework note:

> *NotEligible — can be still proposal approved and / or review approved. If
> review approved, then it says something like not eligible but approved.*

Three facts are true of that item at once — the curator approved the proposal,
a check failed, a curator accepted the failure anyway. A single-valued enum can
hold one of them. Every attempt to hold all three produces compound values
(`NotEligibleButReviewApproved`, `ForbiddenOverruled`), and the number of them
is the product of the axes, not the sum.

`ForbiddenOverruled` is the same symptom already visible in the list: it is not
a state, it is *Forbidden plus an override*.

So: store the axes, derive the badge.

> The quote's own vocabulary did not survive — *not eligible* is no longer a
> value, because eligibility turned out to be three things under one name
> (§2, *What eligibility used to hold*). The argument did. The same item today
> is *approved as a rescan*, *a defect accepted*, *a restriction overruled* —
> still three facts, still three places.

---

## 2. The four axes

| Axis | Question it answers | Lives on | Set by |
|------|--------------------|----------|--------|
| **Decision** | should this be digitized at all? | Request | curator — judgement |
| **Restriction** | is this *forbidden*? | Request → Iteration | **rules only** (plugins) — never a person; overruled by admin |
| **Validation** | is the metadata good enough to digitize against? | Iteration | curator — judgement |
| **Progress** | where is it physically? | Iteration | system + dig-curator |

Two are human, two are machine. Two sit on the request, two on the iteration —
consistent with [[relationships]] §6.

### Decision — `request.decision`

| Value | Meaning | Set by |
|-------|---------|--------|
| `Pending` | waiting for a curator | — |
| `Approved` | may enter the pipeline | curator |
| `Denied` | rejected, with reason | curator |
| `Withdrawn` | the requester took it back — **only while Pending** | requester |
| `Duplicate` | somebody is already digitizing this — the request tracks that work instead | **the system** |

`Withdrawn` is new. Nothing in the current list covers *stopped, but not by a
refusal*, so a user who asks for the wrong volume has no way to take it back.
It exists only **before** a decision (decided 2026-09-26): once approved, work
is stopped by cancelling the iteration (§2.5), never by withdrawing the ask.

`Duplicate` is also new, and is the only decision **no person makes**. It is
machine-set at proposal time, and it is a decision rather than a restriction
because it resolves the request outright — the request will never
produce its own iteration — instead of standing in the way of one. See §2.7.

### Restriction — `iteration.restriction` (and `request.restriction` pre-ingest)

| Value | Meaning |
|-------|---------|
| `null` | nothing forbids it |
| `{ rule, public_text, internal_text }` | a rule says **never** — copyright, embargo, physical condition |

Plus `restriction_override`, separate and nullable — `null` or
`{ actor, at, note }`, set by an admin under `restriction.overrule@any`
([[permissions]] §3). *A rule said never and I am saying anyway.* It is
`any`-only on purpose: a custody-scoped overrule would let a curator quietly
lift prohibitions inside their own subtree, which is exactly the act that
should require somebody outside it.

The override is a second field rather than a cleared first one, so an
overruled prohibition stays a different record from one that never existed —
`ForbiddenOverruled` from the flat list becomes *restriction + override*, and
only the two-field form can still be audited.

A restriction is evaluated on whatever object exists at the time. A rule can
forbid a proposal before any iteration is created; the iteration inherits the
verdict at ingest and re-evaluates it. **A re-check that no longer finds it
clears it**, and the clearing is logged (decided 2026-09-30). **Only rules
forbid** — no person sets a restriction (decided 2026-09-26); a curator who
sees one can only message an admin. Until the checks have run at all,
`request.checked_at` is null — the one thing an automatic approval waits for
(§2.8).

### What eligibility used to hold

This axis was called **eligibility** — `Unchecked · Eligible · NotEligible ·
Forbidden`, with an `Accepted` override for `NotEligible`. It was retired
because it held **three different kinds of finding** under one name, and only
one of them was a verdict:

| A check finds | Example | It is | Now |
|---|---|---|---|
| **a prohibition** | copyright, embargo, too fragile | *never*, unless somebody above says otherwise | the restriction, above |
| **a defect** | no page count, an estimated page count, **no catalog record** | *not good enough yet* | a defect in the validation set, below |
| **an existing copy** | *Kramerius: Published*, VERA's own 2019 scan | *a fact* the decision should see | on the request — *Existing copy*, below |

*Missing data* was always a defect, and the defect set already handled it
better — a key per finding, an approval that survives a re-check finding the
same thing. *Already digitized* was never an obstacle at all, only news for
whoever decides. And the `Accepted` override on it turned out to be the same
act as the separate *allow a new iteration* — two permissions for one decision,
*do it again anyway*, which now is one (§2.7).

### Existing copy — a fact on the request, not a verdict

```
request.existing_copies = [ { source, state, link, seen_at } ]   — observed
request.rescan          = false | true                           — decided
```

`source` is a registry — Kramerius, RDCZ ([[registry-status]]) — or VERA
itself, when an earlier iteration of the same document was digitized. The same
check run that evaluates restrictions observes copies, at proposal time and
again at ingest; which registry states count as a copy is per-registry policy
([[registry-status]] §9).

**A copy blocks nothing.** It is not a gate (§3) and never takes the badge
(§4). It is shown to whoever decides, and **approving a request that carries
one is approving a rescan**: `rescan = true`, recorded as such in the
[[status-log]]. That is an ordinary curator decision under `request.decide`,
scoped through proposal custody like any other approval ([[permissions]] §3) —
the copy is an input to *should this
be digitized*, not a separate power. What makes it special is only that no
shortcut may make it (§2.8).

### Validation — derived from defects and approvals

| Value | Meaning |
|-------|---------|
| `NotRequired` | no outstanding defect |
| `Needed` | a defect nobody has ruled on |
| `Approved` | every outstanding defect has been accepted by a curator |
| `Denied` | an outstanding defect was ruled substantial |

**A defect** is anything that makes the metadata not good enough to digitize
against — an estimated page count, a malformed date, missing data, and an
identifier that resolves to **no catalog record**. The last is fixed by
relinking (`iteration.relink`), and the re-check that follows takes it out of
`D` on its own. It is a defect and not an ingest failure because ingest
*finished* — it simply found nothing; an adapter that errors is
`IngestFailed` (below).

Same two words as *Decision*, different axis, and that is the resolution of the
concern in the rework note. `Approved` on the decision axis means *this item is
worth digitizing*; `Approved` here means *this metadata defect is tolerable*.
They do not need different names — they need different columns. The **labels**
differ in the UI (§4), the stored values need not.

Unlike the other three axes, **validation is not a stored column.** An approval
is a verdict on *a specific set of defects*, not on the iteration, so storing
one value loses what was approved the moment the checks run again.

**`iteration_defects`** — the current findings, rewritten on every check run:

| Column | |
|--------|--|
| `iteration_id` | |
| `defect_key` | stable identity, see below |
| `public_text` / `internal_text` | the two texts of [[view-rules]] §4.3 |
| `first_seen_at` | |

**`validation_verdicts`** — append-only, never rewritten:

| Column | |
|--------|--|
| `iteration_id` | |
| `defect_keys[]` | exactly what this verdict covers |
| `verdict` | `Approved` \| `Denied` |
| `actor`, `at`, `note` | who, when, why |

A curator accepts the outstanding defects **one by one, or all at once** for an
item (decided 2026-09-26): each verdict row covers exactly the keys accepted in
that act.

Validation state is then a comparison of the current defect set **D** against
the approved keys **A** and denied keys **N**:

| Condition | Validation |
|-----------|-----------|
| `D` empty | `NotRequired` |
| `D ∩ N ≠ ∅` | `Denied` |
| `D ⊆ A` | `Approved` |
| otherwise | `Needed` — and **`D \ A`** is exactly what the curator is shown |

Which gives the four behaviours asked for, without any of them being a rule:

- a re-check finding **the same or fewer** defects keeps `D ⊆ A` true — still
  approved, nobody is disturbed
- a re-check finding **none** empties `D` — `Approved` becomes `NotRequired` on
  its own
- a re-check finding **something new** breaks `D ⊆ A` — back to `Needed`, and
  the curator sees only the new defect, not the ones already accepted
- **who approved what, and when** is the verdict table, and it is a genuine
  snapshot because it names defect keys rather than a moment in time

A denial lapses if its defect disappears — if the metadata is repaired, `D ∩ N`
empties and the iteration is no longer denied. That is correct: the verdict was
about the defect, and the defect is gone.

#### Defect identity

Everything above rests on recognising *the same defect* across runs. The
working proposal:

```
defect_key = (plugin_instance_id, rule_code, subject)
```

`subject` is the locus — the field, the page, the linked record. Without it,
two missing-page-number findings collapse into one key and approving one
silently approves the other. The **value is deliberately not part of the key**:
a malformed date edited from `19xx` to `189x` and still malformed is the same
defect under review, and including the value would re-raise every accepted
defect on every metadata edit.

> `TODO(Plugins):` settle `defect_key` when the plugin model is designed. A
> plugin decides what it reports, so it is the plugin contract that has to
> guarantee a stable `rule_code` and a `subject` precise enough to separate two
> findings of the same kind — a plugin that renumbers its rules between
> versions silently invalidates every approval made against it. This is the
> load-bearing decision of the validation axis: get it wrong in one direction
> and approvals leak between defects, in the other and the same defect
> re-raises itself forever.

#### What triggers a re-check

Three things, and the third is what makes catalog drift a solved problem rather
than a separate mechanism:

| Trigger | When |
|---------|------|
| ingest | once, at `Enqueued` |
| a scheduled plugin run | on each adapter's own cadence ([[registry-status]] §8) |
| **the catalog record changing** | on the sync that observes the change |

**A catalog record that changes upstream re-runs the checks against the new
record.** Nothing else is needed: the new `D` is compared against the same `A`,
and the four outcomes above already say what happens. A change that introduces
a problem breaks `D ⊆ A` and returns the iteration to `Needed`, showing the
curator only what is new. A change that repairs one empties it out of `D` and
the verdict lapses on its own. A change that touches nothing the rules care
about leaves `D` identical and disturbs nobody.

This is why the verdict table stores **defect keys and not a timestamp**. An
approval recorded as *"approved at 14:02"* cannot survive the record being
edited at 14:03 — there is no way to tell whether the thing approved is still
the thing present. An approval recorded as *"approved these defects"* answers
that by comparison, every time, for free.

> The residue is the `TODO(Plugins)` above, not a gap here: since `value` is
> not part of `defect_key`, a catalog edit that makes an accepted defect
> **worse** without changing its key keeps the acceptance. That is the
> deliberate trade — the alternative re-raises every accepted defect on every
> metadata edit — but it is the failure mode to watch when the plugin contract
> is written.

#### Checks after digitization

Checks run at any time, including on `Digitized` and `Published` iterations. A
new defect found then returns validation to `Needed` — but it cannot and must
not move progress backwards. The gates in §3 govern the `Enqueued → Ready`
transition only; nothing downstream re-enters them.

This is the one place the single-badge rule of §4 breaks: precedence would
render such an item *Review needed* and hide that it is published. So **once
`progress ≥ Digitized`, the badge shows progress and validation is carried as a
second marker** — the status footnote from `notes.md` rather than the badge:
*Published · review needed*. Everywhere earlier, the precedence table holds.

### Progress — `iteration.progress`

| Value | Meaning |
|-------|---------|
| `Enqueued` | ingesting — fetching catalog data, running checks |
| `IngestFailed` | ingest could not complete — **stalled**, an admin retries |
| `Ready` | **every gate passed**, not on a list — waiting to be digitized |
| `Planned` | on a list dated in the future |
| `InProgress` | on a list being executed now |
| `Digitized` | scanning finished — written when its list is marked **Done** |
| `Published` | available — written when a curator sets the link where it is (`iteration.publish`) |

These form a **sequence**, and that matters: "has this got past X" is a
comparison rather than a set membership test, and the badge rule in §4 depends
on being able to ask it.

`IngestFailed` is a genuine position — the item did not get out of ingest, it
sits at a known point, and it is *somebody's job*: an admin's, in Documents
filtered to *Could not be added* ([[view-map]] §2), and a retry returns it to
`Enqueued`.

**Cancellation is not in this list.** It is not a position — see §2.5.

**Yes — `Ready` replaces `Planned` as the name for "gates passed, waiting".**
`Planned` is then free for exactly what the rework note proposes: a list built
ahead of time with a date on it. That makes three of these derivable rather
than set:

```
list_id is null ∧ gates pass     → Ready
list_id is null ∧ a gate fails   → Enqueued      (decided 2026-09-30)
list.starts_on > today           → Planned
otherwise                        → InProgress
```

Deriving them means a list cannot be created without its documents changing
state, and a list cannot be dropped leaving documents stranded in `InProgress`.
The derivation applies only while nothing later has been recorded — `Digitized`
and `Published` are written, and a written value wins.

**`Ready` is never a name for something held.** An item not on a list that
fails a gate — a new defect, a rule forbidding it, returned from a deleted list
still defective — is `Enqueued`, and becomes `Ready` again the moment the gate
clears. An item **on a list** that picks up a blocker stays on it, **flagged**
on the list and in the editor; the dig-curator decides whether to take it off
(decided 2026-09-26).

**The two written values have movers** (decided 2026-09-26):

| Value | Written by |
|---|---|
| `Digitized` | the dig-curator marking the list **Done** — every member not marked *could not be digitized* (§2.5) |
| `Published` | a curator setting the link where it is available, `iteration.publish@custody`; changing the link later keeps it Published |

`Superseded` is deliberately **not** a value: an iteration is superseded when a
later iteration of the same document exists. That is a query, not a state.

**`QualityCheck` is deliberately left out.** Quality control does happen — it
sits between scanning and publication — but the test for a progress value is
*can anything set it*. Every other value here has a setter: the ingest job, the
list date, the dig-curator, the registry link appearing. QC happens inside the
scanning operation and nothing reports it back, so the value would be
unreachable, and an unreachable value in a filter dropdown is worse than a
missing one. Add it the day a plugin or a hook can report it; until then
`Digitized → Published` is the honest pair, and QC is outside VERA's
observation rather than absent from reality.

### 2.5 Cancellation — a suspension, not a position

Cancelling stops work; it does not move the item. So it is **not a progress
value** but a nullable field beside one — the same shape as
`restriction_override` above, and for the same reason: it must not destroy the
verdict it overrides.

```
iteration.cancellation = null
                       | { cause, actor, at, public_text, internal_text }
```

| `cause` | Meaning | Set by |
|---------|---------|--------|
| `Decided` | a person chose not to continue | curator, dig-curator, admin |
| `NotDigitizable` | attempted and could not be done — not on the shelf, binding will not open, too fragile | the dig-curator, per item on its list, with a message (decided 2026-09-30) |

**Why not a progress value.** If a cancelled item can be resumed, resumption
has to land somewhere, and where depends on where it was. Writing `Cancelled`
into `progress` overwrites precisely the fact needed to resume it. Keeping
progress intact and flagging it beside means **resuming is just clearing the
flag** — no stored resume target, no transition table:

| Cancelled while | On resume | Because |
|-----------------|-----------|---------|
| `Enqueued` | back to `Enqueued`, moves on when the gates pass | nothing skipped |
| `Ready` | `Ready` | unchanged |
| `Planned` / `InProgress` | **`Ready`** | cancelling removes it from its list, so `list_id` is null and §2 derives `Ready` |

The third row is the case that was asked for — *Cancelled → Ready* — and it
falls out of the derivation already written rather than needing a rule of its
own. An item that was mid-list comes back as available work, not as something
still attached to a list that has moved on without it.

`Failed` is folded in here as `NotDigitizable`. A failed scan attempt and a
human stop are the same state — work is not proceeding, with a reason — and
the only thing that differed was the justification. It is resumable on the same
terms: the volume is found, the flag clears, and it is `Ready` to be listed
again.

Cancellation is available **until the item is digitized**, from two places: the
iteration, and the digitization list an item is being pulled out of. The reason
text is required, public and internal ([[view-rules]] §4.3), because this is
the state a requester will always ask about.

**`iteration.cancel` and `iteration.resume` are separately grantable**
([[permissions]] §3) — stopping work somebody else scheduled and restarting work
somebody deliberately stopped are different powers, even though the shipped
roles happen to hold both. A deployment wanting an operator who can halt a
runaway batch without being able to restart anything can express that.

`NotDigitizable` is set on the list, per item, by the dig-curator (`list.edit`),
with the message the requester reads. It is what the scanning room reports
back; marking the list **Done** then moves every *other* member to
`Digitized`.

#### What cancellation is not

Easy to confuse, and each lands somewhere else:

| Act | Result |
|-----|--------|
| requester takes their own request back | `decision = Withdrawn` |
| curator refuses a proposal, before ingest | `decision = Denied` |
| ingest breaks and an admin will retry | `progress = IngestFailed` |
| **removing an item from a list without stopping it** | `list_id = null` → back to `Ready` |
| stopping work on an ingested item | `cancellation` set, progress untouched |

Cancellation sits on the **iteration, not the request**, even though it answers
*"can decision change after ingest?"*: the decision record should stay as what
was decided at the time — an approval later cancelled is not the same history
as an approval that never happened. There is no cancelling a request; before a
decision the requester withdraws it, after one the iteration is cancelled.

### 2.6 Lists are deleted, not cancelled

**A digitization list has no cancelled state.** It exists or it does not, and
deleting it clears `list_id` on every iteration it held — which, by the §2
derivation, makes them `Ready` again, or `Enqueued` where a gate holds them.
Nothing cascades and nothing needs writing: the same rule that put them on the
list takes them off it. **A Done list cannot be deleted** (decided 2026-09-30).

Three things follow, and they are all consequences of the derivation rather
than rules of their own:

- an iteration already `Digitized` or `Published` **keeps that value** — those
  are written, and a written value wins over the derivation
- an iteration that was **cancelled while on the list stays cancelled** — its
  flag is untouched, so it is held at the gate exactly as before, and appears
  in no list-building view until somebody resumes it
- an iteration with an unresolved defect goes back to `Enqueued`, because
  gate 3 still holds it
- the items stop counting as **planned** towards any intention or project —
  planned counts only what is on a list that exists

The fact that an item *was* scheduled, and on which list, survives in the
[[status-log]] — `list_id` is current state, not history. That matters because
deleting a list is otherwise the one action that can erase the record of work
having been planned at all.

### 2.7 One document, many askers

Several people may want the same document. Nothing stops them, and nothing
should — but a document can only be scanned once at a time, so the asks have to
converge somewhere. **Where they converge depends on whether work has started
yet**, and the two cases behave differently enough that conflating them is what
made the first draft of this section wrong.

**Active work** means an approved request whose work is not finished:

```
active  =  decision = Approved
           ∧ (no iteration yet  ∨  progress ∉ {Digitized, Published})
```

The parenthesis matters: an iteration exists from **approval onward** — as an
addition being ingested, then as a document iteration — but there is a window
after approval and before ingest where the request is approved and no iteration
row exists yet. That window is still active work, and a proposal arriving in it
must not start a second one.

**At most one active request per document**, as a partial unique index. A
**cancelled iteration still counts as active** — cancellation is a suspension,
not an exit (§2.5) — so the answer to *somebody wants this again* is resume the
held one, never create a second. Resume therefore never has to check for a
conflict: nothing could have been created while it was held.

#### Case 1 — concurrent proposals, before any work starts

Several `Pending` proposals for one document are **all legitimate and all
reviewable**. They are not duplicates of each other; nobody has decided
anything yet.

**A decision on one is a decision on all of them.** The curator is judging *the
document*, not the person who asked — so approving one approves every open
proposal for it, and denying one denies them all, with the same reason. Nobody
gets a different answer to the same question depending on who asked it.

The asks are still **not interchangeable**, and the difference lands on
priority rather than on the decision. Each carries its own `request.reason`
([[relationships]] §2), and *"needed for the March exhibition"* against *"looked
interesting"* produces the same approval and a different urgency — which is why
category and priority are set at this same moment ([[view-map]] §2).

> **One consequence, on wording.** A propagated decline reason is read by
> everyone who asked, including people whose reason the curator never opened.
> It must therefore be about the **document** — *too fragile*, *already
> published* — and never about a motive. A reason that answers one asker
> confuses the rest.

On approval, exactly one iteration is created. The **oldest** proposal
originates it — `iteration.request_id` points there, and its project funds the
work ([[relationships]] §6). Every other proposal is `Approved` too, and
records what it is now following:

```
request.tracks_iteration_id       — the iteration this request follows
                                    null only on the originating request
```

> Oldest-wins is an arbitrary rule doing a necessary job: `iteration.project_id`
> has to have exactly one candidate or project reporting stops being
> reproducible. First-asked is the defensible arbitrary choice.

**Proposal Review shows one row per document, not one per proposal** — a
curator confronted with the same title five times will decide it five times.
The row carries the count, which is real information: *five people asked for
this*. This is a view consequence of the propagation rule and is not optional;
without it, propagation makes four of the five rows vanish mid-session.

> Note that this makes a **decline apply to several requests at once**, which
> looks like the bulk decline [[view-rules]] §5 rule 5 forbids. It is not: that
> rule exists so a decline always carries a reason, and here there is one
> document, one reason, one decision. The multiplicity is in who hears it.

#### Case 2 — a proposal arriving after work has started

Now there is nothing to review. The document is being digitized; the only
honest answer is *already under way*, and asking a curator to re-decide it
would be theatre. The request is resolved automatically:

```
decision = Duplicate,  tracks_iteration_id = the active iteration
```

`Duplicate` is the only decision no person makes (§2). It is a decision rather
than a restriction because it **resolves** the request — the request
will never produce its own iteration — instead of standing in the way of one.

| | Because |
|---|---|
| never enters Proposal Review | there is no judgement to make — the ask is shown in Documents, in the document's *Asked by* card, tagged *following* |
| never carries a project | only the originating request funds the iteration |
| never sets category or priority | the approval already did, and a shadow must not overwrite it |

#### What both cases share

**The requester sees the tracked iteration's status**, live, in their *My
Documents* — never the word "Duplicate", which reads as a rejection of a
perfectly reasonable ask. They asked a question and get a running answer: *being
checked*, then *scheduled*, then *available* with the link. Public text is
**already being digitized**; `Duplicate` is internal vocabulary.

`tracks_iteration_id` is **not** a second request↔iteration relationship.
Tracking requests shadow; they never produce. `iteration.request_id` still
points at the one request that caused the iteration to exist and stays N:1 —
no join table, and [[relationships]] §7's cardinality question is answered by
not needing the other direction at all.

**Demand is countable.** *Five people asked for this* is
`count(tracks_iteration_id)` — a genuine priority signal ([[priority-levels]])
concentrated on one row, which duplicate *iterations* would have scattered.

#### Already finished is a third case

| Situation | Path | Curator override? |
|---|---|---|
| **in flight** — active work exists | tracks it (cases 1–2) | no — nothing to overrule; an override would create a second active iteration |
| **finished** — digitized already, here or elsewhere | an **existing copy** on the request (§2) | **yes** — *approve as rescan*, and a new iteration proceeds |

The second is how a rescan is requested: at Proposal Review, by a curator, one
item at a time (§2.8). It is a fact on the request and never a restriction
([[registry-status]] §9) — *already digitized* is a reason to think twice, not
a prohibition.

#### Tracked work is never abandoned

An approved request is never withdrawn or denied afterwards, so the work a
shadow follows cannot disappear from under it. A **cancelled** iteration is
held, and still active: its shadows keep following it and show the same held
status, which is honest — the work is stopped, not taken away from them.

The one reshuffle happens **before** approval: when a project is rejected, its
requests are rejected, and where the project's request was the one others were
grouped behind, **the oldest remaining request becomes the originator**
(decided 2026-09-30).

### 2.8 Automatic approval never covers a rescan

Four things approve without a person looking at each item:

- a curator's **approve now** on the propose form — an addition is a proposal
  decided at the moment it is made ([[view-map]] §6)
- a plugin configured with the **`additions` entry point** ([[view-map]] §6)
- **bulk approve** in Proposal Review
- **a project's approval**, which approves the proposals made into it so far
  (decided 2026-09-26); later ones are flagged and decided on their own

All four stop at the same line:

| Shortcut | No existing copy | Existing copy |
|---|---|---|
| curator, *approve now* | `Approved` | stays **`Pending`**, into Proposal Review |
| plugin, `additions` entry point | `Approved` | stays **`Pending`**, into Proposal Review |
| bulk approve | `Approved` | **skipped** — approve it on its own |
| a project's approval | `Approved`, at the project's priority | **skipped** — approve it on its own (decided 2026-09-30) |

**A rescan is always an explicit decision about one item.** The shortcut is a
statement about the items somebody typed in or a plugin harvested; a rescan is
a statement about a copy they may not have known existed. Without the rule, a
bulk add of forty items would quietly approve the three that duplicate a scan
Kramerius already holds, and nobody would ever have decided them. It is the
same line bulk decline is drawn on ([[view-rules]] §5): the acts that need a
judgement per item are the ones a bulk action leaves out.

**So *approve now* is an intent, not a decision.** The copy check is a
registry lookup — asynchronous — and the approval cannot be recorded before it
has answered:

```
request.approve_on_check = null | { actor, at }
```

```
submitted with "approve now"
  → request created Pending, approve_on_check set
  → checks run  (checked_at set)
      no copy found  → Approved, decided by the submitter, intent cleared
      copy found     → stays Pending, intent kept, into Proposal Review:
                       "you asked to add this — Kramerius already has it"
```

The [[status-log]] carries both steps — *proposed, approval requested* and then
*approved after checks* or *held: a copy exists* — so a request's history has
the same shape however it was decided, and *who approved this* always names a
person or an agent, even when the approver was also the asker.

A **restriction does not hold the intent.** *Approve now* never clears gate 2,
so a forbidden item is approved and stays visibly *Forbidden* until an admin
overrules it — there is nothing hidden to protect against.

**Held items are never out of sight:**

- the submission reports on itself — *40 added · 3 held, a copy already
  exists* — linking to those three in Proposal Review
- in Proposal Review they arrive with their copies and with the intent: *you
  asked to add this*. They land in whichever proposal custody matches them —
  or the fallback
- they count in Home's *waiting for your review* ([[navigation]] §8.3)

---

## 3. The gates

The axes are independent, but they are not unordered. Progress cannot leave
`Enqueued` unless all four of these hold:

1. `decision = Approved` — every iteration has a request, a system discovery
   included (decided 2026-09-26)
2. `restriction is null`, **or** it is overruled
3. `validation ∈ { NotRequired, Approved }`
4. `cancellation is null`

That is the whole admission rule, in one function, in one place. Everything the
flat enum was trying to express about ordering lives here instead — which is
why the axes themselves do not need to encode sequence.

Gate 4 is what makes §2.5 work without a transition table. A cancelled item is
not moved, it is *held at the gate*; clearing the flag lets the same rule that
admitted everything else admit it.

---

## 4. The displayed status

One badge per row, one value to sort and facet by. It shows **the blocking gate
if there is one, otherwise the progress**.

| # | Condition | Label |
|---|-----------|-------|
| 1 | `decision = Denied` | Declined |
| 2 | `decision = Withdrawn` | Withdrawn |
| 3 | `decision = Pending` | Awaiting review |
| 4 | `cancellation.cause = Decided` | Cancelled |
| 5 | `cancellation.cause = NotDigitizable` | Could not be digitized |
| 6 | **`progress ≥ Digitized`** | the `progress` value — see below |
| 7 | restriction set ∧ not overruled | Forbidden |
| 8 | `validation = Denied` | Denied in review |
| 9 | `validation = Needed` | Review needed |
| 10 | `progress = IngestFailed` | Could not be added |
| 11 | otherwise | the `progress` value |

First match wins. Rule 6 is the post-digitization exception: once the scan
exists, a newly found defect is reported as a footnote beside the progress
badge — *Published · review needed* — never as a badge that hides the outcome.

Rules 4 and 5 are the two causes of §2.5 shown separately, because a requester
told *Cancelled* asks a different question than one told *Could not be
digitized*. Underneath they are one flag, and the progress the item is being
held at stays visible in the detail panel — a cancellation at `InProgress` is
worth different follow-up than one at `Enqueued`.

Two more things about the order are decisions, not accidents:

- **Forbidden outranks everything below it.** It is the only verdict no
  downstream approval can discharge, so it must never be hidden behind a
  review state.
- **An existing copy is not in the table at all.** It blocks nothing, so it
  can never be *the blocking gate*. The old *Not eligible* row sat here, below
  validation, so that a reviewed item would not read as refused — with the
  copy moved onto the request that problem no longer exists.

An override is shown as a suffix rather than a different label — **Forbidden
(overruled)** — so the original verdict survives on screen. A rescan is the
same idea on the decision: **· rescan** beside whatever the badge says —
*Ready · rescan* — so the copy that was decided over is never forgotten. This is the `status : reason` footnote pattern from `notes.md`, and
each axis contributes its own reason text, public and internal
([[view-rules]] §4.3).

### Storage

Four columns plus the override, and `display_status` as a **generated column**
computed from them. Filtering and sorting the main table then hit one index,
while the axes stay available underneath:

- **Overview filtering** ([[view-rules]] §5) offers `display_status` — one
  control, the vocabulary a user recognises.
- **Advanced filtering** offers the axes — *show me everything a plugin
  forbade, including the overrides*, which the merged value cannot express.

That is the answer to "one property even when the backend has four": yes for
the badge, no for the filter panel.

---

## 5. Status is not stage

[[view-map]] uses stage names — Proposed, Approved, Added, Ready, Queued — and
those are not a fifth enum. A **stage** says which view holds the item; it is
derived from the same four axes:

| Stage | Derived from | View |
|-------|-------------|------|
| Proposed | `decision = Pending` | Proposal Review |
| Declined | `decision ∈ {Denied, Withdrawn}` | — |
| Approved | `decision = Approved` ∧ no iteration | Documents — *being added* |
| Added | iteration exists ∧ gates not all passed | Validation |
| Ready | `progress = Ready` — every gate passed | Digitization Lists — the editor's pool |
| Queued | `progress ∈ {Planned, InProgress}` | Digitization Lists |
| Stalled | `progress = IngestFailed` | Documents — *could not be added* |
| Held | `cancellation is not null` | — |
| Forbidden | restriction set ∧ not overruled | Documents Validations — the *Forbidden* filter; only an admin acts |
| Tracking | `decision = Duplicate` — the request follows other work | Documents — the *Asked by* card |
| Done | `progress ∈ {Digitized, Published}` | — |

So there are not two competing vocabularies to reconcile — there is one model
with two projections. Stage answers *who has it*, status answers *what is true
about it*, and both are functions of the four stored axes.

The public vocabulary in [[view-map]] §4 is a third projection, deliberately
coarser: a reader needs to know whether to wait.

---

## 6. Decided

- **An approval does not survive a re-check** that finds something new, and
  survives one that finds the same or less. Approvals are recorded per defect
  set, not per iteration — the two tables in §2.
- **Work can be stopped after ingest**, from the iteration or from the
  digitization list, at any point before it is digitized. A flag beside the
  progress axis (§2.5), reason required, resumable by clearing it.
- **A resumed cancellation lives in the [[status-log]]**, not in the record. The
  flag clears completely; the history that somebody once stopped this is one
  more log entry, which is where [[view-rules]] §4 already puts provenance. No
  `cleared_at`, no append-only cancellation table.
- **A digitization list is never cancelled — it is deleted**, and deleting it
  makes its documents `Ready` (or `Enqueued` where a gate holds them). A Done
  list is not deleted. See §2.6.
- **`Ready` means every gate passed.** A gate failing after Ready sends the item
  back to `Enqueued`; on a list, it stays flagged (§2).
- **Digitized comes from *Done*, Published from the link** (§2).
- **Eligibility is retired** (§2). A prohibition is a *restriction*, a
  missing-data finding is a *defect*, and an existing copy is a *fact on the
  request* that blocks nothing. *Not eligible* is no longer a badge.
- **A rescan is a curator decision, one item at a time** — approving a request
  that carries an existing copy, under `request.decide`, scoped through proposal custody ([[permissions]] §3). It replaces
  both the `Accepted` override and the admin-only *allow a new iteration*.
- **No shortcut approves a rescan** — not *approve now*, not a plugin's
  `additions` entry point, not bulk approve, not a project's approval (§2.8).
- **`Withdrawn` stays visible to curators, but out of the way.** Proposal
  Review's shared watchlist *Awaiting a decision* leaves it out along with
  `Declined`; *All* shows both, and the view reopens on the tab the curator
  last used (revised 2026-10-05, [[filtering]] §4.2). A filter, not a hidden
  record — the [[view-rules]] §4.5 pattern, declared in view #2 of
  [[view-map]].

## 7. Still open

Nothing on the status axes themselves. What remains belongs to models not yet
written, and is marked in place:

- `TODO(Plugins)` — §2, what identifies a defect. Decided: the key uses
  `plugin_instance_id`; the `subject` still has to be stable across versions
~~`TODO(Permissions)`~~ — **closed** by [[permissions]]: overruling a
restriction is `restriction.overrule@any` (§2), a rescan is `request.decide`,
and cancel / resume are separately grantable (§2.5).

## Related

- [[relationships]] — which of request and iteration holds what
- [[view-map]] — the stage projection, and which view owns each transition
- [[view-rules]] — §4.3 reason text, §5 overview vs advanced filtering

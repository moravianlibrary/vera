# Registry Status

Whether this document is already digitized **somewhere else** — and, for VERA
itself, whether it was already digitized *here*.

This is not a fifth status axis. The four in [[status-model]] describe what VERA
has decided and done; a registry state is an **observation of somebody else's
system**, made at a point in time, which VERA does not own and cannot change.
Keeping that distinction is what stops a foreign vocabulary from leaking into
the enum that drives VERA's own gates.

It lives on the **Document**, not the iteration ([[relationships]] §6): *is this
item digitized anywhere* is a fact about the item, and it stays true across
attempts.

---

## 1. The registries

| Registry | States it reports | Links to |
|----------|-------------------|----------|
| **VERA** | its own — via other iterations of the same document (§4) | the other iteration — *record* |
| **Kramerius** | `Published`, `NotFound` | the scan itself — *content* |
| **RDCZ** | `Planned`, `InProgress`, `Revision`, `Digitized`, `NotFound` | its registry entry — *record* |

Adding a fourth must cost nothing but configuration. Everything below is
therefore written per-registry, never as a special case for these three.

**Two kinds of link, and the difference is who it is for.** A *content* link
goes to something a reader can open and read. A *record* link goes to somebody
else's bookkeeping — useful to a curator deciding whether to schedule work,
useless and confusing to a reader told *available* and then shown a planning
entry. So the kind is stored, not inferred:

```
link_kind = content | record
```

A record link exists at every state, including `Planned` — that is the point of
it, since *who is planning this and when* is exactly what a curator needs
before deciding to duplicate the effort. A content link exists only once there
is content.

---

## 2. Three ways to not know

`NotFound` is an **answer**, and confusing it with the absence of one is the
most common way a registry column lies. Three distinct situations, three
distinct renderings:

| Situation | Stored | Shown as |
|-----------|--------|----------|
| never looked | no row | *not checked* |
| looked, registry says no | `NotFound` | *not there* |
| look failed — registry down, timeout, auth | `CheckFailed` + error | *unknown* — with when it was last tried |

The third is the one worth spending a value on. A registry that has been
unreachable for a week must not render as *not there*, because a curator
reading *not there* will schedule a scan that may already exist.

---

## 3. Storage

```
document_registry_state              — one row per (document, registry)
  document_id
  registry_id
  raw_state        text              — verbatim, exactly as the registry said it
  state            enum              — normalised (§3.1), or Unmapped
  external_id      text  nullable
  url              text  nullable    — present only where the registry gives one
  link_kind        enum  nullable    — content | record, §1
  observed_at      timestamptz       — when this answer was obtained
  checked_at       timestamptz       — when a check last ran, success or not
  error            text  nullable    — set with state = CheckFailed
```

Rewritten per check, like `iteration_defects` in [[status-model]] §2. History
of what a registry used to say belongs in the [[status-log]] if wanted at all;
this table is *what is true now, as far as we know*.

**`observed_at` and `checked_at` are separate.** A check that fails updates
`checked_at` and leaves the previous answer standing with its original
`observed_at` — so the view can say *"published (checked 3 minutes ago)"* or
*"published (as of 6 weeks ago, unreachable since)"*, which are very different
things to act on.

### 3.1 The normalised vocabulary

Deliberately coarser than `progress`, because it answers a coarser question:

```
NotFound | Planned | InProgress | Digitized | Published | Unmapped | CheckFailed
```

**Both `raw_state` and `state` are kept.** The normalised value is what the UI
filters and sorts on; the verbatim one is what it displays when they disagree,
and what makes a mapping mistake recoverable without re-querying every registry.

### 3.2 Mapping is per-registry configuration

| RDCZ | → | Kramerius | → |
|------|---|-----------|---|
| `Planned` | `Planned` | `Published` | `Published` |
| `InProgress` | `InProgress` | *absent* | `NotFound` |
| `Digitized` | `Digitized` | | |
| `Revision` | **`Unmapped`** — §5 | | |
| *absent* | `NotFound` | | |

**An unrecognised value maps to `Unmapped`, never to a guess and never to an
error.** A registry that adds a state next year then shows up honestly as
*RDCZ: Revision* rather than corrupting a column or failing a check.

> `TODO(Plugins):` **the mapping table is plugin-owned.** A registry adapter is
> a plugin, so it supplies both the lookup and the `raw_state → state` mapping,
> alongside `defect_key` and agent identity. The rule that constrains it is
> above: unknown maps to `Unmapped`.

---

## 4. Names that collide are not the same value

`Planned` and `InProgress` appear in both RDCZ's vocabulary and VERA's
`progress`. **They are not the same fact and must never share a column.**
VERA's `Planned` means *on a VERA list dated in the future*
([[status-model]] §2); RDCZ's means *somebody at another institution intends to
scan this*. One is a commitment we made, the other is news.

This is why §3 stores registry state on its own table with a `registry_id`
rather than widening `progress`: **who said it** is part of the value. Strip the
attribution and a curator reading *In progress* cannot tell whether to stop
work or to carry on.

---

## 5. `Revision`

Unmapped, shown verbatim, and **not guessed at**.

The speculation that it might mean *a second pass* — RDCZ's equivalent of a
second iteration — is plausible and would be useful, but the cost of being
wrong is asymmetric. An unmapped value that displays honestly costs a curator
one moment of unfamiliarity. A value wrongly mapped to `InProgress` tells every
curator something false, silently, in a column they trust.

> `TODO(Plugins):` **ask RDCZ what `Revision` means.** One question to one
> institution settles it. Until then it stays `Unmapped`.

If it does turn out to mean a re-digitization, the right response is **not** to
map it to a state. A second pass is not a state of the first one — it is a
second record, which is exactly how VERA models the same thing (§6, and
[[relationships]] §1: *iteration, not document, is the unit of work*). The
mapping would then be `Revision → Digitized`, plus evidence that another
attempt exists.

---

## 6. VERA as a registry

VERA looks itself up through the same interface: *does another iteration of this
document exist, and how far did it get?*

- The reported state is the **most advanced other iteration's** progress —
  ties broken by the most recent. The question being asked is *is this already
  done here*, and the furthest-along attempt answers it.
- The link is internal: to that iteration.
- `NotFound` means *this is the first attempt*, and is the common case.

This is what the `VERA (prev.):` prefix in `demos/notes.md` was reaching for.
Treating VERA as one registry among several means one column, one renderer, one
mental model — rather than a bespoke "previous iterations" widget sitting beside
the registry column doing almost the same job.

### 6.1 Two open iterations of one document

The concern — *if there are two `Ready` iterations and one changes, must the
other change too?* — is correct, and the answer is that **the situation must not
arise**. Synchronising them would be as bad to model as it sounds, and the
badness is a signal: two open iterations of one document is not a state worth
supporting, because a document can only be physically scanned once at a time.

This is settled in [[status-model]] §2.7 rather than here, because it is a rule
about requests and decisions rather than about registries. In short: at most one
**active** request per document; concurrent proposals are decided together and
the oldest originates the iteration; a proposal arriving after work has started
is resolved as `Duplicate` and **tracks** the existing iteration instead of
starting a second one.

What matters for this document is the shape that falls out of it: requests
either **produce** an iteration or **shadow** one, never both, so
`iteration.request_id` stays N:1 and no join table appears.

---

## 7. In the views

One column, not three. `demos/notes.md` proposed joining *Dig. (App)* and
*Dig. (Registries)*, and §6 is what makes that honest — VERA is simply one of
the registries being joined.

- The column shows the **strongest evidence**: any `Published` wins and carries
  its link, otherwise the most advanced state across registries.
- **The badge links to content where content exists**, and to a record
  otherwise. A reader is only ever offered a *content* link — being told
  *available* and landed on somebody's planning entry is worse than being
  offered no link at all. Record links are curator-facing and belong to the
  same graded treatment as reason text ([[view-rules]] §4.3).
- It is **prefixed by the registry that reported it** — *Kramerius: Published*,
  *VERA (prev.): Digitized* — because §4 makes the source part of the value.
  One badge, 1.5 points ([[view-rules]] §1.1).
- Disagreement between registries is not an error and is not resolved in the
  row. The **detail panel lists every registry** with its own state, its link,
  and its `observed_at`. The row answers *is this already available*; the panel
  answers *according to whom*.
- A stale or failed check renders its age (§2). Never silently.
- Registry state **never reaches the gates.** It becomes an *existing copy* on
  the request — a fact for whoever decides — §9.

---

## 8. When checks run

**On a schedule** — a registry adapter is a plugin, and a plugin execution can
be scheduled. So registry state is not a thing captured once at ingest and left
to rot; it is refreshed for the whole corpus on whatever cadence each adapter is
configured for.

Two consequences:

- **`observed_at` is bounded by the schedule**, which is what makes §7's
  freshness rendering cheap — a state older than its own cadence is stale by
  definition, and the view can say so without a separately configured threshold.
- **A scheduled run can change the answer under a document VERA has already
  decided about.** Something scheduled on a VERA list can turn up in Kramerius
  next week. This is the same shape as a validation re-check in
  [[status-model]] §2, and it takes the same treatment: **it never moves
  `progress` backwards**, and it surfaces as a footnote on the row —
  *In progress · now published in Kramerius* — for a person to act on. The
  machine noticing is not the machine deciding.

---

## 9. Registry state becomes an existing copy

A registry lookup runs with the other checks — against the request at proposal
time, and again against the iteration at ingest. A curator reviewing a proposal
therefore already sees *Kramerius: Published*, which is the cheapest possible
moment to avoid duplicating work: before anybody has spent anything.

**The two things stay separate**, and this is the whole point of §1's framing:

| | What it is | Owner |
|---|---|---|
| `document_registry_state` | *Kramerius says: published, here is the link* | the registry — an observation |
| `request.existing_copies` | *therefore: a copy exists* | the plugin — per-registry policy |

This section used to say *therefore: not eligible*. It does not any more:
eligibility was retired ([[status-model]] §2, *What eligibility used to hold*)
because *already digitized elsewhere* is news for whoever decides, not an
obstacle. **An existing copy blocks nothing** — it is not a gate and never
takes the badge — and approving a request that carries one is *approving a
rescan*: a curator decision, one item at a time, which no shortcut may make
([[status-model]] §2.8).

Not every state is a copy. *Kramerius: Published* plausibly is; *RDCZ:
Planned* probably is not, since somebody else's intention is news rather than a
scan. Which states count is per-registry policy, exactly like the §3.2 mapping.

> `TODO(Plugins):` **which registry states count as an existing copy.** Same
> plugin, same configuration, one more table. The constraint is that it must
> never produce a restriction — *already digitized elsewhere* is a reason to
> think twice, not a prohibition, and only a restriction needs an admin to
> undo.

The registry gets to object; it does not get the last word — and now it does
not get to hold anything up either.

---

## 10. ~~Open~~ — decided

- ~~**Does a scheduled re-check re-open eligibility on a `Ready` item?**~~ —
  **no, because there is nothing to re-open.** A copy found after approval
  blocks nothing, by the same rule as one found before it. It surfaces as the
  §8 footnote — *Ready · now published in Kramerius* — in the Documents pane,
  and as a **warning in the list editor's pool**, so the dig-curator does not put it on a
  list without seeing it. Anyone who wants to stop it cancels it
  ([[status-model]] §2.5). The machine noticing is not the machine deciding.

## Related

- [[status-model]] — the four axes this is deliberately not a fifth of; §2 the existing copy, §2.8 why no shortcut approves a rescan
- [[relationships]] — §6 why this lives on the document; §7 the cardinality §6.2 settles
- [[document-identity]] — what an external ID has to match against
- [[view-rules]] — §1.1 the badge budget §7 spends

# Priority Levels

Priority is an **enum of four values** on the iteration ([[relationships]] §6).
Four, not five: every level has to be a decision somebody can actually make, and
a five-point scale collapses to "urgent / not urgent / haven't looked" in
practice anyway.

## The values

| Value | Badge | Meaning |
|-------|-------|---------|
| `Urgent` | red | Blocking something dated — an exhibition, a grant deadline, a legal obligation |
| `High` | amber | Ahead of routine work, planned into the current period |
| `Normal` | slate | **Default.** Assigned when nothing says otherwise |
| `Low` | slate | Done when capacity allows |

**Declaration order is ascending: `Low < Normal < High < Urgent`.** Stored as a
native enum type, so ordering comes from the type and `ORDER BY priority DESC`
needs no lookup table and no mapping in the client.

The names are ordered by the words alone — `Urgent` outranks `High` outranks
`Normal` in ordinary use, so nobody needs a legend to sort a queue. This is the
whole reason `Medium` is not one of them: *medium* and *normal* are synonyms,
and a scale whose order cannot be read off its labels is a scale people get
wrong.

## Rules

- **`Normal` is the default** for every new request and iteration. `Normal`
  means nobody has judged it, not that somebody chose "normal" — which is why
  it sits *below* `High` rather than in the middle of the scale.
- Sort and compare on the enum. Never sort on the label.
- **Only `Urgent` and `High` carry colour.** Low priority must not compete for
  attention — `Normal` and `Low` share the neutral badge and are told apart by
  their name. This is what keeps a priority badge at 1.5 points
  ([[view-rules]] §1.1) instead of making every row shout.
- Priority is set by `curator` and `dig-curator` only ([[view-rules]] §5).
  Changing it writes a status-log entry like any other state change.
- Filter facets present all four values in descending order, even when empty —
  a missing level reads as "none at this level", which is information.
- Priority is **independent of every status axis** ([[status-model]]). An
  `Urgent` item still passes the same gates; priority orders the queue, it does
  not open it.

## Where it is set

| Moment | Who | View |
|--------|-----|------|
| on approval of a proposal | curator | Proposal Review — [[view-map]] §2 |
| any time after ingest | curator | Validation |
| while building a list | dig-curator | List Building |

Approval is the only place priority is assigned from nothing; everywhere else
it is a change to an existing value.

## Open

- **Is any level excluded from list generators?** The previous five-point scale
  had a bottom value (`Deferred`) that generators skipped by default — it was
  the one level with behaviour attached. Four levels have no such value.
  Either `Low` inherits that exclusion, or generators consider everything and
  `Low` simply sorts last. These produce visibly different lists, so it is a
  decision, not a detail. Sorting last is the smaller claim and the suggested
  default.

## Used By

- **Iterations** — the queue order every document view sorts by
- **Requests** — set at approval, inherited by the iteration that ingest creates
- **List generation** — [[view-map]] §5; orders within each category ([[intentions]] §4)

## Related

- [[relationships]] — §6, why priority lives on the iteration and not the document
- [[status-model]] — the axes priority is deliberately not one of
- [[view-rules]] — §1.1 badge cost, §5 who may set it

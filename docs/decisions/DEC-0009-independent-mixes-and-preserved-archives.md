# DEC-0009: Mixes are independent; archiving preserves

Decided 2026-10-08, replacing the rule that every mix belongs to an intention.

**Context.** A mix owned by an intention made sharing awkward: an edit changed every intention
tracking it, and ownership moved when an edit was declined. Archiving an intention only hid it,
so its figures changed as the tree and mixes did.

**Decision.**
- A mix is its own record, with a name, immutable revisions, labelled snapshots, a Primary
  designation and an active or archived state.
- An intention may choose no mix, follow a mix's latest revision, or pin one.
- Archiving an intention preserves it as it was, including the exact mix revision.

**Rejected.** Mixes owned by intentions; archive as hiding.

**Rules.** [PLAN-mix](../reference/planning/mixes.md#plan-mix),
[PLAN-no-mix](../reference/planning/mixes.md#plan-no-mix),
[LC-INT-archive](../reference/lifecycles/intention.md#lc-int-archive).

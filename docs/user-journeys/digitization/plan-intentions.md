# Set what we aim to digitize, and in what proportion

**Who.** A digitization curator: Martin Svoboda. Some steps need an admin: Petr Dvořák.

**Goal.** "Set this quarter's target for regional periodicals, and the proportions we want."

**Starting state.** A Primary mix and the Overall intention exist.

## Steps

1. On *Intentions* he creates an intention: funding *any*, scope *Periodicals*, a window for
   the quarter, a page target, and the Primary mix.
   → It is Upcoming or Running by its dates; its counting start is fixed
   ([LC-INT-counts-from](../../reference/lifecycles/intention.md#lc-int-counts-from)).
2. He opens its mix on *Mixes* and edits the proportions.
   → A new revision of the mix; every intention following it changes too
   ([PLAN-mix-revision](../../reference/planning/mixes.md#plan-mix-revision)).
3. He tries to set a child set to 110%.
   → Refused: a set adds up to at most 100
   ([PLAN-mix-sets](../../reference/planning/mixes.md#plan-mix-sets)).
4. He archives last quarter's intention.
   → Preserved as it was, read-only
   ([LC-INT-archive](../../reference/lifecycles/intention.md#lc-int-archive)).
5. Petr (admin) sets a monthly repeat.
   → Its first occurrence comes when the next month starts
   ([LC-INT-repeat](../../reference/lifecycles/intention.md#lc-int-repeat)).
   **(engine: [L26](../../ledger.md#l26-repeats))**
6. Petr makes another mix Primary, then archives the old one.
   → Intentions that followed the old mix keep its last revision, pinned
   ([PLAN-mix-archive](../../reference/planning/mixes.md#plan-mix-archive)).

## Rules

[PLAN-intention](../../reference/planning/intentions.md#plan-intention) ·
[PLAN-scope](../../reference/planning/intentions.md#plan-scope) ·
[PLAN-mix-within-scope](../../reference/planning/mixes.md#plan-mix-within-scope) ·
[ACT-mix-save](../../reference/access/acts.md#mixes) ·
[ACT-mix-primary](../../reference/access/acts.md#mixes)

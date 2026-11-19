# Change my part of the tree and who looks after it

**Who.** A curator: Kateřina Novotná, with custody of *Maps*.

**Goal.** "Split Maps into lines we plan separately, and bring a colleague onto them."

**Starting state.** *Maps* is a leaf holding documents. A mix gives it a share.

## Steps

1. On *Categories* she looks for a way to add a child to *Maps*.
   → Only *Refine…* is offered: it holds documents, so it must be refined
   ([PLAN-leaf-with-documents](../../reference/planning/categories.md#plan-leaf-with-documents)).
2. She refines *Maps* into *Maps → Historical*.
   → Every document moves into the child, each logged; the child takes all of Maps' share
   ([PLAN-refine](../../reference/planning/categories.md#plan-refine)).
3. She adds a second child, *Maps → Modern*.
   → It has no share yet, and the set is flagged
   ([PLAN-move](../../reference/planning/categories.md#plan-move)).
4. She grants custody of *Maps* to a colleague.
   → The colleague now reaches everything under *Maps*
   ([ACCESS-grant-custody](../../reference/access/custody.md#access-grant-custody)).
5. She moves *Maps → Modern* and looks for the top level among the destinations.
   → It is not offered: at `custody` she changes only her own subtree, and only an administrator
   changes the top level ([PLAN-top-level](../../reference/planning/categories.md#plan-top-level)).

## Rules

[PLAN-tree](../../reference/planning/categories.md#plan-tree) ·
[ACT-category-refine](../../reference/access/acts.md#categories) ·
[ACT-category-custody](../../reference/access/acts.md#categories) ·
[REL-custody-any-node](../../reference/model/relationships.md#rel-custody-any-node)

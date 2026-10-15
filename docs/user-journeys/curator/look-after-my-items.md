# Look after the items in my custody

**Who.** A curator: Kateřina Novotná.

**Goal.** "Keep my line of work in order: right category, right priority, stopped when it should
be, readable when it's done."

**Starting state.** In *Periodicals*:
- a Ready item filed under the wrong leaf;
- an item on a running list that must stop;
- a Digitized item with no link yet.

## Steps

1. On *Documents* she opens the misfiled item and changes its category and priority.
   → Logged as *Reclassified*. Moved outside her custody, it is handed over
   ([ACT-reclassify](../../reference/access/acts.md#iterations)).
2. She cancels the listed item with a public and an internal reason.
   → It is held, comes off the list, and its askers read *On hold*
   ([LC-ITER-cancel](../../reference/lifecycles/iteration.md#lc-iter-cancel)).
3. She sets the link on the Digitized item.
   → It is Published, and its askers see *Available*
   ([LC-ITER-published](../../reference/lifecycles/iteration.md#lc-iter-published)). A hook on
   `iteration.published` fires ([HOOK-events](../../reference/integrations/hooks.md#hook-events)).
4. She resumes the cancelled item. **(not built: [L14](../../ledger.md#l14-acts-not-built))**
   → It returns to the pool.

## Rules

[SCOPE-custody-category](../../reference/access/scopes.md#scope-custody-category) ·
[ACT-cancel](../../reference/access/acts.md#iterations) ·
[ACT-publish](../../reference/access/acts.md#iterations) ·
[LC-ITER-scanned](../../reference/lifecycles/iteration.md#lc-iter-scanned)

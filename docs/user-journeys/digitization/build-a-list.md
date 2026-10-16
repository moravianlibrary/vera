# Plan the next weeks of scanning

**Who.** A digitization curator: Martin Svoboda.

**Goal.** "Put together what the scanners do from Monday, and close last month's list."

**Starting state.**
- Ready items in the pool, some of them A4 by the document property *Size*.
- A running list past its end date, not yet marked Done, with one item that turned out
  impossible to scan.
- An item on another list that a validation rule stopped after it was listed.

## Steps

1. On *Digitization Lists* he sees the overdue list flagged
   ([LC-LIST-overdue](../../reference/lifecycles/list.md#lc-list-overdue)).
2. On it he marks the impossible item *Could not be digitized…* with a message.
   → It stays on the list, held; its askers read the message
   ([LC-ITER-not-digitizable](../../reference/lifecycles/iteration.md#lc-iter-not-digitizable)).
3. He marks the list *Done…*, after the impact: how many move to Digitized and what is blocked.
   → Every open member is Digitized; the list is fixed
   ([LC-LIST-done](../../reference/lifecycles/list.md#lc-list-done)).
4. He starts a *New list* from Monday, with a page target, narrows the pool to the document
   property *Size* A4, and adds items from it.
   → Only A4 items are offered
   ([DOC-property-filter](../../reference/model/documents.md#doc-property-filter)). The items
   show *Planned* until Monday
   ([LC-ITER-on-list](../../reference/lifecycles/iteration.md#lc-iter-on-list)). A hook on
   `list.created` fires.
5. Meanwhile someone else lists one of the same items; he saves.
   → Refused: that item is no longer in the pool
   ([LC-LIST-pool](../../reference/lifecycles/list.md#lc-list-pool)).
6. On the other list he finds the item a rule stopped, flagged, and takes it off.
   → It returns to Enqueued until its gate clears
   ([LC-LIST-blocked](../../reference/lifecycles/list.md#lc-list-blocked)).
7. He deletes a list that was planned by mistake, after its impact.
   → Its members return to the pool; each keeps the list's name in its history
   ([LC-LIST-delete](../../reference/lifecycles/list.md#lc-list-delete)).

## Rules

[ACT-list-create](../../reference/access/acts.md#digitization-lists) ·
[ACT-list-done](../../reference/access/acts.md#digitization-lists) ·
[ACT-list-delete](../../reference/access/acts.md#digitization-lists) ·
[LC-LIST-state](../../reference/lifecycles/list.md#lc-list-state)

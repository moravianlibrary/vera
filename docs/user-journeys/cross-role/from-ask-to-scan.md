# One document from an ask to a published scan

The whole path, through every role that touches it. This is the first journey the engine must
pass.

**Who.**
- Tomáš Marek (reader) asks.
- Kateřina Novotná (curator) decides, rules and publishes.
- Martin Svoboda (dig-curator) schedules.

**Goal.** "The volume I asked for becomes readable online."

**Starting state.**
- A periodical volume nobody has asked for.
- A Custody rule places periodicals in *Periodicals*.
- A validation rule will find the page count missing.

## Steps

1. **Tomáš** proposes the volume with a reason.
   → On *My Documents* it reads *Waiting for review*.
2. The Custody rule places it in *Periodicals*.
   → **Kateřina** sees it on *Requests*
   ([ACCESS-custody-by-plugins](../../reference/access/custody.md#access-custody-by-plugins)).
3. **Kateřina** approves it into *Periodicals → Regional* at *Normal* priority.
   → Tomáš reads *Being added*; an iteration is Enqueued
   ([LC-ITER-ingest](../../reference/lifecycles/iteration.md#lc-iter-ingest)).
4. Ingest reads the record and runs the checks; the page count is missing.
   **(engine: [L25](../../ledger.md#l25-ingest))**
   → The item is *Review needed* on *Documents Validations*; Tomáš reads *Being checked*.
5. **Kateřina** enters the counted pages.
   → The defect is gone; the item is Ready; Tomáš reads *Waiting to be scheduled*.
6. **Martin** adds it to a list starting next Monday.
   → *Planned*; Tomáš reads *Scheduled*. On Monday it is *In progress* without anyone acting
   ([LC-LIST-state](../../reference/lifecycles/list.md#lc-list-state)).
7. **Martin** marks the list Done.
   → *Digitized*; Tomáš reads *Available*.
8. **Kateřina** sets the link where the scan can be read.
   → *Published*. Tomáš's document has the link, and if a hook on `iteration.published` mails
   askers, he gets the mail ([HOOK-events](../../reference/integrations/hooks.md#hook-events)).
9. **Tomáš** opens the document's history.
   → *Accepted*, *Digitized*, *Available to read*, with no names
   ([LOG-public](../../reference/model/log.md#log-public)).

## Rules

[STAT-badge](../../reference/model/status.md#stat-badge) ·
[STAT-public](../../reference/model/status.md#stat-public) ·
[STAT-gates-move-progress](../../reference/model/status.md#stat-gates-move-progress) ·
[LC-ITER-on-list](../../reference/lifecycles/iteration.md#lc-iter-on-list) ·
[LOG-one-act-one-story](../../reference/model/log.md#log-one-act-one-story)

## The engine needs

A clock it can move (step 6), ingest (step 4), and the hook sent through a fake mail channel
(step 8).

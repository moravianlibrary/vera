# Iteration

One attempt at a document, from approval to publication. Progress is one of the four axes
([STAT-axes](../model/status.md#stat-axes)); the gates decide when it moves
([STAT-gates](../model/status.md#stat-gates)).

```mermaid
stateDiagram-v2
  [*] --> Enqueued: approved
  Enqueued --> IngestFailed: ingest fails
  IngestFailed --> Enqueued: retried
  Enqueued --> Ready: every gate passes
  Ready --> Enqueued: a gate stops it
  Ready --> Planned: listed, the list not started
  Ready --> InProgress: listed, the list started
  Planned --> InProgress: the list's start date
  Planned --> Ready: taken off, or its list deleted
  InProgress --> Ready: taken off, or its list deleted
  InProgress --> Digitized: its list marked Done
  Digitized --> Published: link set
```

#### LC-ITER-ingest

Approval puts the iteration in **Enqueued**. Ingest reads its catalog record and runs the
checks: restriction rules, validation rules, registries. A failed ingest is **Ingest failed**
until an administrator retries its batch.

> **Open — [L25](../../ledger.md#l25-ingest).** The mock runs no ingest. Approving a proposal
> creates the iteration at once with no defects; approving a project leaves its asks approved
> with no iteration, *being added*. The engine has to run ingest: create the iteration, read the
> record, run the checks and the classifier, and move progress.

#### LC-ITER-on-list

On a list, an item's progress follows the list: **Planned** before the list's start date,
**In progress** from it. Only *Mark Done* writes **Digitized**.

#### LC-ITER-off-list

Taken off a list, or when its list is deleted, an item goes back to **Ready**, or to
**Enqueued** if a gate now stops it. It keeps the deleted list's name as history.

#### LC-ITER-scanned

Once Digitized, progress never moves back. Its category and priority are fixed, and a page count
can no longer be entered: the scan has counted the pages. Checks still run, and their findings
show as a footnote.

#### LC-ITER-cancel

**Cancel** holds the item where it is, with a public and an internal reason; progress does not
change. A listed item comes off its list. Only an item not yet scanned can be cancelled.

#### LC-ITER-not-digitizable

**Could not be digitized** is a hold with the cause *Not digitizable*, set on a member of a
running list. The item stays on the list, marked, and *Mark Done* does not move it.

#### LC-ITER-resume

**Resume** lifts a hold. The item returns to the pool, not to its old list.

> **Open — [L14](../../ledger.md#l14-acts-not-built).** Resume is not built.

#### LC-ITER-reclassify

The category and priority change until the scan exists. Moved outside the person's custody, the
item becomes the business of the curators of its new category.

#### LC-ITER-rescan

A rescan is a new iteration of the same document, approved over an existing copy with a note.
The earlier iteration is history and takes no further acts.

#### LC-ITER-published

Setting the link where the scan can be read makes it **Published**. Changing the link later is
logged as such.

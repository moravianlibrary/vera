# Status

What state a document's work is in. It cannot be one enum: an item can at the same time be
approved, forbidden by a rule, waiting for review of its metadata, and already on a list. So
VERA stores separate **axes** and derives **one badge** from them for display.

## The axes

#### STAT-axes

Four stored axes and a hold:

| Axis | On | Values |
|---|---|---|
| **Decision** | each request | Pending · Approved · Denied · Withdrawn · Duplicate |
| **Restriction** | the iteration | a rule's finding, and an administrator's overrule of it |
| **Validation** | the iteration | derived from defects and verdicts: Not required · Needed · Approved · Denied |
| **Progress** | the iteration | Enqueued · IngestFailed · Ready · Planned · InProgress · Digitized · Published |
| **Cancellation** | the iteration | none, or a hold with its cause: Decided or Not digitizable |

*Why:* one enum would have to name every combination, and an act on one axis would have to know
all the others.

#### STAT-validation

Validation compares the current defects **D** with the defect keys accepted **A** and denied
**N**, in this order:
1. no defects: **Not required**;
2. any current defect denied: **Denied**;
3. every current defect accepted: **Approved**;
4. otherwise: **Needed**.

Verdicts are appended, never rewritten. A revocation takes back acceptances as a row of its own,
and the later row wins. A curator is shown only what is outstanding, D minus A.

#### STAT-defect-key

A defect's key is stable across check runs: plugin instance, rule code and subject, never the
value. A verdict on a key therefore still stands when the checks find the same defect again,
and a defect the checks no longer find needs no verdict.

#### STAT-denial-lapses

A denial lapses only when the defect it denied is gone: repaired in the catalog and not found by
a recheck.

## The gates

#### STAT-gates

An iteration may go to a list only when every gate passes:
- **decision:** its request was approved (always true for an iteration);
- **restriction:** no restriction stands, or an administrator overruled it;
- **validation:** Not required or Approved;
- **cancellation:** it is not held.

#### STAT-gates-move-progress

Progress follows the gates:
- an Enqueued item moves to **Ready** when every gate passes;
- a Ready item that a gate stops moves back to **Enqueued**, and returns when it clears.

A listed item a gate stops after listing stays on its list, flagged
([LC-LIST-blocked](../lifecycles/list.md#lc-list-blocked)). Nothing moves a scan back.

#### STAT-checks-after-scan

Checks can run at any time, after the scan too. A defect found after the scan rides beside the
progress badge as a footnote (*review needed*, *validation denied*) instead of replacing it.

## The badge

#### STAT-badge

The displayed status is the first that applies:

| # | Badge | When |
|---|---|---|
| 1 | Awaiting review | no iteration; a request is Pending |
| 2 | Being added | no iteration yet; a request is Approved |
| 3 | Declined, Withdrawn | no iteration; the liveliest request was declined or withdrawn |
| 4 | Cancelled | held, cause Decided |
| 5 | Not digitizable | held, cause Not digitizable |
| 6 | Digitized, Published | scanned |
| 7 | Forbidden | a restriction stands |
| 8 | Validation denied | validation Denied |
| 9 | Review needed | validation Needed |
| 10 | Enqueued, Ingest failed, Ready, Planned, In progress | its progress |

Without an iteration, a document's status is its liveliest request: Pending, then Approved,
Denied, Withdrawn. A request marked Duplicate follows other work and is never the lead.

#### STAT-not-stage

The badge is not the stage. The pages are cut by stage (proposals, validation, lists), each with
its own fixed selection, and a row's badge may say something a stage does not.

## What a requester reads

#### STAT-public

A requester reads a coarser status, which only tells them whether to wait:

| Public status | When |
|---|---|
| Waiting for review | their request is Pending |
| Not accepted | it was declined |
| Withdrawn | they withdrew it |
| Being added | approved, not yet ingested, or ingest failed |
| On hold | the work is cancelled or not digitizable |
| Not available | a restriction forbids it |
| Being checked | ingested, with a gate still to pass |
| Waiting to be scheduled | Ready, every gate passed |
| Scheduled | on a list: Planned or In progress |
| Available | Digitized or Published |

#### STAT-never-duplicate

A requester whose ask follows other work sees that work's status, never the word *duplicate*.

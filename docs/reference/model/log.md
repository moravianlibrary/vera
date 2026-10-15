# The status log

One append-only log across entities, which says why each thing is as it is.

#### LOG-cause

An entry records a **cause**: who did what, when, and why. It never records something that can
be worked out from other facts. A list moving to In progress on its start date is not logged;
marking it Done is.

*Why:* a derived change logged as a cause would be a second source of truth that can disagree
with the first.

#### LOG-append-only

Entries are never changed or removed. A correction is a new entry.

#### LOG-subjects

An entry is about one subject: an iteration, a request, a list or a project.

> **Open — [L7](../../ledger.md#l7-access-and-planning-changes-are-not-logged).** Changes to access,
> categories, intentions, mixes, plugins, hooks and schedules are not logged yet; the log has no
> subject for them.

#### LOG-actor

Every entry has an actor: a user (a person or an agent), or the system. The actor is never
missing.

#### LOG-one-act-one-story

One act that touches several subjects writes one entry per subject, all sharing a correlation
ID. A decision on three asks writes three entries, so each asker's history holds it. Staff read
it once.

#### LOG-two-texts

An entry has an event and a detail. The detail carries the internal reason and is withheld from
anyone who may read only the public story.

#### LOG-public

A requester reads their request's story in plain words: only the steps that move it forward or
hold it, with no actor named and no detail.

| Event | A requester reads |
|---|---|
| Approved | Accepted |
| Declined | Not accepted |
| Forbidden | Not available for digitization |
| Cancelled | On hold |
| Digitized | Digitized |
| Published | Available to read |

> **Open — [L23](../../ledger.md#l23-event-codes).** Events are free text today
> (`TODO(rrandiak)` in `domain/entities.ts`). The engine needs event codes, each with its public
> wording, its subject kind and its detail fields.

#### LOG-ingest-detail

The detail of an ingest entry (the failure text) is withheld from anyone without `request.read_ingest`.

#### LOG-where-read

The log is read:
- in a record's *History* on Documents, Proposals, Documents Validations and Digitization Lists;
- on a project's page;
- on a list's page.

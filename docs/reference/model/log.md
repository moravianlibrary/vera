# The status log

One append-only log across entities, which says why each thing is as it is. Its entries are
events from the [catalogue](events.md), the ones marked for History
([EVENT-destinations](events.md#event-destinations)).

#### LOG-cause

An entry records a **cause**: who did what, when, and why. It never records something that can
be worked out from other facts. A list moving to In progress on its start date is not logged;
marking it Done is.

*Why:* a derived change logged as a cause would be a second source of truth that can disagree
with the first.

#### LOG-append-only

Entries are never changed or removed. A correction is a new entry.

#### LOG-subjects

An entry is about one subject: a request, an iteration, a document, a list or a project.
Changes to access, categories, intentions, mixes, plugins, hooks and schedules are not in the
log; they go to the Audit stream ([OBS-audit](../integrations/observability.md#obs-audit)).

> **Open — [L7](../../ledger.md#l7-access-and-planning-changes-are-not-logged).** No admin change
> is recorded yet: the Audit stream is not built.

#### LOG-actor

Every entry has an actor: a user (a person or an agent), or the system. The actor is never
missing.

#### LOG-one-act-one-story

One act that touches several subjects writes one entry per subject, all sharing a correlation
ID. A decision on three asks writes three entries, so each asker's history holds it. Staff read
it once.

#### LOG-two-texts

An entry has a code, its data and a reason in two texts ([EVENT-shape](events.md#event-shape)).
The internal reason is withheld from anyone who may read only the public story.

#### LOG-public

A requester reads their request's story in plain words: only the codes that have a public
wording in the [catalogue](events.md) (*Asked*, *Accepted*, *On hold*, *Digitized*…), with no
actor named and no internal reason.

> **Open — [L23](../../ledger.md#l23-event-codes).** Entries are free text today
> (`TODO(rrandiak)` in `domain/entities.ts`), and the public wording is matched by prefix. The
> catalogue is decided; the engine and the client do not use it yet.

#### LOG-ingest-detail

The error in an ingest entry's data (the failure text) is withheld from anyone without
`request.read_ingest`.

#### LOG-where-read

The log is read:
- in a record's *History* on Documents, Requests, Documents Validations and Digitization Lists;
- on a project's page;
- on a list's page.

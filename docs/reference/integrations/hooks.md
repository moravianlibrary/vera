# Hooks

Machine messages to a fixed destination when something happens. The acts are in
[acts](../access/acts.md#hooks).

#### HOOK-model

A hook subscribes to one or more **events**, codes from the [catalogue](../model/events.md)
marked for hooks, optionally narrowed by a condition. It sends a message
through one **delivery channel** (a Delivery channel plugin instance: email, chat, webhook or
file) to a recipient, with its own batching and retries.

#### HOOK-events

| Group | Events |
|---|---|
| Requests | `request.created` · `request.approved` · `request.declined` · `request.held` |
| Documents | `iteration.ingested` · `iteration.ingest_failed` · `iteration.verdict_accepted` · `iteration.verdict_denied` · `iteration.verdict_revoked` · `iteration.restricted` · `iteration.reclassified` · `iteration.cancelled` · `iteration.not_digitizable` · `iteration.listed` · `iteration.digitized` · `iteration.published` · `iteration.link_added` · `iteration.link_changed` · `iteration.link_made_primary` · `iteration.link_removed` |
| Records | `document.relinked` · `document.property_changed` · `iteration.property_changed` · `document.registry_changed` |
| Lists | `list.created` · `list.dates_moved` · `list.started_early` · `list.started` · `list.marked_done` · `list.deleted` |
| Tasks | `run.finished` · `run.failed` |

No configuration code is offered: what an admin changes goes to the Audit stream only
([DEC-0018](../../decisions/DEC-0018-one-event-catalogue.md)).

#### HOOK-list-transitions

`list.started` fires when a list becomes In progress: on its start date, from the daily job, or
at once on *Start now…*, which also sends `list.started_early`. `list.marked_done` fires on
*Mark Done*. A list created to start today fires `list.created` and `list.started` together.
`list.started` is derived and is never logged ([EVENT-derived](../model/events.md#event-derived)).

*Why:* a list's state follows its date and is never written
([LC-LIST-state](../lifecycles/list.md#lc-list-state)), so nothing would otherwise mark the
moment the scanning operation should begin.

#### HOOK-event-sources

Each hookable event is fired by the act or job that causes it, never afterwards from the log.
An act's row in [acts](../access/acts.md) names the events it fires; this is the same matrix
read by event.

| Event | Fired by |
|---|---|
| `request.created` | [ACT-propose](../access/acts.md#proposing), one per item |
| `request.held` | [ACT-propose-approved](../access/acts.md#proposing), why `checking` |
| `request.approved` | [ACT-approve](../access/acts.md#request-review) and *Approve N…*, per ask; the proposal check job for an *approve now* item with no copy ([LC-REQ-approve-now](../lifecycles/request.md#lc-req-approve-now)) |
| `request.declined` | [ACT-decline](../access/acts.md#request-review), per ask; [ACT-project-reject](../access/acts.md#projects), per pending proposal |
| `iteration.ingested` · `iteration.ingest_failed` | the ingest job, after an approval or *Retry failed* ([LC-ITER-ingest](../lifecycles/iteration.md#lc-iter-ingest)) |
| `iteration.verdict_accepted` · `_denied` · `_revoked` | [ACT-accept, ACT-deny, ACT-revoke](../access/acts.md#validation-verdicts) |
| `iteration.restricted` | nothing yet: the restriction checks write their finding but fire no event ([L79](../../ledger.md#l79-iterationrestricted-is-never-fired)) |
| `iteration.reclassified` | [ACT-reclassify](../access/acts.md#iterations); [ACT-category-refine](../access/acts.md#categories), per document moved |
| `iteration.cancelled` | [ACT-cancel](../access/acts.md#iterations) |
| `iteration.not_digitizable` | [ACT-list-not-digitizable](../access/acts.md#digitization-lists) |
| `iteration.listed` | [ACT-list-create, ACT-list-save](../access/acts.md#digitization-lists), per member added |
| `iteration.digitized` | [ACT-list-done](../access/acts.md#digitization-lists), per member |
| `iteration.published` · `iteration.link_added` | [ACT-publish](../access/acts.md#iterations) (the first link publishes); a Publication detector run that finds a link |
| `iteration.link_changed` · `_made_primary` · `_removed` | [ACT-link-replace, ACT-link-primary, ACT-link-remove](../access/acts.md#iterations) |
| `iteration.property_changed` · `document.property_changed` | [ACT-property-enter](../access/acts.md#properties); `document.property_changed` also from a recheck, a relink, or a Catalog adapter run, per catalog value that changed |
| `document.relinked` | [ACT-relink](../access/acts.md#iterations); a Catalog adapter run that names a replacement record ([DOC-relink](../model/documents.md#doc-relink)) |
| `document.registry_changed` | a registry answer that changes the state: the proposal check job, the ingest job, a Check run |
| `list.created` · `list.dates_moved` · `list.deleted` | [ACT-list-create, ACT-list-save, ACT-list-delete](../access/acts.md#digitization-lists) |
| `list.started_early` · `list.started` · `list.marked_done` | see [HOOK-list-transitions](#hook-list-transitions) |
| `run.finished` · `run.failed` | the end of a run, however it was started: a schedule, [ACT-schedule-run, ACT-instance-run, ACT-run-again](../access/acts.md#tasks-and-schedules) |

#### HOOK-condition

A condition narrows which events a hook takes (*category under Periodicals*). It is the filter of
the page that lists the event's subject: Requests for request events, Documents for iteration and
record events, Lists for list events, Tasks for run events. A hook holds at most one per subject
kind, in that page's URL form, edited with its filter chips, as a watchlist is
([UI-filters](../ui/pages.md#ui-filters)). An event is taken when its subject matches the condition for its
kind; a kind with no condition takes every event of the kinds the hook chose.

#### HOOK-recipient

The recipient must suit the channel: a webhook needs an HTTPS URL. A hook may address users
(an email channel only). It then carries a **preference**, a label and a default on or off,
which each recipient may change ([WATCH-hook-preferences](watchlists.md#watch-hook-preferences)).

#### HOOK-batch

Without batching, each event is a delivery sent at once. With batching, events wait for a quiet
gap and are sent together when the gap passes or the maximum wait is reached, whichever comes
first. They are batched per recipient or all together.

#### HOOK-retry

A failed attempt is retried up to the hook's number of attempts (1–10): every 5 minutes when
fixed, or after 1, 2, 4… minutes when growing. A delivery that runs out of attempts **gives up**
and waits for a person to retry or discard it.

#### HOOK-delivery-states

A delivery is waiting, sent, gave up, discarded, or suppressed: a user-addressed delivery the
recipient switched off.

#### HOOK-paused

A paused hook takes no new events and sends nothing; it records who paused it and why.

#### HOOK-channel-off

While its delivery channel is disabled, a hook's deliveries wait. Retrying or sending them needs
the channel back.

#### HOOK-retention

Deliveries and attempts are kept for 30 days.

#### HOOK-test

A draft hook can be previewed (what the message would say, to whom) and test-sent before it is
saved.

## The payload

#### HOOK-payload

Every delivery carries one JSON document: the envelope, and the events it delivers (one, or
several when batched). A webhook or a file receives the document itself; an email or chat
channel renders the hook's message template from the same fields.

```json
{
  "schema": "vera.hook/1",
  "hook": { "id": "H-12", "name": "Scanning starts" },
  "delivery": { "id": "D-3071", "attempt": 1 },
  "events": [{
    "id": "E-88412",
    "type": "list.started",
    "occurredAt": "2026-10-15T06:00:00Z",
    "correlationId": "C-5520",
    "subject": { "kind": "list", "id": "L-2026-015", "url": "https://vera.example/lists/L-2026-015" },
    "changes": [{ "field": "state", "from": "planned", "to": "in_progress" }],
    "cause": {
      "kind": "date",
      "act": null,
      "run": null,
      "actor": { "kind": "system", "id": null, "name": null },
      "reason": { "public": null }
    },
    "list": { "id": "L-2026-015", "name": "Periodicals, October", "starts": "2026-10-15",
              "ends": "2026-10-31", "pages": 18240 },
    "documents": [{
      "catalogId": "MZK01-000123456", "unit": "1923", "title": "Lidové noviny",
      "type": "periodical", "shelfMark": "II-0012.345",
      "identifiers": [{ "type": "issn", "value": "1802-6265" }],
      "pages": 412, "properties": { "binding": "fragile" },
      "iteration": {
        "id": "IT-901", "progress": "planned", "category": "Periodicals / Czech / 1918–1938",
        "priority": "normal", "project": null, "list": "L-2026-015",
        "link": null, "links": []
      }
    }]
  }]
}
```

`type` is the event's code. Every machine value (a state, a decision, a kind) is lowercase
snake case, never the interface's words, which are translated and may change. Times are UTC
with `Z`.

#### HOOK-event-id

An event's `id` is the same on every attempt and in every batch that carries it, so a receiver
can drop what it has seen. `correlationId` is the act's ([LOG-one-act-one-story](../model/log.md#log-one-act-one-story)):
one act that fires several events gives them all the same one.

#### HOOK-change

`changes` says what moved, from what to what: a state, a decision, a date, a property. It is
always a list; an event that moves several fields lists each. `list.created` and
`request.created` have no `from`.

#### HOOK-cause

`cause` says why the event happened:
- **act:** a person or an agent did it; the act's ID and the actor;
- **job:** a plugin run or a schedule did it; the run and its plugin instance;
- **date:** the calendar did it, as when a list's start date arrives; the actor is the system.

`cause` always has every key: `act` is the act's ID and `run` is `{ id, instance: { id, name } }`,
each null when it is not the cause. `actor.kind` is `person`, `agent` or `system`; a staff
actor is named. The actor is never missing ([LOG-actor](../model/log.md#log-actor)). The reason
is the public text the act took, if it took one.

#### HOOK-subject-data

Next to `subject`, the event carries what a receiver needs without calling back:
- an iteration, request or document event: the document (catalog ID, unit, title, type, shelf
  mark, identifiers, page count and its other properties) with its `iteration` as an object:
  category, priority, project, list, `link` (the primary one) and `links` (every link, as
  `{ url, where, primary }`, `where` the instance's name or `"web address"`);
- a list event: the list, and every document on it, each as above, so a delivery plugin can
  turn it into what staff need (a pick list of what to fetch from the stacks);
- a run event: `run` as `{ id, instance: { id, name }, trigger, state, error }`, the error
  public, in place of `documents`.

#### HOOK-private

A payload holds public wording only, unless the hook says otherwise. The internal reason, the
ingest error and who asked are left out by default; with the setting they appear as
`reason.internal`, `error` and `askers: [{ id, name }]`. Including them is a setting on the hook,
which only a holder of `request.read_payload` may switch on, and the hook's page says so.

*Why:* a hook sends outside VERA, to places VERA cannot take back. A reader's name and the
internal reason are personal data.

#### HOOK-schema

`schema` names the payload's version. A field is added within a version, never renamed or
removed; a change that breaks receivers is a new version, and a hook keeps the version it was
made with until somebody moves it.

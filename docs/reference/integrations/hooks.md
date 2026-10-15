# Hooks

Machine messages to a fixed destination when something happens. The acts are in
[acts](../access/acts.md#hooks).

#### HOOK-model

A hook subscribes to one **event**, optionally narrowed by a condition. It sends a message
through one **delivery channel** (a Delivery channel plugin instance: email, chat, webhook or
file) to a recipient, with its own batching and retries.

#### HOOK-events

| Group | Events |
|---|---|
| Requests | `request.created` · `request.decided` · `request.held` |
| Documents | `iteration.ingested` · `iteration.ingest_failed` · `iteration.validated` · `iteration.restricted` · `iteration.cancelled` · `iteration.listed` · `iteration.digitized` · `iteration.published` · `iteration.classified` |
| Records | `document.relinked` · `document.property_changed` · `document.registry_changed` |
| Lists | `list.created` · `list.dates_changed` · `list.started` · `list.done` · `list.deleted` |
| Tasks | `task.failed` · `task.finished` |

#### HOOK-list-transitions

`list.started` fires when a list becomes In progress: on its start date, from the daily job, or
at once on *Start now…*. `list.done` fires on *Mark Done*. A list created to start today fires
`list.created` and `list.started` together. `list.dates_changed` still fires for every date
change, *Start now…* included.

*Why:* a list's state follows its date and is never written
([LC-LIST-state](../lifecycles/list.md#lc-list-state)), so nothing would otherwise mark the
moment the scanning operation should begin.

> **Open — [L33](../../ledger.md#l33-hook-events).** The mock fires only `iteration.published`
> and `list.created`. The engine has to fire every event from the act or job that causes it, and
> the [acts](../access/acts.md) need a column naming them.

#### HOOK-condition

A condition narrows which events a hook takes (*category under Periodicals*).

> **Open — [L33](../../ledger.md#l33-hook-events).** Conditions are free text, and the mock
> accepts only two phrases. They need a typed condition builder.

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
  "events": [
    {
      "id": "E-88412",
      "type": "list.started",
      "occurredAt": "2026-10-15T08:00:00+02:00",
      "correlationId": "C-5520",
      "subject": { "kind": "list", "id": "L-2026-015", "url": "https://vera.example/lists/L-2026-015" },
      "change": { "field": "state", "from": "planned", "to": "in_progress" },
      "cause": {
        "kind": "act",
        "act": "ACT-list-start",
        "actor": { "kind": "person", "id": "U-7", "name": "Jana Nováková" },
        "reason": { "public": null }
      },
      "list": { "name": "Periodicals, October", "starts": "2026-10-15", "ends": "2026-10-31", "pages": 18240 },
      "documents": [
        { "iteration": "IT-901", "catalogId": "MZK01-000123456", "unit": "1923", "title": "Lidové noviny",
          "shelfMark": "II-0012.345", "pages": 412, "category": "Periodicals / Czech / 1918–1938" }
      ]
    }
  ]
}
```

#### HOOK-event-id

An event's `id` is the same on every attempt and in every batch that carries it, so a receiver
can drop what it has seen. `correlationId` is the act's ([LOG-one-act-one-story](../model/log.md#log-one-act-one-story)):
one act that fires several events gives them all the same one.

#### HOOK-change

`change` says what moved, from what to what: a state, a decision, a date, a property. An event
that moves several fields lists each. `list.created` and `request.created` have no `from`.

#### HOOK-cause

`cause` says why the event happened:
- **act:** a person or an agent did it; the act's ID and the actor;
- **job:** a plugin run or a schedule did it; the run and its plugin instance;
- **date:** the calendar did it, as when a list's start date arrives; the actor is the system.

The actor is never missing ([LOG-actor](../model/log.md#log-actor)). The reason is the public
text the act took, if it took one.

#### HOOK-subject-data

Next to `subject`, the event carries what a receiver needs without calling back:
- an iteration, request or document event: the document (catalog ID, unit, title, type, shelf
  mark, identifiers, page count and its other properties) and the iteration's category, priority,
  project, list and link;
- a list event: the list, and every document on it, each as above, so a delivery plugin can
  turn it into what staff need (a pick list of what to fetch from the stacks);
- a task event: the run, its plugin instance, trigger and public error.

#### HOOK-private

A payload holds public wording only, unless the hook says otherwise. The internal reason, the
log detail and who asked are left out by default. Including them is a setting on the hook,
which only a holder of `request.read_payload` may switch on, and the hook's page says so.

*Why:* a hook sends outside VERA, to places VERA cannot take back. A reader's name and the
internal reason are personal data.

#### HOOK-schema

`schema` names the payload's version. A field is added within a version, never renamed or
removed; a change that breaks receivers is a new version, and a hook keeps the version it was
made with until somebody moves it.

> **Open — [L49](../../ledger.md#l49-hook-payload).** The payload is a draft, not built: the
> mock sends only a sample text. The field names are open.

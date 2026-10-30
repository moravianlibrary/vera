# DEC-0018: One event catalogue, taken in part by the log, hooks and an audit stream

**Context.** The log's events were free text, matched by prefix for the public wording
([L23](../ledger.md#l23-event-codes)); the hooks had event names of their own, coarser than the
log's ([L33](../ledger.md#l33-hook-events)); the payload's field names were a draft
([L49](../ledger.md#l49-hook-payload)); and what an admin changes (access, categories,
intentions, mixes, plugins, hooks, schedules) was recorded nowhere
([L7](../ledger.md#l7-access-and-planning-changes-are-not-logged)). The engine needs all four
settled before it builds asking and deciding (E5 in [engine.md](../develop/engine.md)).

**Decision.**
- **One catalogue** of event codes is the authority
  ([EVENT-catalogue](../reference/model/events.md#event-catalogue)). Three destinations take
  part of it, and none takes all: History (the log), hooks and the Audit stream
  ([EVENT-destinations](../reference/model/events.md#event-destinations)). A hook subscribes to
  the catalogue's own codes, so `request.decided` gives way to `request.approved` and
  `request.declined`, and a hook may subscribe to several codes
  ([HOOK-model](../reference/integrations/hooks.md#hook-model)).
- **A derived code** goes to hooks only: `list.started` on the start date is in the catalogue,
  hookable, and never logged, which keeps [DEC-0004](DEC-0004-log-causes-not-derivations.md)
  ([EVENT-derived](../reference/model/events.md#event-derived)).
- **An event holds data, not sentences**: a code, typed data and the two reasons; the client
  words it in the reader's language, and a code either has a public wording or is never shown
  to a requester ([EVENT-shape](../reference/model/events.md#event-shape),
  [EVENT-wording](../reference/model/events.md#event-wording)). Three codes gain one:
  *Asked*, *Withdrawn*, *Could not be digitized*.
- **Admin changes go to an Audit stream in ClickStack**, not to History cards: one more
  OpenTelemetry stream beside those of [DEC-0017](DEC-0017-observability.md), read in HyperDX,
  where admins build their own dashboards and VERA ships some ready-made
  ([OBS-audit](../reference/integrations/observability.md#obs-audit)). It takes every cause,
  domain events included, so one dashboard can follow a project and its requests. Unlike the
  other streams it is kept for ever, names staff by their display name, and is not lost when
  the collector is down: each record is written beside the change and sent until accepted
  ([OBS-audit-delivery](../reference/integrations/observability.md#obs-audit-delivery)). This
  amends [OBS-who](../reference/integrations/observability.md#obs-who) and
  [OBS-retention](../reference/integrations/observability.md#obs-retention) for this stream
  alone.
- **The payload** `vera.hook/1` uses the codes as `type`, `changes` as a list, machine values in
  lowercase snake case, times in UTC with `Z`, and keeps the acting staff member's name; who
  asked stays behind [HOOK-private](../reference/integrations/hooks.md#hook-private).
- No hook takes an admin change, for now: the catalogue lets one be marked hookable later
  within `vera.hook/1`.

**Rejected.**
- The log's codes as the authority, hooks taking a subset: a derived event would have to be
  logged or have no code.
- Separate hook event names mapped from several log codes: two vocabularies to keep in step,
  and a receiver could not tell an approval from a decline by its type.
- A *History* card on every admin page, or an Audit page in VERA: built and maintained per
  record kind, while ClickStack already searches, filters and charts across all of them.
- The Audit stream under the other streams' rules: 30 days and user ids only would make it no
  audit trail; an id is unreadable on a dashboard that cannot look names up in VERA.
- Sending audit records like the other telemetry, best effort: a collector outage would leave a
  gap in the one record that must have none.

**Rules.** [EVENT-catalogue](../reference/model/events.md#event-catalogue) and the rules after
it; [OBS-audit](../reference/integrations/observability.md#obs-audit),
[OBS-audit-delivery](../reference/integrations/observability.md#obs-audit-delivery);
[HOOK-events](../reference/integrations/hooks.md#hook-events),
[HOOK-payload](../reference/integrations/hooks.md#hook-payload).

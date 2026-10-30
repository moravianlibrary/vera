# Observability

How VERA is watched in operation: what each part records, where it goes, and what it never
records. Decided in [DEC-0017](../../decisions/DEC-0017-observability.md); the Audit stream in
[DEC-0018](../../decisions/DEC-0018-one-event-catalogue.md).

#### OBS-pipeline

Every part sends OpenTelemetry (OTLP) to one collector: the Java application and its workers,
the reverse proxy, and the browser client. The collector writes to ClickHouse; HyperDX reads it
there. Nothing in VERA talks to ClickHouse or HyperDX directly, so either can be replaced behind
the collector. Without a configured endpoint, a part records nothing and runs as before.

#### OBS-streams

| Stream | From | What it holds |
|---|---|---|
| Access | the proxy and the application's HTTP server | method, route template (`/iterations/:id`, never the filled path), status, duration, size, the caller's user id, the trace id |
| Application | the application and each worker | structured logs, level, the trace id, and the act (`ACT-approve`), job or plugin run they belong to |
| Traces | the application and workers | a request through its acts, the jobs it queues and each plugin call, with the instance and its outcome (*answered*, *unavailable*, *refused*) |
| Client | the browser client | page views by route template, the act chosen, errors with the crash page's reference, slow answers, web vitals, the display tier |
| Audit | the application | every cause from the [event catalogue](../model/events.md), with what changed ([OBS-audit](#obs-audit)) |

#### OBS-trace-through

A trace follows the work across parts: the client's request carries its trace context to the
application, a job keeps the context of the act that queued it, and a plugin call is a span of
its run. The crash page's reference ([G-STATE-2](../../../frontend/ui-gates.md)) is recorded with
the error, so it finds the trace.

#### OBS-who

A record names a person only by their user id, and only a person who holds a role beyond
*reader*. A reader and anyone not logged in are recorded without an id. Names, emails,
identities, request reasons, message texts, notes and record contents are never recorded, in any
stream; nor are tokens, cookies or the values of plugin secrets. The Audit stream alone may name
staff by display name ([OBS-audit](#obs-audit)).

#### OBS-no-replay

The client records no session replay and no keystrokes. What a person sees is reconstructed from
the route and the act, not from the screen.

#### OBS-retention

Access, application and trace records are kept 30 days. Client usage is kept 13 months, then only
its daily counts per route and act. Audit records are kept for ever.

#### OBS-audit

The Audit stream is the record of who changed what in VERA, read and charted in HyperDX; VERA
has no audit page of its own. A record holds:
- the event's code, subject kind and id, time and correlation ID ([EVENT-shape](../model/events.md#event-shape));
- what changed, field by field, from and to; a plugin secret as changed, never its value;
- the actor: a staff member by user id and display name, an agent or the system; a reader
  without id or name;
- the trace id, so a record leads to the request that caused it.

Never a reason, a message text, a note or a reader's name: a reader appears only as a subject's
id. VERA ships ready-made dashboards for it (changes to access, a plugin instance's settings over
time, a project and its requests); admins may make their own.

*Why:* admin changes need an audit trail, and every one of them would otherwise need its own
history view in VERA. ClickStack already searches, filters and charts across all of them.

#### OBS-audit-delivery

An audit record is written to the application's database in the same transaction as the change,
and a job sends it to the collector, retrying until the collector accepts it; only then is it
removed. The collector writes audit records to their own table, with no expiry.

*Why:* the other streams are best effort and drop records while the collector is down; an audit
trail must have no gaps.

#### OBS-engine

The engine sends the same streams when given an endpoint, so the pipeline and HyperDX can be
tried against the fake engine and its simulation before the Java application exists.

> **Built** for the engine ([L72](../../ledger.md#l72-observability)): API calls, jobs and Identity
> plugin calls. The Java application's agent waits on the backend.

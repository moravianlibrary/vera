# Observability

How VERA is watched in operation: what each part records, where it goes, and what it never
records. Decided in [DEC-0017](../../decisions/DEC-0017-observability.md).

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

#### OBS-trace-through

A trace follows the work across parts: the client's request carries its trace context to the
application, a job keeps the context of the act that queued it, and a plugin call is a span of
its run. The crash page's reference ([G-STATE-2](../../../frontend/ui-gates.md)) is recorded with
the error, so it finds the trace.

#### OBS-who

A record names a person only by their user id, and only a person who holds a role beyond
*reader*. A reader and anyone not logged in are recorded without an id. Names, emails,
identities, request reasons, message texts, notes and record contents are never recorded, in any
stream; nor are tokens, cookies or the values of plugin secrets.

#### OBS-no-replay

The client records no session replay and no keystrokes. What a person sees is reconstructed from
the route and the act, not from the screen.

#### OBS-retention

Access, application and trace records are kept 30 days. Client usage is kept 13 months, then only
its daily counts per route and act.

#### OBS-engine

The engine sends the same streams when given an endpoint, so the pipeline and HyperDX can be
tried against the fake engine and its simulation before the Java application exists.

> **Built** for the engine ([L72](../../ledger.md#l72-observability)): API calls, jobs and Identity
> plugin calls. The Java application's agent waits on the backend.

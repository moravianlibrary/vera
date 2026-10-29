# DEC-0017: VERA is observed through OpenTelemetry, into ClickHouse, read in HyperDX

**Context.** The old VERA kept its task runs and nothing else: no access log beyond the proxy's,
no structured application logs, no record of how people use the client. Its failures were slow
and clustered (a catalog answering 500, a registry sync hanging for hours, see
[prod-profile.md](../develop/prod-profile.md)), which is what traces across requests, jobs and
plugin calls show and logs alone do not. The new client is built to be used; whether it is, and
where people stop, is the question the library will ask.

**Decision.** Every part sends OpenTelemetry to one collector, which writes to ClickHouse; HyperDX
is the interface ([OBS-pipeline](../reference/integrations/observability.md#obs-pipeline)). Four
streams: access, application, traces, client usage
([OBS-streams](../reference/integrations/observability.md#obs-streams)). Staff are recorded by
user id, readers and visitors without one, and no content or personal data in any stream
([OBS-who](../reference/integrations/observability.md#obs-who)). No session replay
([OBS-no-replay](../reference/integrations/observability.md#obs-no-replay)).

**Rejected.**
- Each part writing to ClickHouse itself: the store would be fixed in four codebases.
- Session replay: the screens hold readers' names, request reasons and messages; masking them
  reliably is harder than not recording them.
- An analytics service outside the library (Google Analytics and the like): readers' use would
  leave the library's infrastructure.
- Recording readers by id: knowing which reader asked is the application's own data; usage only
  needs counts.

**Rules.** [OBS-pipeline](../reference/integrations/observability.md#obs-pipeline) and the rules
after it. Not built ([L72](../ledger.md#l72-observability)).

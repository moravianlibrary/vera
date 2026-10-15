# DEC-0004: The log records causes, never derivations

**Context.** Much of what changes in VERA follows from something else: a list goes In progress on
its start date, a badge changes when a verdict is given. Logging those as events makes a second
source of truth that can disagree with the first.

**Decision.** One append-only log across entities records causes only: who did what, when, and
why. Its actor is never null: a person, an agent or the system. One act writes one entry per
subject, sharing a correlation ID. A requester reads a public version.

**Rejected.** A log per entity; logging every derived state change.

**Rules.** [LOG-cause](../reference/model/log.md#log-cause),
[LOG-actor](../reference/model/log.md#log-actor),
[LOG-one-act-one-story](../reference/model/log.md#log-one-act-one-story).

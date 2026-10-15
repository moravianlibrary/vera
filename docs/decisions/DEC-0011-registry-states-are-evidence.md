# DEC-0011: Registry states are evidence, not status

**Context.** Other registries (Kramerius, RDCZ) say whether a document is planned, digitized or
published elsewhere. Treating that as VERA's status, or as a gate, lets an outside system block
or move VERA's work.

**Decision.** A registry state is an observation, kept with when it was seen. *Not found*, *never
checked* and *check failed* are three different things. A copy elsewhere blocks nothing: it is
news for whoever decides, and approving over it is a rescan with a note.

**Rejected.** Eligibility derived from registries; a registry finding as a restriction.

**Rules.** [REG-evidence](../reference/integrations/registries.md#reg-evidence),
[REG-states](../reference/integrations/registries.md#reg-states),
[REG-copy-not-gate](../reference/integrations/registries.md#reg-copy-not-gate).

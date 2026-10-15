# DEC-0001: A status is four stored axes and one derived badge

**Context.** An item can at once be approved, forbidden by a rule, waiting for review of its
metadata, and on a list. A single status enum has to name every combination, and every act has
to know all of them.

**Decision.** Store four independent axes (decision, restriction, validation, progress) and a
hold. Derive the one badge a row shows by a fixed precedence. A requester reads a coarser public
status.

**Rejected.** One status enum, as the old system had. Eligibility as a stored fifth axis, retired
because *already digitized elsewhere* is news for whoever decides, not an obstacle.

**Rules.** [STAT-axes](../reference/model/status.md#stat-axes),
[STAT-badge](../reference/model/status.md#stat-badge),
[STAT-public](../reference/model/status.md#stat-public).

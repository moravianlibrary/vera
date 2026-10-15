# DEC-0012: Some relationships deliberately do not exist

**Context.** Several links look natural and were assumed by older specifications: a document's
category, a document's project, a project's categories, a group's roles.

**Decision.** They do not exist. Classification and funding are per attempt; a project reaches
the tree only through its intention; capability reaches a person only as a role they hold. A view
that needs one of these links is built on a join with no answer.

**Rejected.** Category and project as document fields; group roles; nested groups.

**Rules.** [REL-not-related](../reference/model/relationships.md#rel-not-related),
[REL-per-attempt](../reference/model/relationships.md#rel-per-attempt).

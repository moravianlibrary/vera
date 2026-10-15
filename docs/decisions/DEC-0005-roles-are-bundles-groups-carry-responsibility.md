# DEC-0005: Roles are bundles; groups carry responsibility, not roles

Decided 2026-09-26.

**Context.** Access has three questions: what may I do, who do I sit with, and what may I do it
to. Folding them together either copies a permission list into every team, or lets capability
arrive as a side effect of joining a team.

**Decision.**
- A **role** is a bundle of grants, each a permission at a scope. Roles are not a ladder, and a
  person's grants are the union of their roles'. Roles are held by people, by hand or mapped from
  an identity provider.
- A **group** gives custody and project membership, never a role.
- Self-scoped permissions are still grants, so an empty account sees nothing and a
  misconfiguration is noticed at once.

**Rejected.** Group roles; a deny rule or precedence order; unconditional "own records" access.

**Rules.** [ROLE-bundle](../reference/access/roles.md#role-bundle),
[ACCESS-group](../reference/access/people.md#access-group),
[PERM-self-scoped](../reference/access/permissions.md#perm-self-scoped).

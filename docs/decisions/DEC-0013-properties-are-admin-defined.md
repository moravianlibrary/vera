# DEC-0013: Properties are defined by an admin, typed, and sourced

Replaces [DEC-0003](DEC-0003-properties-are-not-columns.md).

**Context.** Lists are to be built and generated over any filter, and intentions scoped by
facts such as a document's size or the machine an attempt is scanned on. DEC-0003 kept the page
count per source with tiers, but every other fact was a fixed field, and only a plugin could
supply a property, so a fact nobody's plugin knows could not be entered at all.

**Decision.** An admin defines each property: a key that never changes, a name in each UI
language, a public or staff visibility, a type (text, number with a unit, yes/no, date, enum, or
a list of these), and whether it is about the document or one attempt. Every value has a source,
a person or a plugin instance (the catalog adapter is one), with a tier, when it was observed
and who set it. The highest tier with a value is in use, and every source stays visible. A
definition says whether a person may enter it by hand and at which tier, and each property has
its own permission to do so, at `any` only. Each type gives its filter wherever the property
shows, and an intention's scope can add conditions on properties. Deleting a definition removes
everything that names it.

**Rejected.**
- One column per fact, overwritten by whoever wrote last (rejected in DEC-0003 too).
- Properties that only a plugin declares: a library could not add a fact of its own.
- One permission for entering every property: a role could not be given one fact and not
  another.
- A read permission per property: a visibility on the definition says the same with less to
  grant.

**Rules.** [DOC-property](../reference/model/documents.md#doc-property),
[DOC-property-values](../reference/model/documents.md#doc-property-values),
[DOC-property-hand](../reference/model/documents.md#doc-property-hand),
[DOC-property-filter](../reference/model/documents.md#doc-property-filter),
[DOC-property-delete](../reference/model/documents.md#doc-property-delete),
[DOC-property-predefined](../reference/model/documents.md#doc-property-predefined),
[PERM-property-edit](../reference/access/permissions.md#perm-property-edit),
[PLAN-scope](../reference/planning/intentions.md#plan-scope). Built in the frontend
([L22](../ledger.md#built-2026-10-16)).

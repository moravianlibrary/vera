# DEC-0007: Navigation is one flat list, without counts

**Context.** A grouping of the sidebar entries (Work, Plan, Operate, Configure) was tried. Record
counts on entries were considered.

**Decision.** The sidebar is one flat list in a fixed order, without groups, dividers or counts.
The only number on an entry is the count of its watchlists with something new. An entry a person
cannot open is absent.

**Rejected.** The grouped taxonomy: nobody looks for a page by its group. Record counts: they say
how much exists, not what needs attention.

**Rules.** [UI-flat-sidebar](../reference/ui/navigation.md#ui-flat-sidebar),
[UI-badge](../reference/ui/navigation.md#ui-badge),
[VIEW-entry-requires](../reference/access/views.md#view-entry-requires).

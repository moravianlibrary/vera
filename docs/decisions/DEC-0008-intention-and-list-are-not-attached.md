# DEC-0008: An intention and a list are related by derivation, never attached

**Context.** A list generated for an intention looks like it belongs to it. But one item counts
towards several intentions at once, and a list can be edited after it was generated.

**Decision.** Nothing is attached to an intention. What a list counts towards is worked out from
its members and its start date. A generated list records the intention, mix and generator that
shaped it, as provenance only.

**Rejected.** Lists or items attached to an intention.

**Rules.** [REL-list-provenance](../reference/model/relationships.md#rel-list-provenance),
[PLAN-counting](../reference/planning/intentions.md#plan-counting).

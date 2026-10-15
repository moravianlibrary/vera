# DEC-0002: A size tier is a display, not a column count

**Context.** Tiers were first built as column counts with one type scale: notebook was large
minus columns, and small was a cropped notebook. Nothing fitted anything.

**Decision.** A tier is a display. Everything is sized in `rem`, so the root size is the one
setting that changes. Small and phone keep the type size and let the layout give way; large steps
the type back so its room shows more. Notebook is designed first.

**Rejected.** Scaling type with the width; designing large first.

**Rules.** [UI-tiers](../reference/ui/tiers.md#ui-tiers),
[UI-tier-is-a-display](../reference/ui/tiers.md#ui-tier-is-a-display).

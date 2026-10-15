# Catch up on an intention that is behind

**Who.** A digitization curator: Martin Svoboda.

**Goal.** "NDK Periodika is behind pace; generate a list that catches up, in the right
proportions."

**Starting state.** A running intention with a page target and a mix, behind pace. A rule-based
List generator is enabled.

## Steps

1. On *Intentions* he sees the intention *behind pace*, with the pages a week it needs
   ([PLAN-target](../../reference/planning/intentions.md#plan-target)).
2. He opens *Generate* from it.
   → The pages are pre-filled with what catching up needs, and the intention shapes the list
   ([PLAN-catch-up](../../reference/planning/intentions.md#plan-catch-up)).
3. He generates.
   → A draft fills each leaf's share, highest priority first, then the oldest ask. A shortfall
   is spread to the nearest categories and reported with its reason
   ([PLAN-generate-mix](../../reference/planning/generation.md#plan-generate-mix)).
4. He removes two items from the draft and saves it as a list.
   → The list records the generator, the intention and the mix revision
   ([PLAN-generate-provenance](../../reference/planning/generation.md#plan-generate-provenance)).
5. Back on *Intentions*, the planned figure has grown; the list is counted, not attached
   ([PLAN-counting](../../reference/planning/intentions.md#plan-counting)).

## Rules

[PLAN-generate](../../reference/planning/generation.md#plan-generate) ·
[PLAN-generate-pool](../../reference/planning/generation.md#plan-generate-pool) ·
[REL-list-provenance](../../reference/model/relationships.md#rel-list-provenance)

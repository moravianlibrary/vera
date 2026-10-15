# Intentions

What an intention counts, and how its progress reads. Its lifecycle is in
[lifecycles/intention](../lifecycles/intention.md).

#### PLAN-intention

An intention is a scope and an objective, never a container. Nothing is attached to it: an item
counts towards every intention whose scope it matches.

#### PLAN-scope

An item is in an intention's scope when both hold:
- **funding** matches: *any*, or *none* (no project), or one named project;
- **category** matches: the scope is one node and everything below it, or the whole tree.

> **Open — [L22](../../ledger.md#l22-properties).** A scope may also add conditions on document
> and attempt properties (*machines include Zeutschel*), once properties are built.

#### PLAN-counting

Three figures, each in pages:

| Figure | What it counts |
|---|---|
| **Planned** | items in scope on a list that still exists and starts within the window; a cancelled item only if it was delivered anyway |
| **Delivered** | the planned items digitized within the window |
| **Output** | every item in scope digitized within the window, whenever it was planned |

Windows include their first and last day. *Planned* and *delivered* are never added together,
and figures of different intentions are never added: they overlap.

#### PLAN-digitized-date

An item's digitized date is the day its list was marked Done: only *Mark Done* makes an item
Digitized. A list past its end date has delivered nothing until it is marked Done. An item with
no page count is counted and shown as having no pages to add.

> **Open — [L29](../../ledger.md#l29-only-mark-done-digitizes).** The code still falls back to
> the list's last day for an item with no recorded date.

#### PLAN-target

With a page target an intention has progress, read as one of:
- **on pace** or **behind pace**, while it runs, with a ten-point slack;
- **target met** or **short**, once it ends;
- **fully planned**, when what is planned already covers the target.

Pace is a straight line from start to end, never a forecast. An open-ended intention has no pace:
it is at most fully planned or met.

#### PLAN-catch-up

For an intention behind pace, the page count a list would need to catch up with an even pace is
offered when generating ([PLAN-generate](generation.md#plan-generate)).

#### PLAN-fill

With a target and a mix, each leaf of the scope has its share of the target. A leaf whose
planned pages fall under 95% of that share reads as **short**.

#### PLAN-overall

Overall counts everything, from the reporting baseline, with no end and no target. It is the
default shape for generating, and the yardstick output is measured against.

#### PLAN-mix-reading

With a mix, each category of the mix reads its intended share, its share of what is planned, its
share of the output, and the drift between intended and output
([PLAN-mix-flags](mixes.md#plan-mix-flags)).

#### PLAN-house-mix

The house mix (Overall's) shows on Categories to anyone with `mix.read`.

> **Open — [L30](../../ledger.md#l30-house-mix-needs-only-mixread).** Today it also needs
> `intention.read`.

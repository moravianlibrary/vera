# VERA — Design

The redesign is driven by **demos**. A demo is the artifact; a document here
exists only to record a decision the demos cannot show on their own — an
ordering, a derivation, a thing that deliberately does *not* exist.

If a document and a demo disagree, that is a bug in one of them, not a
difference of opinion.

---

**Start with `design/shared/entities/concepts.md`** — what a document, category,
project, intention, distribution, request and list each *are*, and who each one
is for. Everything else below describes mechanism and assumes you have read it.

## What is decided

| | Where | Decides |
|---|---|---|
| **Concepts** | `design/shared/entities/concepts.md` | what each thing is, why it exists, who it is for |
| **Stack** | `demos/rework.md` § Stack | Tailwind + shadcn, Java Spring backend, Java plugins |
| **Palette** | `demos/rework.md` § Palette | one shadcn preset |
| **Size tiers** | `design/shared/view-rules.md` | large ≥1600 · notebook 1280–1599 · small 768–1279 · phone <768 |
| **Status** | `design/shared/entities/status-model.md` | four stored axes, one derived badge |
| **Model** | `design/shared/entities/relationships.md` | every relationship, and the ones that must not exist |
| **Pages** | `design/shared/view-map.md` | five stage views in front, entity pages behind |
| **Navigation** | `design/shared/navigation.md` | the 14 sidebar entries, per tier; Home |
| **Views** | `design/shared/view-catalog.md` | per view: columns, controls, and what is deliberately absent |
| **Surfaces** | `design/shared/page-composition.md` | per page: index, detail, editors, wizards, dialogs; what is routed |
| **View quality** | `design/shared/view-rules.md` | point budgets, filtering, search, actors, actions |
| **Identity** | `design/shared/entities/document-identity.md` | catalog ID + optional unit ID; where units come from |
| **Properties** | `design/shared/entities/document-properties.md` | typed, plugin-supplied, tier-resolved |
| **Priority** | `design/shared/entities/priority-levels.md` | four-value enum on the iteration |
| **Permissions** | `design/shared/entities/permissions.md` | roles on users; groups grant scope; grants are permission + scope |
| **Registries** | `design/shared/entities/registry-status.md` | VERA / Kramerius / RDCZ as evidence, feeding eligibility |
| **History** | `design/shared/entities/status-log.md` | one append-only log; causes, not derivations |
| **Planning** | `design/shared/entities/intentions.md` | recursive category shares; shared distributions; 3 kinds of intention |

`design/manifest.yaml` is the machine-readable index of the same list.

## What is being worked on

| | Where |
|---|---|
| **The demos** — 14 pages × 4 tiers | `demos/index.html` · state in `demos/BUILD.md` |
| Client views — navigation, home, per-view content | `demos/rework.md` § Client views |
| Running notes, per-view findings | `demos/notes.md` |

`demos/*.html` at the top level are the **original** demos and are not edited —
they are the reference the rework is measured against.

## What is deferred, and marked in place

Grep for these; each one sits next to the decision it blocks.

| Marker | Topics |
|---|---|
| `TODO(Plugins)` | what identifies a defect, and keeping that key stable across versions · which plugin resolves which identifier type · agent identity for harvested documents · registry state → eligibility mapping · who assigns property tiers |
| `TODO(Tenancy)` | more than one library in one VERA — deferred until the views exist. Category root is the cheap boundary; document identity across libraries is the real decision; identifier patterns and adapter config are global today and per-library in reality |

Neither model is written yet. Both are large enough to deserve their own
document, and small enough in their effect on the views that the views can be
drawn first.

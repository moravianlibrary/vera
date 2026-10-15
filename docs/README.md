# VERA documentation

VERA decides **what gets digitized next**, and keeps track of why. These documents say what it
does, for whom, and why it was built that way. The shape of the documentation is settled in
[structure](structure.md).

## Who reads what

| You are | Start with |
|---|---|
| Anyone new to VERA | [entities](reference/model/entities.md), then the [glossary](glossary.md) |
| Deciding how VERA should behave | the [reference](reference/README.md), the [ledger](ledger.md) of open questions, the [decisions](decisions/README.md) |
| Testing or demonstrating it | the [user journeys](user-journeys/README.md) |
| Building the engine | the [engine plan](develop/engine.md), then the reference |
| Building the frontend | the reference, the user journeys, and the ledger's *Not built yet* |
| An AI agent | [AGENTS.md](AGENTS.md) |

The user and admin guides (`guide/`) are written once the engine runs every user journey.

## What is where

| | |
|---|---|
| [reference/](reference/README.md) | every rule, once, under a stable ID: the model, lifecycles, planning, access, integrations, UI |
| [ledger.md](ledger.md) | where the reference and the code disagree, and the questions waiting for a decision |
| [glossary.md](glossary.md) | every domain term, in English and Czech |
| [decisions/](decisions/README.md) | the larger choices, `DEC-0001` on, with what was rejected |
| [user-journeys/](user-journeys/README.md) | what each role does, step by step, citing the rules; they become the acceptance tests |
| [develop/](develop/engine.md) | for developers: the engine plan now; architecture, API, styling, writing, i18n, testing and conventions later |
| [tools/](tools/docs.ts) | `make docs` writes the generated tables; `make docs-check` checks IDs, links and tables |

## Older material

`design/`, `permissions/`, `access/`, `workflows/`, `user-journey/` and `demos/` hold the
material the reference was drafted from. They stay until the frontend and these documents are
complete, then go, except for what survives as decisions. Where they disagree with the
reference, the reference is right or the ledger says why not.

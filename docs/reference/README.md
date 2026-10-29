# Reference

The rules VERA follows, each stated once. Guides, user journeys, code comments and tests cite
a rule by its ID and do not restate it. The reference describes VERA as built. Where the code
and an earlier decision disagree, the disagreement is entered in [the ledger](../ledger.md)
rather than smoothed over here.

| Area | Files |
|---|---|
| Model | [entities](model/entities.md) · [relationships](model/relationships.md) · [documents](model/documents.md) · [status](model/status.md) · [log](model/log.md) |
| Lifecycles | [request](lifecycles/request.md) · [iteration](lifecycles/iteration.md) · [list](lifecycles/list.md) · [project](lifecycles/project.md) · [intention](lifecycles/intention.md) |
| Planning | [categories](planning/categories.md) · [mixes](planning/mixes.md) · [intentions](planning/intentions.md) · [generation](planning/generation.md) |
| Access | [permissions](access/permissions.md) · [scopes](access/scopes.md) · [roles](access/roles.md) · [people](access/people.md) · [custody](access/custody.md) · [views](access/views.md) · [acts](access/acts.md) |
| Integrations | [plugins](integrations/plugins.md) · [registries](integrations/registries.md) · [hooks](integrations/hooks.md) · [messaging](integrations/messaging.md) · [watchlists](integrations/watchlists.md) · [observability](integrations/observability.md) |
| UI | [tiers](ui/tiers.md) · [navigation](ui/navigation.md) · [pages](ui/pages.md) |

Terms in English and Czech are in the [glossary](../glossary.md); the reasons behind the larger
choices are in [decisions](../decisions/).

**Open questions** are marked where they arise, as a quoted *Open* line linking to the
[ledger](../ledger.md), which lists every one.

## Rule IDs

A rule is a heading whose whole text is its ID: an area prefix and a short slug, such as
`ROLE-union` or `ACCESS-last-manager`. In a table of many small rules (the acts), a row whose
first cell is the ID in backticks defines it instead. The text under it is one to three sentences, and then its
reason when the reason is not obvious. Slugs are never renumbered, and a removed rule's ID is
not reused.

| Prefix | Where |
|---|---|
| `ENT`, `REL` | `model/entities.md`, `model/relationships.md` |
| `DOC`, `STAT`, `LOG` | `model/documents.md`, `model/status.md`, `model/log.md` |
| `LC-REQ`, `LC-ITER`, `LC-LIST`, `LC-PROJ`, `LC-INT` | `lifecycles/` |
| `PLAN` | `planning/` |
| `PERM`, `SCOPE`, `ROLE`, `ACCESS`, `VIEW`, `ACT` | `access/` |
| `PLG`, `REG`, `HOOK`, `MSG`, `WATCH`, `OBS` | `integrations/` |
| `UI` | `ui/` |
| `DEC` | `../decisions/`: four digits, the start of the record's file name, such as `DEC-0008` |

**To cite a rule:**
- in code, write the ID in the comment: `// ACCESS-last-manager`;
- in a test, put it in the test's name;
- in a user journey, list it under *Rules*.

A link reads `[ACCESS-last-manager](access/people.md#access-last-manager)`.

## What is generated

Tables between `<!-- generated:… -->` markers are written by `make docs` from the frontend's
code. Do not edit them by hand. `make docs-check` fails when one is stale, when an ID is defined
twice, when code or docs cite an ID nobody defined, or when a relative link points nowhere.

| Block | Source |
|---|---|
| `permission-catalog` | `domain/src/permissions.ts` (`permissionCatalog`), with the lines from the access messages in `frontend/src/i18n/locales/en/access.json` |
| `permission-requires` | `domain/src/permissions.ts` (`permissionRequires`) |
| `role-grants`, `role-limits` | the shipped roles in `frontend/src/mocks/fixtures/access.ts` |
| `sidebar` | `frontend/src/components/layout/navigation.ts`, with each shipped role's grants |
| `page-filters` | each page's view definition in `frontend/src/features/*/…-view.ts` |
| `page-columns` | each list's exported column definitions in `frontend/src/features/*/` (`staffDocumentColumns`, `requestColumns`, `runColumns` and the rest) |

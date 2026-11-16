# Documentation structure

Settled 2026-10-14. The engine of step 4 was retired on 2026-11-16 for the Java backend
([DEC-0023](decisions/DEC-0023-the-engine-is-retired.md)). This is part 1 of the docs phase: the final shape of VERA's
documentation, the rules it follows, and where each existing document ends up.

The phase, in order:

1. this structure;
2. the reference (entities, relationships, permissions, roles, views and acts);
3. user journeys;
4. the engine (Bun + SQLite), built to pass every user journey;
5. styling and writing (info texts, i18n);
6. coding conventions.

The user and admin guides are written after the engine, once the user journeys run. The Java
backend comes after.

## 1. Principles

- **One source per rule.** A rule (a permission, a transition, a limit) is stated once, in the
  reference, under a stable ID. Guides, user journeys, code comments and tests cite the ID; they
  do not restate the rule.
- **The reference describes VERA as built,** not as once proposed. It is drafted from the
  frontend and the engine. When a refinement changes a rule, the change is entered in
  `ledger.md` until the code follows.
- **Generated where the code is the source.** The permission catalog, role grants and the
  view-access matrix are tables produced from `domain/src`. A check fails when a
  table and the code disagree.
- **Decisions keep their reasons; nothing else keeps history.** When the old material is
  removed, the decisions worth keeping survive as short records in `decisions/`. Everything
  else is in git.
- **English, Markdown, Mermaid.** No site generator. The UI ships in Czech (primary in
  production) and English, so `glossary.md` gives every domain term in both languages.

## 2. The tree

```
docs/
  README.md             entry by audience: who reads what
  AGENTS.md             agent router: where each rule lives, the never-list, the workflow
  glossary.md           every domain term: English, Czech, one-line meaning, reference link
  ledger.md             refinements waiting for the code (doc change → code change → done)

  reference/            the rules, with IDs; read by everyone
    README.md           the ID scheme, how to cite, what is generated
    model/
      entities.md       each entity: what it is, who it is for, the fields that matter
      relationships.md  the ER diagram, cardinalities, relationships that must not exist
      documents.md      identity, unit IDs, identifier types, properties and tiers
      status.md         the four axes, the gates, the displayed status
      log.md            the status log: what is logged, actors, causes not derivations
    lifecycles/         one per stateful entity: states, transitions, guards, what each writes
      request.md  iteration.md  list.md  project.md  intention.md
    planning/
      categories.md     the tree, shares, category custody
      mixes.md          mixes, tracking, snapshots
      intentions.md     scope and objective, progress, archive and repeats
      generation.md     how a list is generated for an intention
    access/
      permissions.md    the catalog: permission × accepted scopes (generated)
      scopes.md         how @self, @custody, @project, @managed and @any resolve
      roles.md          default roles: grants, proposal limits (generated + notes)
      people.md         users, identities, login, mapped vs. hand-set roles, groups
      custody.md        proposal custody, category custody, project membership
      views.md          view-access matrix: entry → permission → sections, columns, acts
      acts.md           act matrix: act → permission@scope, allowed states, log entry, hook event
    integrations/
      plugins.md        kinds, implementations, versions, contract, instances, triggers
      registries.md     registry states as evidence, existing copies
      hooks.md          events, channels, deliveries, retries
      messaging.md      message plugins, who a message goes to
      watchlists.md     watchlists, system watchlists, new counts, notifications
    ui/
      tiers.md          the four size tiers and what changes between them
      navigation.md     sidebar entries, home, user menu, running tasks
      pages.md          per page: surfaces, columns, filters, groupings, deliberate absences

  user-journeys/        acceptance tests, one journey per file; read by everyone, run by CI
    README.md           the format, seeds, how a journey becomes a test
    reader/  staff/  curator/  digitization/  admin/  cross-role/

  guide/                written from the user journeys; no rule is stated here first
    users/              per role: getting started, then one page per task
    admin/              install, configuration, identity setup, plugins, hooks and
                        schedules, backup and upgrade

  develop/
    architecture.md     frontend, engine, backend; the API contract between them
    api.md              resources, errors (problem+json, refusal codes), paging, uploads
    engine.md           the Bun + SQLite engine: commands, rules, log, seeds, clock
    frontend.md         source layout, shared parts, view definitions, query keys
    styling.md          tokens, tiers, density, states, which shared part for which job
    writing.md          info texts: kinds, voice, length, patterns, examples
    i18n.md             message keys, Czech and English, plurals, dates, numbers
    testing.md          unit, contract (engine and backend), user journeys end-to-end
    conventions.md      the shared coding conventions plus VERA's layer

  decisions/            DEC-NNNN-title.md: context, decision, rejected alternatives
```

`AGENTS.md` stays short. It routes and never restates a rule.

## 3. Rule IDs

- **Form:** an area prefix plus a short slug, e.g. `PERM-request-decide`, `LC-ITER-cancel`,
  `ACT-plugin-disable`, `ACCESS-last-identity`. Slugs are not renumbered when rules are added
  or removed, and they read well in a grep.
- **Each ID is a heading anchor in exactly one reference file.** A rule's text is one to three
  sentences, followed by its reason when the reason is not obvious.
- **Citations:** code comments write `// LC-ITER-cancel`; tests name the rule in their title;
  user journeys list the rules they exercise.
- **Prefixes:**

| Prefix | File |
|---|---|
| `ENT`, `REL` | `model/entities.md`, `model/relationships.md` |
| `DOC`, `STAT`, `LOG` | `model/documents.md`, `model/status.md`, `model/log.md` |
| `LC-REQ`, `LC-ITER`, `LC-LIST`, `LC-PROJ`, `LC-INT` | `lifecycles/*` |
| `PLAN` | `planning/*` |
| `PERM`, `SCOPE`, `ROLE`, `ACCESS`, `VIEW`, `ACT` | `access/*` |
| `PLG`, `REG`, `HOOK`, `MSG`, `WATCH` | `integrations/*` |
| `UI` | `ui/*` |
| `DEC` | `decisions/DEC-NNNN-title.md`: four digits, not a slug |

## 4. What is generated and checked

A `make docs-check` target (Bun script under `docs/tools/`). It:

- regenerates `access/permissions.md`, the grants in `access/roles.md` and the matrix in
  `access/views.md` from `domain/src` and the navigation definition, and fails on
  a diff;
- fails when code, tests or user journeys cite a rule ID that does not exist, or when a
  reference rule is cited by no test (a warning until the engine exists);
- fails on broken relative links and Mermaid that does not parse;
- fails when a user journey has no test, once the journey tests exist.

## 5. Where each existing document goes

The old material is removed once the frontend and these docs are complete. Until then it stays
in place and keeps working. *Absorb* means its content moves into the reference, checked
against the code; *decision* means a record in `decisions/` survives it.

| Existing | Goes to | Action |
|---|---|---|
| `docs/README.md`, `docs/AGENTS.md` | `README.md`, `AGENTS.md` | rewrite |
| `design/shared/entities/concepts.md` | `model/entities.md` | absorb |
| `design/shared/entities/relationships.md` | `model/relationships.md` | absorb; "must not exist" → decisions |
| `entities/document-identity.md`, `identifier-types.md`, `document-properties.md` | `model/documents.md` | absorb; "properties are not columns" → decision |
| `entities/status-model.md` | `model/status.md` | absorb; "not one enum" → decision |
| `entities/status-log.md` | `model/log.md` | absorb; "causes, not derivations" → decision |
| `entities/priority-levels.md` | `model/documents.md` or `lifecycles/iteration.md` | absorb |
| `docs/workflows/*.md` | `lifecycles/*` | absorb, checked against the code |
| `entities/intentions.md`, `intentions-mixes-redesign.md` | `planning/*` | absorb; "list derived, never attached", "archive means preserve", independent mixes → decisions |
| `entities/projects.md` | `lifecycles/project.md`, `access/custody.md` | absorb |
| `entities/permissions.md`, `docs/permissions/*` | `access/permissions.md`, `scopes.md`, `roles.md` | absorb; "bundles, not a ladder" → decision |
| `docs/access/*`, `entities/identity.md`, `proposal-custody.md` | `access/people.md`, `access/custody.md` | absorb; "groups do not grant roles" → decision |
| `entities/users-management-redesign.md` | `ui/pages.md` | absorb what was built |
| `entities/plugins.md`, `registry-status.md` | `integrations/plugins.md`, `registries.md` | absorb; open items → ledger |
| `entities/messaging.md` | `integrations/messaging.md` | absorb; "not a channel inside VERA" → decision |
| `entities/watchlists-and-notifications.md`, `design/shared/filtering.md` | `integrations/watchlists.md`, `ui/pages.md` | absorb |
| `design/shared/view-map.md`, `view-catalog.md`, `page-composition.md`, `navigation.md` | `ui/pages.md`, `ui/navigation.md` | absorb what was built; "flat nav, no counts" → decision |
| `design/shared/view-rules.md` | `develop/styling.md`, `develop/writing.md` | absorb the rules that still hold |
| `design/shared/flows.md`, `flows/*.mermaid`, `document-use-cases.md` | `user-journeys/`, `lifecycles/` | source material for both |
| `docs/user-journey/*` | `user-journeys/` (replaces it), then `guide/users/` | source material |
| `design/shared/model/*`, `design/manifest.yaml` | `docs/tools/` | replaced by `docs-check` |
| `demos/rework.md` | `ui/tiers.md`, `develop/styling.md` | absorb; "a tier is a display" → decision |
| `demos/STATUS.md`, `notes.md`, `BUILD.md`, `REVIEW-BRIEF.md` | `decisions/`, `ledger.md` | mine for decisions and open questions, then drop |
| `frontend/brief.md`, `continuation.md`, `component-inventory.md`, `component-interfaces.md` | `develop/frontend.md`, `develop/conventions.md` | absorb what still holds, then drop |
| `frontend/plan.md`, `completion-plan.md` | — | drop when done |
| `CHANGELOG.md` | stays | — |

**Code comments.** About 600 comments in 226 files under `frontend/src` cite old documents
(`component-interfaces.md`, `intentions.md`, `STATUS`, `flows.md`, `plugins.md`, and demo
scripts such as `page-plugins.js`). They are repointed to rule IDs as each reference file
lands, and must be zero before the old material is removed. `docs-check` reports the count.

## 6. Decision candidates

From the existing documents, the decisions that look worth keeping:

1. A status is four stored axes and one derived badge, not one enum.
2. A size tier is a display, not a column count.
3. Properties are typed and plugin-supplied; they are not columns.
4. The log records causes, not derivations; its actor is never null.
5. Roles are bundles of grants, not a ladder; groups carry responsibility, not roles.
6. VERA does not fix records: a defect links to the catalog and offers *Recheck*.
7. Navigation is one flat list, without counts.
8. An intention and a list are related by derivation, never attached.
9. Mixes are independent; archiving preserves.
10. Messaging hands off to a plugin; it is not a channel inside VERA.
11. Registry states are evidence that feeds eligibility, not a status.
12. Relationships that deliberately do not exist (from `relationships.md` §4).

## 7. Settled

- The tree above, with `reference/ui/` for pages and navigation.
- Rule IDs are slugs, not numbers.
- The decision candidates in §6 are kept.
- Generated tables are committed, so they read on GitHub; `docs-check` fails when they are
  stale.
- `guide/` is written after the engine.

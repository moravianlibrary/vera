# VERA Documentation Index

This is the agent navigation hub for VERA's documentation. It organizes the docs
so you can find the right file when answering questions about the frontend implementation.

## Design (implementation reference)

Decision records that guide the code. These are what we are implementing against;
they may become obsolete as the product evolves.

- **`design/shared/view-rules.md`** — rules for building UI entries (actions, rows, fields)
- **`design/shared/view-map.md`** — which permissions map to which sidebar entries
- **`design/shared/view-catalog.md`** — the full view catalog
- **`design/shared/navigation.md`** — sidebar construction rules
- **`design/shared/page-composition.md`** — page composition conventions
- **`design/shared/filtering.md`** — filter rules
- **`design/shared/flows.md`** — flow reference (D1, D2, PJ1, etc.)
- **`design/shared/entities/`** — entity definitions
  - `permissions.md` — role-based permissions, grants, scopes, the 5 shipped roles
  - `identity.md` — identity plugins, login flow, mapped roles
  - `status-model.md` — the status state machine
  - `relationships.md` — entity relationships, custody, membership
  - `proposal-custody.md` — proposal custody (before approval)
  - `concepts.md` — core entity model
  - `projects.md`, `intentions.md`, `plugins.md`, etc.

## Permissions (reference docs)

Human-readable breakdown of the permission system, extracted from the code.

- **`permissions/catalog.md`** — every permission and its accepted scopes (the table in `domain/permissions.ts`)
- **`permissions/roles.md`** — the five shipped roles and their grants
- **`permissions/scope-resolution.md`** — how `@custody`, `@project`, `@managed`, `@any` resolve against records
- **`permissions/can-check.md`** — how the `can()` hook resolves permissions at runtime

## Access (identity, roles, groups, custody)

How users arrive, what roles they hold, and how groups/custody/project membership work.

- **`access/identity.md`** — identity plugins (Keycloak, local, eduID), login page flow
- **`access/role-resolution.md`** — hand-set vs. mapped roles, `heldRolesOf()`, provenance
- **`access/groups.md`** — what groups carry: category custody, proposal custody, project membership
- **`access/custody.md`** — proposal custody (who decides before approval) + category custody (who is responsible after)
- **`access/project-membership.md`** — project members, managers, group memberships

## User Journey (flowcharts per role)

Mermaid diagrams showing what each role can see and do, end-to-end.

- **`user-journey/index.md`** — overview of all journeys and how to read them
- **`user-journey/reader.md`** — reader: propose, see own documents only
- **`user-journey/staff.md`** — staff: reader access with a higher daily proposal limit
- **`user-journey/curator.md`** — curator: review proposals, validate iterations, manage category custody
- **`user-journey/digitization.md`** — dig-curator: plan and execute digitization lists
- **`user-journey/admin.md`** — admin: manage users, roles, groups, custody, plugins, hooks, tasks

## Workflows (state machines)

Mermaid state diagrams extracted from `docs/design/shared/model/workflows.js`.

- **`workflows/request.md`** — request.decision lifecycle
- **`workflows/iteration.md`** — iteration.progress lifecycle
- **`workflows/list.md`** — list state machine
- **`workflows/project.md`** — project.state machine
- **`workflows/intention.md`** — intention mix selection, snapshots, and archives

## Demos (interactive HTML)

- **`demos/`** — standalone HTML demo pages for each view. Run with `bun` or serve with `npx serve demos/`.
  - `index.html` — entry point
  - `model.html` — workflow state diagrams
  - `page-*.js` — demo scripts per view

## Frontend source structure (quick reference)

```
frontend/src/
├── domain/          ← pure domain logic: permissions, entities, access, status, proposals
├── api/             ← API client: routes, queries, mutations
├── features/        ← feature modules: view logic, dialogs, pages
│   ├── access/      ← Users & Groups page
│   ├── categories/  ← Categories page
│   ├── documents/   ← Documents page
│   ├── proposals/   ← Proposals page
│   ├── lists/       ← Digitization Lists page
│   ├── projects/    ← Projects page
│   ├── intentions/  ← Intentions page
│   ├── validations/ ← Validations page
│   ├── tasks/       ← Tasks page
│   ├── plugins/     ← Plugins page
│   ├── hooks/       ← Hooks page
├── hooks/           ← shared hooks: useCan, useSession, usePicked, etc.
├── lib/             ← utilities: view-definition, date/number formatting
└── mocks/           ← MSW mock data (maps to MOCK_USERS in Makefile)
```

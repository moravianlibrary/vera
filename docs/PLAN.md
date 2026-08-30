# VERA Redesign — Master Plan

Tracks all deliverables needed before implementation begins. Each item is either done, in progress, or planned. We update this document as specs and artifacts are completed.

**Last coherence review:** 2026-05-28. Fixed: event schema (JSONB changes), Categories/Intentions endpoint alignment, Status/State terminology standardization, centralized permission matrix, async operation tracking, URL/React state convention.

---

## 1. Diagrams

### Class Diagram

Full class diagram covering all domain entities, protocols, services, repositories, and their relationships in the redesigned system.

| Item | Status | Location |
|------|--------|----------|
| Domain model (includes hooks, updated events) | done | `docs/superpowers/specs/diagrams/domain-model.puml` |
| Domain model changes (includes hooks, updated events) | done | `docs/superpowers/specs/diagrams/domain-changes.puml` |
| Full redesign class diagram (all entities, protocols, services, repositories, hooks) | done | `docs/superpowers/specs/diagrams/full-class-diagram.puml` |

### Use Case Diagrams

| Item | Status | Location |
|------|--------|----------|
| Current use cases | done | `docs/development/diagrams/use-case/use_case.md` |
| Redesign use cases (all roles, all entity types, hooks/plugins admin) | done | `docs/superpowers/specs/diagrams/redesign-use-cases.puml` |

### Sequence Diagrams

| Item | Status | Location |
|------|--------|----------|
| Document pipeline | done | `docs/superpowers/specs/diagrams/document-pipeline-sequence.puml` |
| Watchlist computation | done | `docs/superpowers/specs/diagrams/watchlist-computation-sequence.puml` |
| Auth flow | done | `docs/superpowers/specs/diagrams/auth-flow-sequence.puml` |
| Search architecture | done | `docs/superpowers/specs/diagrams/search-architecture.puml` |
| Lifecycle hook dispatch (event → filter → chain execution) | done | `docs/superpowers/specs/diagrams/hook-dispatch-sequence.puml` |
| DataHook pipeline (entity change → hook chain → validation → persist) | done | `docs/superpowers/specs/diagrams/datahook-pipeline-sequence.puml` |
| ExternalHook execution (event → client setup → rate limit → call) | done | `docs/superpowers/specs/diagrams/externalhook-execution-sequence.puml` |
| Hook failure & retry flow | done | `docs/superpowers/specs/diagrams/hook-failure-retry-sequence.puml` |
| Plugin code upload & validation | done | `docs/superpowers/specs/diagrams/plugin-code-upload-sequence.puml` |

---

## 2. Design Specs

### Backend

| Spec | Status | Location |
|------|--------|----------|
| Backend redesign (ES → pg_duckdb, events, watchlists, auth) | done | `docs/superpowers/specs/2026-05-20-vera-backend-redesign.md` |
| Lifecycle hooks design | done | `docs/superpowers/specs/2026-05-28-lifecycle-hooks-design.md` |
| Target architecture overview | done | `docs/superpowers/specs/ARCHITECTURE.md` |

### Frontend UI Design

| Spec | Status | Location |
|------|--------|----------|
| Documents | done | `docs/superpowers/specs/2026-05-21-documents-ui-design.md` |
| Proposals & Additions | done | `docs/superpowers/specs/2026-05-21-proposals-additions-ui-design.md` |
| Projects | done | `docs/superpowers/specs/2026-05-21-projects-ui-design.md` |
| Categories | done | `docs/superpowers/specs/2026-05-21-categories-ui-design.md` |
| Intentions | done | `docs/superpowers/specs/2026-05-21-intentions-ui-design.md` |
| Digitization Lists | done | `docs/superpowers/specs/2026-05-21-digitization-lists-ui-design.md` |
| Tasks | done | `docs/superpowers/specs/2026-05-21-tasks-ui-design.md` |
| Plugins | done | `docs/superpowers/specs/2026-05-21-plugins-ui-design.md` |
| Hooks admin UI (subscriptions, execution log, dead letters) | done | `docs/superpowers/specs/2026-05-28-hooks-ui-design.md` |

---

## 3. Implementation Plans

### SDK (re)implementation plan

Covers the `sdk/vera_plugins/` package. Needs to account for:

- Migrating from current plugin base classes to Protocol-based interfaces
- New `ExternalHookProtocol` and `DataHookProtocol`
- `HookEvent`, `HookResult`, `DataHookResult` data classes
- `HttpClient` wrapper with rate limiting
- Restricted import allowlist and AST validation
- Plugin code loading from DB (replacing file-based discovery)
- Updated plugin metadata and config schemas
- Keeping backward compatibility for existing 11 plugin types (or migrating them to Protocols too)

| Item | Status | Location |
|------|--------|----------|
| SDK reimplementation plan | planned | |

### App (re)implementation plan

Covers the `app/` backend. Needs to account for:

- New DB schema (hook_subscriptions, hook_executions, hook_dead_letters)
- Hook dispatcher service (event → subscription matching → filter evaluation → execution)
- Entity data view assembly per subscription config
- DataHook validation and persistence pipeline
- Cycle detection (depth counter)
- Integration with existing event system and Celery tasks
- API endpoints for hooks management
- Plugin code upload/validation endpoints
- Redis rate limiting infrastructure
- Dead letter management
- All changes from the backend redesign spec (ES removal, pg_duckdb, auth, watchlists)

| Item | Status | Location |
|------|--------|----------|
| App reimplementation plan | planned | |

### Client (new) implementation plan

Covers the new `client/` frontend. Needs to account for:

- React 19 + shadcn/ui + Tailwind CSS + TanStack Query stack
- All 8 feature pages (Documents, Proposals, Additions, Projects, Categories, Intentions, Digitization Lists, Tasks)
- Plugins admin page (existing spec)
- Hooks admin page (new — subscriptions, execution log, dead letters)
- Shared patterns (view toggle, detail panel, filter bar, watchlists, bulk selector, submission wizard)
- Auth flow (login, JWT refresh, permission-based UI)
- State management approach

| Item | Status | Location |
|------|--------|----------|
| Client implementation plan | planned | |

---

## 4. Demo HTML Design Pages

Static HTML/CSS mockups for validating UI designs before implementation. One per feature page.

| Page | Status | Location |
|------|--------|----------|
| Documents | done | `docs/demos/documents.html` |
| Proposals | done | `docs/demos/proposals.html` |
| Additions | done | `docs/demos/additions.html` |
| Projects | done | `docs/demos/projects.html` |
| Categories | done | `docs/demos/categories.html` |
| Intentions | done | `docs/demos/intentions.html` |
| Digitization Lists | done | `docs/demos/digitization-lists.html` |
| Tasks | done | `docs/demos/tasks.html` |
| Plugins | done | `docs/demos/plugins.html` |
| Hooks admin | done | `docs/demos/hooks.html` |

---

## 5. Reference Documents

Existing documentation about the current system.

| Document | Location |
|----------|----------|
| Current architecture | `docs/development/ARCHITECTURE.md` |
| Current project structure | `docs/development/project_structure.md` |
| Current endpoints | `docs/development/endpoints.md` |
| Current functionality | `docs/development/functionality.md` |
| Implementation checklist | `docs/development/diagrams/implementation_checklist.md` |
| Specs index | `docs/superpowers/specs/README.md` |

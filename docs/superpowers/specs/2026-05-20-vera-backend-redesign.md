# VERA Backend Redesign — pg_duckdb + Predefined Watchlists

## Overview

Full backend infrastructure redesign of VERA. All existing domain models (documents, catalog records, tasks, projects, categories, intentions, proposals, additions, digitization lists, plugins) are preserved. The changes are in the infrastructure layer:

- **Drop Elasticsearch**, replace with **PostgreSQL + pg_duckdb extension** (single instance)
- **Predefined watchlists** with segment subscription model
- **Per-domain event tables** for change tracking
- **Materialized views** for faceting, refreshed on data changes
- **App-owned auth** (JWT + RBAC) with Keycloak for federation only
- **Incremental migration** — swap adapters one at a time within the existing codebase

Frontend is out of scope for this iteration. Plugin system stays as-is. Celery/Redis stays for background jobs.

---

## Section 1: Database Layer — PostgreSQL + pg_duckdb

Single PostgreSQL 17 instance with the `pg_duckdb` extension. Docker image switches from vanilla `postgres:17` to `pgduckdb/pgduckdb:17-main` (or latest stable pg_duckdb image for PG 17).

### Two query modes on one database

- **OLTP** (regular SQLAlchemy) — all CRUD operations, entity reads/writes, the existing repository layer. No changes to how services interact with data.
- **OLAP** (pg_duckdb) — faceting aggregations, watchlist membership computation, analytics. These run through materialized views and scheduled refresh jobs.

### Materialized views for faceting

Defined per domain:

- `mv_document_facets` — counts by status, category, project, document type
- `mv_catalog_record_facets` — counts by format, language, year, collection
- `mv_task_facets` — counts by status, assignee, priority, project

### Refresh strategy

- **On task completion** — when a Celery task that modifies entities finishes (catalog sync, bulk imports, etc.), it triggers a refresh of the relevant materialized views.
- **During long-running tasks** — every N processed entities (configurable), trigger a refresh so users see progress in near-real-time.
- **No blind periodic refreshes** — views only refresh when data actually changes.

Refresh logic lives in the task/worker layer. Each task knows which domains it affects and refreshes the corresponding views.

### Table queries for data grids

When the user applies filters (same filter definitions as faceting), actual row data comes from direct table queries with WHERE clauses, not from the materialized views. Views are only for facet counts.

### Migration path

1. Swap Docker image to pg_duckdb
2. Create materialized views via Alembic migrations
3. Replace ES-backed repository methods with SQL queries
4. Remove Elasticsearch container and all `esorm`/`AsyncElasticsearch` dependencies

---

## Section 2: Event System — Per-Domain Event Tables

One event table per domain, with typed columns. Event types are PostgreSQL enums.

### Schema

```sql
CREATE TYPE document_event_type AS ENUM (
  'created', 'updated', 'deleted', 'status_changed'
  -- extended per domain as needed
);

CREATE TABLE document_events (
  id bigserial PRIMARY KEY,
  document_id bigint REFERENCES documents(id),
  event_type document_event_type NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  task_id bigint
);

CREATE TABLE catalog_record_events (
  id bigserial PRIMARY KEY,
  catalog_record_id bigint REFERENCES catalog_records(id),
  event_type catalog_record_event_type NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  task_id bigint
);
```

Same pattern for `task_events`, `addition_events`, etc. — only created for domains that watchlists need to observe.

### Event generation

Events are written by the service layer when entities change. Not generic database triggers — each service method explicitly records what changed and why.

### Event consumption

The watchlist computation job reads these events to determine which watchlists are affected, rather than re-scanning entire tables.

### Retention

Old events can be pruned after watchlist deltas are computed. Configurable retention window (e.g. 30 days) for audit purposes.

### Python enums

Each domain has a corresponding Python enum mapped to the PG enum via SQLAlchemy:

```python
class DocumentEventType(str, Enum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    STATUS_CHANGED = "status_changed"
```

---

## Section 3: Watchlist System — Predefined Segments + Subscriptions

### Core tables

**Watchlists** — predefined by admins:

```sql
CREATE TABLE watchlists (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  entity_type text NOT NULL,  -- 'document', 'catalog_record', 'task', etc.
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Watchlist filters** — declarative rules defining segment membership:

```sql
CREATE TABLE watchlist_filters (
  id bigserial PRIMARY KEY,
  watchlist_id bigint REFERENCES watchlists(id),
  field text NOT NULL,
  operator text NOT NULL,     -- '=', '!=', 'in', '>', '<', '>=', '<=', 'like'
  value text NOT NULL
);
```

Multiple filters on the same watchlist are AND-ed together.

**User subscriptions:**

```sql
CREATE TABLE user_watchlists (
  user_id bigint REFERENCES users(id),
  watchlist_id bigint REFERENCES watchlists(id),
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  PRIMARY KEY (user_id, watchlist_id)
);
```

**Watchlist deltas** — computed results:

```sql
CREATE TABLE watchlist_item_changes (
  id bigserial PRIMARY KEY,
  watchlist_id bigint REFERENCES watchlists(id),
  entity_id bigint NOT NULL,
  change_type watchlist_change_type NOT NULL,  -- enum: 'entered', 'left', 'modified'
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Computation flow

1. Celery task reads new events from per-domain event tables since last computation
2. pg_duckdb evaluates which watchlist filters match the changed entities
3. Results are written to `watchlist_item_changes` as deltas
4. User feed: join `watchlist_item_changes` with `user_watchlists` where `created_at > last_seen_at`

### Supported operators

Fixed set: `=`, `!=`, `in`, `>`, `<`, `>=`, `<=`, `like`. Structured filter approach — safe, indexable, easy to evaluate in DuckDB.

---

## Section 4: Auth — App-Owned JWT + Keycloak Federation

Adopt the marc-comparator auth pattern.

### OIDC flow

1. User clicks login, redirected to Keycloak
2. Keycloak returns authorization code
3. Backend exchanges code for tokens, fetches user info from Keycloak
4. Backend provisions user in app DB (find by email or create with default "Guest" role)
5. Backend issues its own JWT as httpOnly secure cookies (access + refresh)
6. No runtime dependency on Keycloak after login

### RBAC — app-owned

- `Permission` enum in Python — e.g. `ReadDocuments`, `ManageWatchlists`, `AdminSystem`
- Roles stored in DB with JSONB permissions array
- Users have many roles (many-to-many)
- Effective permissions = union of all role permissions

### FastAPI dependencies

```python
CurrentUser = Annotated[TokenData, Depends(get_current_user)]

# Route-level authorization
@router.get("/documents", dependencies=[WithPermission(Permission.ReadDocuments)])
```

### Migration path

1. Port auth modules from marc-comparator (auth service, OIDC flow, JWT utils, dependencies)
2. Define VERA-specific permissions enum
3. Add roles/permissions tables via Alembic migration
4. Replace existing Keycloak integration in `identity_provider.py`
5. Update all controllers to use `CurrentUser` and `WithPermission` dependencies

---

## Section 5: Search & Filtering — Replacing Elasticsearch

### Full-text search

- PostgreSQL `tsvector`/`tsquery` with GIN indexes on searchable fields
- Per-domain search columns, e.g. `documents.search_vector tsvector`
- Maintained via triggers or on-write updates
- Czech language stemming via PostgreSQL text search configurations

### Filtered queries (data grids)

- Direct SQL with WHERE clauses built from structured filters
- A shared filter-to-SQL builder that takes structured filters (field, operator, value — same shape as watchlist filters) and produces SQLAlchemy WHERE clauses
- Reused across: data grid queries, facet view definitions, and watchlist evaluation

### Facet counts

- Read from materialized views (Section 1)
- For filtered facet counts (given active filters, what are remaining counts):
  - Query the materialized view with additional WHERE clauses, or
  - Run a lightweight pg_duckdb aggregation on the fly if the view doesn't cover the combination

### API contract

Replace `IndexerRequest`/`IndexerResponse` with:

- `SearchRequest` — filters, pagination, sorting, full-text query
- `SearchResponse` — results, facets, total count

Controllers keep the same endpoints, just swap the underlying implementation.

### Migration path

1. Add `tsvector` columns and GIN indexes via Alembic
2. Build shared filter-to-SQL engine
3. Create new search repository implementations backed by SQLAlchemy
4. Replace ES-backed repositories one domain at a time
5. Remove `esorm`, `AsyncElasticsearch`, and Elasticsearch container

---

## Section 6: Infrastructure — Docker & Dependencies

### Docker Compose changes

| Service | Current | New |
|---------|---------|-----|
| `postgres` | `postgres:17` | `pgduckdb/pgduckdb:17-main` (PG 17 + DuckDB extension) |
| `index` (Elasticsearch) | `elasticsearch:8.14.0` | **Removed** |
| `redis` | stays | stays |
| `server` | stays | updated dependencies |
| `worker` | stays | new tasks (view refresh, watchlist computation) |
| `client` | stays for now | removed later with new frontend |
| `ai` | stays | stays |

### Python dependency changes

- **Remove**: `elasticsearch`, `esorm`, ES-related packages
- **Add**: nothing new for pg_duckdb (SQLAlchemy talks via normal `psycopg` driver)
- **Port from marc-comparator**: `python-jose` or `pyjwt` for JWT, `bcrypt` for password hashing

### Config changes

- Remove `index.env`, ES connection settings from `app.env`
- Add pg_duckdb extension activation to Postgres init script (`CREATE EXTENSION pg_duckdb`)
- Add watchlist computation settings (batch size, etc.)

### Alembic migrations (in order)

1. pg_duckdb extension + `tsvector` columns + GIN indexes
2. Per-domain event tables with enum types
3. Watchlist tables (watchlists, watchlist_filters, user_watchlists, watchlist_item_changes)
4. Roles/permissions tables for new auth
5. Materialized views for faceting
6. Drop any ES-specific columns/tables if they exist

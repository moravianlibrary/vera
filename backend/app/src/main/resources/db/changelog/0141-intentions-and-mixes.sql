--liquibase formatted sql
-- PLAN-intention; PLAN-mix; PLAN-mix-revision; PLAN-scope.

--changeset vera:0141-intentions-and-mixes
CREATE TABLE mixes (
  id text PRIMARY KEY,
  name text NOT NULL,
  is_primary boolean NOT NULL,
  archived_at timestamptz,
  shares jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  position integer NOT NULL
);
CREATE TABLE mix_revisions (
  mix_id text NOT NULL REFERENCES mixes (id) DEFERRABLE INITIALLY DEFERRED,
  revision integer NOT NULL CHECK (revision > 0),
  shares jsonb NOT NULL,
  at timestamptz NOT NULL,
  label text,
  position integer NOT NULL,
  PRIMARY KEY (mix_id, revision)
);
CREATE TABLE intentions (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  funding_kind text NOT NULL CHECK (funding_kind IN ('any', 'none', 'project')),
  funding_project_id text REFERENCES projects (id) DEFERRABLE INITIALLY DEFERRED,
  project_id text REFERENCES projects (id) DEFERRABLE INITIALLY DEFERRED,
  scope_category_id text REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  scope_conditions jsonb,
  distribution_id text REFERENCES mixes (id) DEFERRABLE INITIALLY DEFERRED,
  mix_revision integer CHECK (mix_revision IS NULL OR mix_revision > 0),
  target_pages integer CHECK (target_pages IS NULL OR target_pages > 0),
  counts_from date NOT NULL,
  ends_on date,
  is_overall boolean NOT NULL,
  template_id text,
  archived_actor_kind text CHECK (archived_actor_kind IS NULL OR archived_actor_kind IN ('user', 'system')),
  archived_actor_user_id text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  archived_at timestamptz,
  position integer NOT NULL,
  CHECK ((funding_kind = 'project') = (funding_project_id IS NOT NULL)),
  CHECK ((archived_at IS NULL) = (archived_actor_kind IS NULL)),
  CHECK ((archived_actor_kind = 'user') = (archived_actor_user_id IS NOT NULL)),
  FOREIGN KEY (distribution_id, mix_revision) REFERENCES mix_revisions (mix_id, revision)
    DEFERRABLE INITIALLY DEFERRED
);

--rollback DROP TABLE intentions; DROP TABLE mix_revisions; DROP TABLE mixes;

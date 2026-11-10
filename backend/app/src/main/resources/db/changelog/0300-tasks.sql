--liquibase formatted sql
-- ENT-run; ENT-schedule; PLG-run-items.

--changeset vera:0300-tasks
CREATE TABLE runs (
  id text PRIMARY KEY,
  what text NOT NULL,
  instance_id text REFERENCES plugin_instances (id) DEFERRABLE INITIALLY DEFERRED,
  core_name text,
  trigger jsonb NOT NULL,
  started_by text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  state text NOT NULL CHECK (state IN ('Running', 'Done', 'DoneWithErrors', 'Failed', 'Cancelled', 'Skipped')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  item_count integer NOT NULL CHECK (item_count >= 0),
  done_count integer NOT NULL CHECK (done_count >= 0),
  items_per_minute double precision,
  changes jsonb,
  failure text,
  note text,
  cancelled_by text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  rerun_of text REFERENCES runs (id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX runs_started_at_idx ON runs (started_at DESC);
CREATE INDEX runs_state_idx ON runs (state);
CREATE TABLE run_errors (
  run_id text NOT NULL REFERENCES runs (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  iteration_id text NOT NULL REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  message text NOT NULL,
  at_item integer NOT NULL CHECK (at_item >= 0),
  position integer NOT NULL,
  PRIMARY KEY (run_id, position)
);
CREATE TABLE run_items (
  run_id text NOT NULL REFERENCES runs (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  iteration_id text NOT NULL REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  error text,
  position integer NOT NULL,
  PRIMARY KEY (run_id, position)
);
CREATE TABLE run_log (
  run_id text NOT NULL REFERENCES runs (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  at timestamptz NOT NULL,
  text text NOT NULL,
  is_error boolean NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (run_id, position)
);
CREATE TABLE schedules (
  id text PRIMARY KEY,
  instance_id text NOT NULL REFERENCES plugin_instances (id) DEFERRABLE INITIALLY DEFERRED,
  name text NOT NULL,
  cadence jsonb NOT NULL,
  overlap text NOT NULL CHECK (overlap IN ('skip', 'wait')),
  paused_by text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  paused_at timestamptz,
  pause_reason text,
  created_by text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  since date NOT NULL,
  CHECK ((paused_by IS NULL) = (paused_at IS NULL)),
  CHECK ((paused_by IS NULL) = (pause_reason IS NULL))
);
CREATE TABLE task_retention (
  id integer PRIMARY KEY CHECK (id = 1),
  days integer NOT NULL CHECK (days >= 7),
  failed_days integer NOT NULL CHECK (failed_days >= 7)
);

--rollback DROP TABLE task_retention; DROP TABLE schedules; DROP TABLE run_log; DROP TABLE run_items; DROP TABLE run_errors; DROP TABLE runs;

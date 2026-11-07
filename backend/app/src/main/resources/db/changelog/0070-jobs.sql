--liquibase formatted sql
-- Durable jobs claimed by a worker with a lease (B5).

--changeset vera:0070-jobs
CREATE TABLE jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,
  due_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_parent text,
  state text NOT NULL DEFAULT 'due' CHECK (state IN ('due', 'running', 'done', 'failed')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  lease_until timestamptz,
  claimed_by text,
  ran_at timestamptz,
  error text
);
CREATE INDEX jobs_due ON jobs (state, due_at);
--rollback DROP TABLE jobs;

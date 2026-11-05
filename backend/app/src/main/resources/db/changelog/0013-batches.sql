--liquibase formatted sql
-- Proposal batches (PROP-batch).

--changeset vera:0013-batches
CREATE TABLE batches (
  id text PRIMARY KEY,
  name text NOT NULL,
  submitted_by text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  submitted_at timestamptz NOT NULL,
  source_instance_id text,
  source_name text
);
--rollback DROP TABLE batches;

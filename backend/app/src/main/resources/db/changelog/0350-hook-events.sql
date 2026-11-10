--liquibase formatted sql

--changeset vera:0350-hook-events
CREATE TABLE hook_events (
  id text PRIMARY KEY,
  code text NOT NULL,
  subject_kind text NOT NULL,
  subject_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  correlation_id text NOT NULL,
  cause jsonb NOT NULL,
  actor jsonb NOT NULL,
  changes jsonb NOT NULL,
  reason_public text,
  reason_internal text,
  matched_at timestamptz
);
CREATE INDEX hook_events_unmatched ON hook_events (occurred_at, id) WHERE matched_at IS NULL;
CREATE INDEX hook_events_subject ON hook_events (subject_kind, subject_id, occurred_at);
--rollback DROP TABLE hook_events;

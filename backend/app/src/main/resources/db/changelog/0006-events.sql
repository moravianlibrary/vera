--liquibase formatted sql
-- Event history, durable audit delivery and channel outbox (EVENT-destinations).

--changeset vera:0006-events
CREATE TABLE events (
  id text PRIMARY KEY,
  code text NOT NULL,
  subject_kind text NOT NULL,
  subject_id text NOT NULL,
  at timestamptz NOT NULL,
  actor jsonb NOT NULL,
  correlation_id text NOT NULL,
  data jsonb NOT NULL,
  reason_public text,
  reason_internal text
);
CREATE INDEX events_subject ON events (subject_kind, subject_id, at);
CREATE INDEX events_correlation ON events (correlation_id);
COMMENT ON TABLE events IS 'Append-only History entries for records.';
CREATE TABLE audit_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL,
  record jsonb NOT NULL
);
COMMENT ON TABLE audit_outbox IS 'Audit records waiting for collector delivery.';
CREATE TABLE outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('mail', 'chat', 'webhook', 'push')),
  recipient text NOT NULL,
  payload jsonb NOT NULL,
  sent_at timestamptz NOT NULL
);
COMMENT ON TABLE outbox IS 'Messages waiting for a delivery channel.';
--rollback DROP TABLE outbox; DROP TABLE audit_outbox; DROP TABLE events;

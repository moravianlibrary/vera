-- What happened, for a record's History (EVENT-destinations, LOG-append-only): never updated or
-- deleted.
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,           -- the entry's actor, as JSON
  correlation_id TEXT NOT NULL,
  data TEXT NOT NULL,            -- JSON
  reason_public TEXT,
  reason_internal TEXT
);
CREATE INDEX events_subject ON events (subject_kind, subject_id, at);
CREATE INDEX events_correlation ON events (correlation_id);

-- Audit records waiting for the collector to accept them (OBS-audit-delivery).
CREATE TABLE audit_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  record TEXT NOT NULL           -- the audit record, as JSON (step 3)
);

--liquibase formatted sql
-- Digitization iterations and their rule data (LC-ITER-ingest, STAT-validation, LC-ITER-links).

--changeset vera:0015-iterations
CREATE TABLE iterations (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  attempt integer NOT NULL CHECK (attempt > 0),
  request_id text NOT NULL,
  category_id text NOT NULL REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  priority text NOT NULL CHECK (priority IN (
    'Low', 'Normal', 'High', 'Urgent')),
  project_id text REFERENCES projects (id) DEFERRABLE INITIALLY DEFERRED,
  progress text NOT NULL CHECK (progress IN (
    'Enqueued', 'IngestFailed', 'Ready', 'Planned', 'InProgress', 'Digitized', 'Published')),
  -- Lists is a later step; list_id intentionally has no foreign key yet.
  list_id text,
  former_list_name text,
  restriction_rule text,
  restriction_public_text text,
  restriction_internal_text text,
  restriction_found_at timestamptz,
  override_actor_id text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  override_at timestamptz,
  override_note text,
  cancellation_cause text CHECK (cancellation_cause IS NULL OR cancellation_cause IN (
    'Decided', 'NotDigitizable')),
  cancellation_actor_id text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  cancellation_at timestamptz,
  cancellation_public_text text,
  cancellation_internal_text text,
  ingest_failure_attempts integer CHECK (ingest_failure_attempts IS NULL OR ingest_failure_attempts > 0),
  ingest_failure_error text,
  digitized_at timestamptz,
  scan_dpi integer CHECK (scan_dpi IS NULL OR scan_dpi > 0),
  UNIQUE (document_id, attempt)
);
CREATE INDEX iterations_document ON iterations (document_id);
CREATE TABLE iteration_defects (
  iteration_id text NOT NULL REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  key text NOT NULL,
  instance_id text NOT NULL,
  rule_code text NOT NULL,
  subject text NOT NULL,
  public_text text NOT NULL,
  internal_text text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  PRIMARY KEY (iteration_id, position),
  UNIQUE (iteration_id, key)
);
CREATE TABLE iteration_verdicts (
  iteration_id text NOT NULL REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  verdict text NOT NULL CHECK (verdict IN (
    'Approved', 'Denied', 'Revoked')),
  defect_keys text[] NOT NULL,
  actor_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  at timestamptz NOT NULL,
  note text NOT NULL,
  public_text text,
  PRIMARY KEY (iteration_id, position)
);
CREATE TABLE iteration_links (
  iteration_id text NOT NULL REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  id text NOT NULL,
  url text NOT NULL,
  instance_id text,
  set_by text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  set_at timestamptz NOT NULL,
  is_primary boolean NOT NULL,
  PRIMARY KEY (iteration_id, position),
  UNIQUE (iteration_id, id),
  UNIQUE (iteration_id, url)
);
CREATE TABLE iteration_property_sources (
  iteration_id text NOT NULL REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  key text NOT NULL,
  position integer NOT NULL,
  source jsonb NOT NULL,
  tier integer NOT NULL,
  value jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  set_by text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (iteration_id, key, position)
);
--rollback DROP TABLE iteration_property_sources; DROP TABLE iteration_links; DROP TABLE iteration_verdicts; DROP TABLE iteration_defects; DROP TABLE iterations;

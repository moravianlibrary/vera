--liquibase formatted sql
-- Requests and their decision data (VIEW-requests, ACT-request-decide, ENT-batch).

--changeset vera:0016-requests
CREATE TABLE requests (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  requester_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  at timestamptz NOT NULL,
  reason text,
  batch_id text NOT NULL REFERENCES batches (id) DEFERRABLE INITIALLY DEFERRED,
  project_id text REFERENCES projects (id) DEFERRABLE INITIALLY DEFERRED,
  checked_at timestamptz,
  decision text NOT NULL CHECK (decision IN (
    'Pending', 'Approved', 'Denied', 'Withdrawn', 'Duplicate')),
  is_after_project_approval boolean,
  iteration_relation text CHECK (iteration_relation IS NULL OR iteration_relation IN (
    'Originates', 'Tracks')),
  iteration_id text REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  rescan_actor_id text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  rescan_at timestamptz,
  rescan_note text,
  decline_actor_id text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  decline_at timestamptz,
  decline_public_text text,
  decline_internal_text text,
  withdrawn_at timestamptz,
  tracks_iteration_id text REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((decision <> 'Pending') OR is_after_project_approval IS NOT NULL),
  CHECK ((decision <> 'Approved') OR ((iteration_relation IS NULL) = (iteration_id IS NULL))),
  CHECK ((decision <> 'Denied') OR (decline_actor_id IS NOT NULL AND decline_at IS NOT NULL
    AND decline_public_text IS NOT NULL)),
  CHECK ((decision <> 'Withdrawn') OR withdrawn_at IS NOT NULL),
  CHECK ((decision <> 'Duplicate') OR tracks_iteration_id IS NOT NULL)
);
CREATE INDEX requests_document ON requests (document_id);
CREATE INDEX requests_batch ON requests (batch_id);
CREATE INDEX requests_requester ON requests (requester_id);
CREATE TABLE request_existing_copies (
  request_id text NOT NULL REFERENCES requests (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  source text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'CheckFailed', 'NotFound', 'Unmapped', 'Planned', 'InProgress', 'Digitized', 'Published')),
  link text,
  iteration_id text,
  seen_at timestamptz NOT NULL,
  found_after_approval boolean NOT NULL,
  PRIMARY KEY (request_id, position)
);
CREATE TABLE request_placements (
  request_id text NOT NULL REFERENCES requests (id) DEFERRABLE INITIALLY DEFERRED,
  custody_id text NOT NULL REFERENCES request_custodies (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  PRIMARY KEY (request_id, custody_id),
  UNIQUE (request_id, position)
);
ALTER TABLE iterations ADD CONSTRAINT iterations_request_id_fkey
  FOREIGN KEY (request_id) REFERENCES requests (id) DEFERRABLE INITIALLY DEFERRED;
--rollback ALTER TABLE iterations DROP CONSTRAINT iterations_request_id_fkey; DROP TABLE request_placements; DROP TABLE request_existing_copies; DROP TABLE requests;

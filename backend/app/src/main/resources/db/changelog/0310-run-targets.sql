--liquibase formatted sql
-- PLG-run-items.

--changeset vera:0310-run-targets
CREATE TABLE run_targets (
  run_id text NOT NULL REFERENCES runs (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  document_id text NOT NULL REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  iteration_id text REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (run_id, position)
);
CREATE INDEX run_targets_document_idx ON run_targets (document_id);

--rollback DROP TABLE run_targets;

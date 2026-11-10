--liquibase formatted sql
-- PLG-api-cursor; PLG-run-items; L8.

--changeset vera:0315-plugin-cursors-and-placement-targets
CREATE TABLE plugin_cursors (
  instance_id text NOT NULL REFERENCES plugin_instances (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  operation text NOT NULL,
  cursor text,
  PRIMARY KEY (instance_id, operation)
);
ALTER TABLE run_targets ADD COLUMN request_id text REFERENCES requests (id) DEFERRABLE INITIALLY DEFERRED;

--rollback ALTER TABLE run_targets DROP COLUMN request_id; DROP TABLE plugin_cursors;

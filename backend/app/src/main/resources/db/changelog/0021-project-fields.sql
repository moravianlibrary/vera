--liquibase formatted sql
-- Project fields used in document group headers (PROJECT-create, PROJECT-review).
-- created_at stays nullable for existing projects; the projects step makes it NOT NULL when acts create projects.

--changeset vera:0021-project-fields
ALTER TABLE projects
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN created_at timestamptz,
  ADD COLUMN acted_by text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN acted_at timestamptz,
  ADD COLUMN reason text;
ALTER TABLE projects ADD CONSTRAINT projects_state_fields CHECK (
  (acted_by IS NULL AND acted_at IS NULL AND reason IS NULL)
  OR (state = 'Approved' AND priority IS NOT NULL AND acted_by IS NOT NULL AND acted_at IS NOT NULL
      AND reason IS NULL)
  OR (state = 'Rejected' AND priority IS NULL AND acted_by IS NOT NULL AND acted_at IS NOT NULL
      AND reason IS NOT NULL)
);
--rollback ALTER TABLE projects DROP CONSTRAINT projects_state_fields; ALTER TABLE projects DROP COLUMN reason, DROP COLUMN acted_at, DROP COLUMN acted_by, DROP COLUMN created_at, DROP COLUMN description;

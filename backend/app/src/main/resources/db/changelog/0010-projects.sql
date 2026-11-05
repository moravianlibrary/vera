--liquibase formatted sql
-- Projects read by document lists (PROJECT-create, PROJECT-review).

--changeset vera:0010-projects
CREATE TABLE projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  state text NOT NULL CHECK (state IN ('Proposed', 'Approved', 'Rejected')),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  manager_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  priority text CHECK (priority IS NULL OR priority IN ('Low', 'Normal', 'High', 'Urgent')),
  position integer NOT NULL
);
CREATE TABLE project_members (
  project_id text NOT NULL REFERENCES projects (id) DEFERRABLE INITIALLY DEFERRED,
  user_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  PRIMARY KEY (project_id, user_id),
  UNIQUE (project_id, position)
);
CREATE TABLE project_member_groups (
  project_id text NOT NULL REFERENCES projects (id) DEFERRABLE INITIALLY DEFERRED,
  group_id text NOT NULL REFERENCES groups (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  PRIMARY KEY (project_id, group_id),
  UNIQUE (project_id, position)
);
--rollback DROP TABLE project_member_groups; DROP TABLE project_members; DROP TABLE projects;

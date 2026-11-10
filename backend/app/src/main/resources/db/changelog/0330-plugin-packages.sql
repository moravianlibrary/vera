--liquibase formatted sql
-- PLG-upload; B6 Signed.

--changeset vera:0330-plugin-packages
CREATE TABLE plugin_uploads (
  id text PRIMARY KEY,
  file_name text NOT NULL,
  uploaded_by text NOT NULL REFERENCES users (id),
  uploaded_at timestamptz NOT NULL,
  sha256 text NOT NULL,
  package jsonb NOT NULL,
  jar bytea NOT NULL
);

CREATE TABLE plugin_packages (
  implementation_id text NOT NULL REFERENCES plugin_implementations (id),
  version text NOT NULL,
  sha256 text NOT NULL,
  jar bytea NOT NULL,
  PRIMARY KEY (implementation_id, version),
  UNIQUE (sha256)
);
--rollback DROP TABLE plugin_packages; DROP TABLE plugin_uploads;

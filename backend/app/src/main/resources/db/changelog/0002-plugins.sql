--liquibase formatted sql
-- Installed plugin implementations and instances (PLG-declares, PLG-settings).

--changeset vera:0002-plugins
CREATE TABLE plugin_implementations (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  versions jsonb NOT NULL,
  position integer NOT NULL
);

CREATE TABLE plugin_instances (
  id text PRIMARY KEY,
  name text NOT NULL,
  implementation_id text NOT NULL REFERENCES plugin_implementations (id) DEFERRABLE INITIALLY DEFERRED,
  configuration jsonb NOT NULL,
  settings jsonb,
  triggers jsonb NOT NULL,
  is_enabled boolean NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  last_run_at timestamptz,
  position integer NOT NULL
);
--rollback DROP TABLE plugin_instances; DROP TABLE plugin_implementations;

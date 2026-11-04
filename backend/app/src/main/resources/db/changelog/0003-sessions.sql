--liquibase formatted sql
-- Login sessions (E14); the cookie token is stored only by its SHA-256 hash.

--changeset vera:0003-sessions
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  instance_id text,
  plugin_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL,
  seen_at timestamptz NOT NULL,
  renewed_at timestamptz NOT NULL
);

CREATE INDEX sessions_user ON sessions (user_id);
--rollback DROP TABLE sessions;

-- Users & Groups request custody and per-person settings.

CREATE TABLE request_custodies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_fallback INTEGER NOT NULL CHECK (is_fallback IN (0, 1))
);

CREATE TABLE request_custody_members (
  custody_id TEXT NOT NULL REFERENCES request_custodies (id) DEFERRABLE INITIALLY DEFERRED,
  user_id TEXT NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (custody_id, user_id)
);

CREATE TABLE request_custody_groups (
  custody_id TEXT NOT NULL REFERENCES request_custodies (id) DEFERRABLE INITIALLY DEFERRED,
  group_id TEXT NOT NULL REFERENCES groups (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (custody_id, group_id)
);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  settings TEXT NOT NULL
);

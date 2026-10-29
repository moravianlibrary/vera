-- Installed plugin implementations and their configured instances.
CREATE TABLE plugin_implementations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  versions TEXT NOT NULL
);

CREATE TABLE plugin_instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  implementation_id TEXT NOT NULL REFERENCES plugin_implementations (id),
  configuration TEXT NOT NULL,
  settings TEXT,
  triggers TEXT NOT NULL,
  is_enabled INTEGER NOT NULL CHECK (is_enabled IN (0, 1)),
  is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TEXT NOT NULL,
  last_run_at TEXT
);

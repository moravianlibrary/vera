-- Who is signed in (handoff decision 2): one row per session, found by the SHA-256 of its token.
-- The token itself is only ever in the person's cookie.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- The Identity instance it was opened through; null for /_engine/sessions.
  instance_id TEXT,
  -- What the Identity plugin keeps between renewals (T4); opaque here.
  state TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  renewed_at TEXT NOT NULL
);

CREATE INDEX sessions_user ON sessions (user_id);

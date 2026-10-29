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

-- A redirect login under way: where the person goes back to. Good for 10 minutes.
CREATE TABLE login_flows (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Local accounts' passwords (handoff decision 6), hashed with Bun.password.
CREATE TABLE local_passwords (
  instance_id TEXT NOT NULL,
  username TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (instance_id, username)
);

-- Development only: the accounts the fake providers know (handoff decision 5).
CREATE TABLE fake_identity_accounts (
  instance_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  email_verified INTEGER NOT NULL CHECK (email_verified IN (0, 1)),
  claims TEXT NOT NULL,
  PRIMARY KEY (instance_id, external_id)
);

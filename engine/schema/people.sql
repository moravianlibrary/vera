-- People and what the session reads of them: users, roles and the ways a person holds them,
-- identities, groups, categories and custody (ACCESS-role-ways, ACCESS-group, ACCESS-suspend).
-- Order is kept by rowid, the order rows were written in. Foreign keys are checked at commit,
-- so a seed may name a row before it is written, and a table may name one in another file.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'agent')),
  email TEXT,
  -- Where an agent's proposals enter.
  entry TEXT,
  suspended_at TEXT
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  names TEXT NOT NULL,
  description TEXT NOT NULL,
  is_shipped INTEGER NOT NULL CHECK (is_shipped IN (0, 1)),
  -- A JSON array of { permission, scope }.
  grants TEXT NOT NULL,
  proposal_batch_limit INTEGER,
  proposal_daily_limit INTEGER
);

CREATE TABLE user_hand_roles (
  user_id TEXT NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  role_id TEXT NOT NULL REFERENCES roles (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_mapped_roles (
  user_id TEXT NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  role_id TEXT NOT NULL REFERENCES roles (id) DEFERRABLE INITIALLY DEFERRED,
  instance_id TEXT NOT NULL,
  claim TEXT NOT NULL
);

CREATE TABLE user_identities (
  user_id TEXT NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  instance_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  last_login_at TEXT,
  -- ACCESS-identity-key: found by (instance, external id).
  UNIQUE (instance_id, external_id)
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups (id) DEFERRABLE INITIALLY DEFERRED,
  user_id TEXT NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_categories (
  group_id TEXT NOT NULL REFERENCES groups (id) DEFERRABLE INITIALLY DEFERRED,
  category_id TEXT NOT NULL REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (group_id, category_id)
);

-- Custody granted to a person directly; a group's is in group_categories.
CREATE TABLE category_members (
  category_id TEXT NOT NULL REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  user_id TEXT NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (category_id, user_id)
);


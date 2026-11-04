--liquibase formatted sql
-- People and the access data read by sessions (ACCESS-role-ways, ACCESS-group, ACCESS-suspend).

--changeset vera:0001-people
CREATE TABLE users (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('person', 'agent')),
  email text,
  entry text,
  suspended_at timestamptz,
  position integer NOT NULL
);

CREATE TABLE roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  is_shipped boolean NOT NULL,
  proposal_batch_limit integer CHECK (proposal_batch_limit IS NULL OR proposal_batch_limit >= 0),
  proposal_daily_limit integer CHECK (proposal_daily_limit IS NULL OR proposal_daily_limit >= 0),
  position integer NOT NULL
);

CREATE TABLE role_grants (
  role_id text NOT NULL REFERENCES roles (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  permission text NOT NULL,
  scope text CHECK (scope IS NULL OR scope IN ('custody', 'project', 'managed', 'any')),
  PRIMARY KEY (role_id, position)
);

CREATE TABLE user_hand_roles (
  user_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  role_id text NOT NULL REFERENCES roles (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  PRIMARY KEY (user_id, role_id),
  UNIQUE (user_id, position)
);

CREATE TABLE user_mapped_roles (
  user_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  role_id text NOT NULL REFERENCES roles (id) DEFERRABLE INITIALLY DEFERRED,
  instance_id text NOT NULL,
  claim text NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (user_id, position)
);

CREATE TABLE user_identities (
  user_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  instance_id text NOT NULL,
  external_id text NOT NULL,
  last_login_at timestamptz,
  position integer NOT NULL,
  UNIQUE (instance_id, external_id),
  PRIMARY KEY (user_id, instance_id, external_id),
  UNIQUE (user_id, position)
);

CREATE TABLE categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  parent_id text REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL
);

CREATE TABLE groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  position integer NOT NULL
);

CREATE TABLE group_members (
  group_id text NOT NULL REFERENCES groups (id) DEFERRABLE INITIALLY DEFERRED,
  user_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  PRIMARY KEY (group_id, user_id),
  UNIQUE (group_id, position)
);

CREATE TABLE group_categories (
  group_id text NOT NULL REFERENCES groups (id) DEFERRABLE INITIALLY DEFERRED,
  category_id text NOT NULL REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  PRIMARY KEY (group_id, category_id),
  UNIQUE (group_id, position)
);

CREATE TABLE category_members (
  category_id text NOT NULL REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  user_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  PRIMARY KEY (category_id, user_id),
  UNIQUE (category_id, position)
);
--rollback DROP TABLE category_members; DROP TABLE group_categories; DROP TABLE group_members; DROP TABLE groups; DROP TABLE categories; DROP TABLE user_identities; DROP TABLE user_mapped_roles; DROP TABLE user_hand_roles; DROP TABLE role_grants; DROP TABLE roles; DROP TABLE users;

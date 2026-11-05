--liquibase formatted sql
-- Request custody membership read by request lists (ACCESS-custody).

--changeset vera:0012-request-custodies
CREATE TABLE request_custodies (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  is_fallback boolean NOT NULL,
  position integer NOT NULL
);
CREATE UNIQUE INDEX request_custodies_one_fallback ON request_custodies (is_fallback) WHERE is_fallback;
CREATE TABLE request_custody_members (
  custody_id text NOT NULL REFERENCES request_custodies (id) DEFERRABLE INITIALLY DEFERRED,
  user_id text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  PRIMARY KEY (custody_id, user_id),
  UNIQUE (custody_id, position)
);
CREATE TABLE request_custody_groups (
  custody_id text NOT NULL REFERENCES request_custodies (id) DEFERRABLE INITIALLY DEFERRED,
  group_id text NOT NULL REFERENCES groups (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  PRIMARY KEY (custody_id, group_id),
  UNIQUE (custody_id, position)
);
--rollback DROP TABLE request_custody_groups; DROP TABLE request_custody_members; DROP TABLE request_custodies;

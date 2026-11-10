--liquibase formatted sql

--changeset vera:0370-watchlists
CREATE TABLE watchlists (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id),
  name text NOT NULL,
  view text NOT NULL,
  filter jsonb NOT NULL,
  audience jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  copied_from text REFERENCES watchlists(id),
  filter_version integer NOT NULL DEFAULT 1,
  position integer NOT NULL
);
CREATE TABLE watchlist_viewers (
  user_id text NOT NULL REFERENCES users(id),
  watchlist_id text NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  seen_at timestamptz,
  position integer NOT NULL,
  push boolean NOT NULL DEFAULT true,
  push_since timestamptz,
  channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_filter text,
  PRIMARY KEY (user_id, watchlist_id)
);
CREATE TABLE watchlist_entries (
  user_id text NOT NULL REFERENCES users(id),
  watchlist_id text NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  record_id text NOT NULL,
  entered_at timestamptz NOT NULL,
  baseline boolean NOT NULL DEFAULT false,
  filter_version integer NOT NULL DEFAULT 1,
  delivered_at jsonb NOT NULL DEFAULT '{}'::jsonb,
  push_delivered_at timestamptz,
  PRIMARY KEY (user_id, watchlist_id, record_id, entered_at)
);
CREATE TABLE watchlist_baselines (
  id text PRIMARY KEY
);
CREATE TABLE push_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (user_id, endpoint)
);
CREATE INDEX watchlist_entries_unseen ON watchlist_entries (user_id, watchlist_id, entered_at)
  WHERE baseline = false;
CREATE INDEX watchlists_owner ON watchlists (owner_id, position);
--rollback DROP TABLE push_devices; DROP TABLE watchlist_baselines; DROP TABLE watchlist_entries; DROP TABLE watchlist_viewers; DROP TABLE watchlists;

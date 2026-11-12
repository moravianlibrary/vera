--liquibase formatted sql

--changeset vera:0380-watchlist-engine
CREATE TABLE watchlist_mail_windows (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  send_at timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN ('waiting', 'sent', 'empty')),
  UNIQUE (user_id, send_at)
);
CREATE INDEX watchlist_mail_windows_due ON watchlist_mail_windows (send_at) WHERE state = 'waiting';
CREATE TABLE watchlist_push_batches (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  watchlist_id text NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  first_at timestamptz NOT NULL,
  send_at timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN ('waiting', 'sent', 'empty'))
);
CREATE INDEX watchlist_push_batches_due ON watchlist_push_batches (send_at) WHERE state = 'waiting';
--rollback DROP TABLE watchlist_push_batches; DROP TABLE watchlist_mail_windows;

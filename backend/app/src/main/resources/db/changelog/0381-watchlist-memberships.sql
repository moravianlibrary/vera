--liquibase formatted sql

--changeset vera:0381-watchlist-memberships
CREATE TABLE watchlist_memberships (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  watchlist_id text NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  record_id text NOT NULL,
  PRIMARY KEY (user_id, watchlist_id, record_id)
);
--rollback DROP TABLE watchlist_memberships;

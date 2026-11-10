--liquibase formatted sql

--changeset vera:0360-hooks
CREATE TABLE hooks (
  id text PRIMARY KEY,
  name text NOT NULL,
  events jsonb NOT NULL,
  filter text NOT NULL,
  channel_id text NOT NULL REFERENCES plugin_instances(id),
  recipient text NOT NULL,
  message text NOT NULL,
  batch jsonb,
  retry jsonb NOT NULL,
  recipient_preference jsonb,
  include_private boolean NOT NULL DEFAULT false,
  state text NOT NULL CHECK (state IN ('active', 'paused')),
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL,
  pause jsonb,
  position integer NOT NULL
);
CREATE TABLE hook_deliveries (
  id text PRIMARY KEY,
  hook_id text NOT NULL,
  recipient text NOT NULL,
  subjects jsonb NOT NULL,
  events jsonb NOT NULL,
  event_ids jsonb NOT NULL,
  public_text text NOT NULL,
  state text NOT NULL CHECK (state IN ('waiting', 'gave_up', 'sent', 'discarded', 'suppressed')),
  first_at timestamptz NOT NULL,
  last_at timestamptz NOT NULL,
  send_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  manage_notifications_url text,
  manage_notifications_url_present boolean NOT NULL DEFAULT false,
  position integer NOT NULL
);
CREATE INDEX hook_deliveries_hook ON hook_deliveries(hook_id, state);
CREATE TABLE hook_attempts (
  id text PRIMARY KEY,
  delivery_id text NOT NULL REFERENCES hook_deliveries(id) ON DELETE CASCADE,
  at timestamptz NOT NULL,
  result text NOT NULL CHECK (result IN ('sent', 'failed')),
  detail text NOT NULL,
  duration_ms integer NOT NULL,
  position integer NOT NULL
);
CREATE TABLE notification_tokens (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hook_id text NOT NULL REFERENCES hooks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
--rollback DROP TABLE notification_tokens; DROP TABLE hook_attempts; DROP TABLE hook_deliveries; DROP TABLE hooks;

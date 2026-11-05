--liquibase formatted sql
-- Per-person settings follow the signed-in person across devices.

--changeset vera:0009-user-settings
CREATE TABLE user_settings (
  user_id text PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  settings jsonb NOT NULL
);
--rollback DROP TABLE user_settings;

COMMENT ON TABLE user_settings IS 'Account and settings follow the signed-in person across devices.';

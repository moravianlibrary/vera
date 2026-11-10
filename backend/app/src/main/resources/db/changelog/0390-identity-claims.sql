--liquibase formatted sql
-- WATCH-delivery; MSG-recipients: preserve the claims returned by each identity provider.

--changeset vera:0390-identity-claims
ALTER TABLE user_identities
  ADD COLUMN claims jsonb NOT NULL DEFAULT '{}'::jsonb;

--rollback ALTER TABLE user_identities DROP COLUMN claims;

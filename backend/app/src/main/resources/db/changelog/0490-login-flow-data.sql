--liquibase formatted sql
-- Redirect login providers retain per-login PKCE verifier and nonce on the host.

--changeset vera:0490-login-flow-data
ALTER TABLE login_flows ADD COLUMN flow_data jsonb NOT NULL DEFAULT '{}'::jsonb;
--rollback ALTER TABLE login_flows DROP COLUMN flow_data;

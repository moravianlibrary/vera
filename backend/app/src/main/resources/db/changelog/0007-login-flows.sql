--liquibase formatted sql
-- Redirect login flows (ACCESS-login-return).

--changeset vera:0007-login-flows
CREATE TABLE login_flows (
  id text PRIMARY KEY,
  instance_id text NOT NULL,
  return_to text NOT NULL,
  created_at timestamptz NOT NULL
);
--rollback DROP TABLE login_flows;

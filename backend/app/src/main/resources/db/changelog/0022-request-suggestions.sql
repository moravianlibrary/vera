--liquibase formatted sql
-- Stored classifier suggestions for checked requests (VIEW-requests, PLG-api-kinds).

--changeset vera:0022-request-suggestions
CREATE TABLE request_suggestions (
  request_id text PRIMARY KEY REFERENCES requests (id) DEFERRABLE INITIALLY DEFERRED,
  category_id text NOT NULL REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  reason text NOT NULL,
  classifier_id text NOT NULL REFERENCES plugin_instances (id) DEFERRABLE INITIALLY DEFERRED
);
--rollback DROP TABLE request_suggestions;

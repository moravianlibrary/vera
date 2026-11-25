--liquibase formatted sql
-- PLG-api-session: an instance's request limit, {"requests": n, "minutes": m}; null for the default.

--changeset vera:0530-plugin-instance-request-limit
ALTER TABLE plugin_instances ADD COLUMN request_limit jsonb;
--rollback ALTER TABLE plugin_instances DROP COLUMN request_limit;

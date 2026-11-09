--liquibase formatted sql
-- PLAN-generate: retain the implementation description returned with its generator instance.

--changeset vera:0270-list-generator-descriptions
ALTER TABLE plugin_implementations ADD COLUMN description text NOT NULL DEFAULT '';
--rollback ALTER TABLE plugin_implementations DROP COLUMN description;

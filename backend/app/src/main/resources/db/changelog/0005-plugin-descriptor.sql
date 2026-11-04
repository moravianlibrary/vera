--liquibase formatted sql
-- Preserve the plugin descriptor id used to resolve installed plugin versions.

--changeset vera:0005-plugin-descriptor
ALTER TABLE plugin_implementations ADD COLUMN descriptor_id text NOT NULL UNIQUE;
--rollback ALTER TABLE plugin_implementations DROP COLUMN descriptor_id;

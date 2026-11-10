--liquibase formatted sql
-- BK7e; PLG-model; PLG-secrets.

--changeset vera:0320-plugin-instance-details
ALTER TABLE plugin_instances ADD COLUMN version text NOT NULL DEFAULT '';
ALTER TABLE plugin_instances ADD COLUMN policy jsonb;
ALTER TABLE plugin_instances ADD COLUMN linked_category_id text REFERENCES categories (id)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE plugin_instances ADD COLUMN is_predefined boolean NOT NULL DEFAULT false;
ALTER TABLE plugin_instances ADD COLUMN created_by text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED;

--rollback ALTER TABLE plugin_instances DROP COLUMN created_by; ALTER TABLE plugin_instances DROP COLUMN is_predefined; ALTER TABLE plugin_instances DROP COLUMN linked_category_id; ALTER TABLE plugin_instances DROP COLUMN policy; ALTER TABLE plugin_instances DROP COLUMN version;

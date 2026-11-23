--liquibase formatted sql
-- PLG-bases: the catalog bases whose records an instance reads; none for every record.

--changeset vera:0510-plugin-instance-catalog-bases
ALTER TABLE plugin_instances ADD COLUMN catalog_bases jsonb NOT NULL DEFAULT '[]';
--rollback ALTER TABLE plugin_instances DROP COLUMN catalog_bases;

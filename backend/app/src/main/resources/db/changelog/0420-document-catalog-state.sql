--liquibase formatted sql

--changeset vera:0420-document-catalog-state
-- DOC-relink.
ALTER TABLE documents ADD COLUMN catalog_state jsonb;
--rollback ALTER TABLE documents DROP COLUMN catalog_state;

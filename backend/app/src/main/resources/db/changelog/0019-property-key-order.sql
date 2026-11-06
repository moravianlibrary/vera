--liquibase formatted sql
-- Preserve the seed's property key order (DOC-property-values).

--changeset vera:0019-property-key-order
ALTER TABLE document_property_sources ADD COLUMN key_position integer NOT NULL DEFAULT 0;
ALTER TABLE iteration_property_sources ADD COLUMN key_position integer NOT NULL DEFAULT 0;
--rollback ALTER TABLE iteration_property_sources DROP COLUMN key_position; ALTER TABLE document_property_sources DROP COLUMN key_position;

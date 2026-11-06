--liquibase formatted sql
-- Stored values used by the Documents list (VIEW-documents; DOC-property-filter).

--changeset vera:0020-document-list
ALTER TABLE documents ADD COLUMN position bigint GENERATED ALWAYS AS IDENTITY;
CREATE TABLE document_property_values (
  document_id text NOT NULL REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  key text NOT NULL,
  ordinal integer NOT NULL,
  text_value text NOT NULL,
  number_value numeric,
  PRIMARY KEY (document_id, key, ordinal)
);
CREATE INDEX document_property_values_key_text ON document_property_values (key, text_value);
--rollback DROP TABLE document_property_values; ALTER TABLE documents DROP COLUMN position;

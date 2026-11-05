--liquibase formatted sql
-- Documents and catalog evidence (DOC-property-values, DOC-identifiers).

--changeset vera:0014-documents
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE documents (
  id text PRIMARY KEY,
  catalog_id text NOT NULL,
  unit_type text CHECK (unit_type IS NULL OR unit_type IN (
    'volume-name', 'volume-number', 'barcode')),
  unit_value text,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'Periodical', 'Monograph', 'Manuscript', 'Map')),
  shelf_mark text,
  CHECK ((unit_type IS NULL) = (unit_value IS NULL))
);
CREATE INDEX documents_title_trgm ON documents USING gin (title gin_trgm_ops);
CREATE INDEX documents_catalog_id_trgm ON documents USING gin (catalog_id gin_trgm_ops);
CREATE INDEX documents_unit_value_trgm ON documents USING gin (unit_value gin_trgm_ops);
CREATE INDEX documents_shelf_mark_trgm ON documents USING gin (shelf_mark gin_trgm_ops);
CREATE TABLE document_page_sources (
  document_id text NOT NULL REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  source text NOT NULL CHECK (source IN (
    'manual', 'catalog', 'predictor')),
  tier integer NOT NULL,
  value integer NOT NULL CHECK (value >= 0),
  observed_at timestamptz NOT NULL,
  set_by text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (document_id, position)
);
CREATE TABLE document_registry_records (
  document_id text NOT NULL REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  registry text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'CheckFailed', 'NotFound', 'Unmapped', 'Planned', 'InProgress', 'Digitized', 'Published')),
  raw_state text,
  link_kind text CHECK (link_kind IS NULL OR link_kind IN ('content', 'record')),
  url text,
  observed_at timestamptz NOT NULL,
  checked_at timestamptz NOT NULL,
  error text,
  PRIMARY KEY (document_id, position)
);
CREATE TABLE document_property_sources (
  document_id text NOT NULL REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  key text NOT NULL,
  position integer NOT NULL,
  source jsonb NOT NULL,
  tier integer NOT NULL,
  value jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  set_by text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  PRIMARY KEY (document_id, key, position)
);
--rollback DROP TABLE document_property_sources; DROP TABLE document_registry_records; DROP TABLE document_page_sources; DROP TABLE documents; DROP EXTENSION IF EXISTS pg_trgm;

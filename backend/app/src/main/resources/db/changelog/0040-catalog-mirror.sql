--liquibase formatted sql
-- B6a PLG-api-mirror. B6a later adds the tsvector search column and the sync cursor.

--changeset vera:0040-catalog-mirror
CREATE TABLE catalog_mirror (
  instance_id text NOT NULL REFERENCES plugin_instances (id) DEFERRABLE INITIALLY DEFERRED,
  catalog_id text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  units jsonb,
  record jsonb NOT NULL,
  fetched_at timestamptz NOT NULL,
  position integer NOT NULL,
  PRIMARY KEY (instance_id, catalog_id)
);
CREATE INDEX catalog_mirror_title_trgm ON catalog_mirror USING gin (title gin_trgm_ops);
CREATE INDEX catalog_mirror_catalog_id_trgm ON catalog_mirror USING gin (catalog_id gin_trgm_ops);
CREATE TABLE catalog_mirror_keys (
  instance_id text NOT NULL,
  catalog_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('identifier', 'barcode', 'shelfMark')),
  value text NOT NULL,
  normalized text NOT NULL,
  unit text,
  position integer NOT NULL,
  PRIMARY KEY (instance_id, catalog_id, kind, position),
  FOREIGN KEY (instance_id, catalog_id) REFERENCES catalog_mirror (instance_id, catalog_id)
    DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX catalog_mirror_keys_lookup ON catalog_mirror_keys (kind, normalized);
--rollback DROP TABLE catalog_mirror_keys; DROP TABLE catalog_mirror;

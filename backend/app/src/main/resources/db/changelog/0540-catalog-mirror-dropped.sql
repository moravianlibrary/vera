--liquibase formatted sql
-- PLG-api-mirror: a record the catalog dropped while a document names it stays, as last fetched,
-- marked when it was dropped; and the next row's position is read from an index, not counted.

--changeset vera:0540-catalog-mirror-dropped
ALTER TABLE catalog_mirror ADD COLUMN dropped_at timestamptz;
CREATE INDEX catalog_mirror_position ON catalog_mirror (instance_id, position);
--rollback DROP INDEX catalog_mirror_position; ALTER TABLE catalog_mirror DROP COLUMN dropped_at;

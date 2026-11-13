--liquibase formatted sql
-- ACT-plugin-reset; PLG-api-mirror.

--changeset vera:0440-plugin-reset
ALTER TABLE plugin_instances ADD COLUMN rebuild_after timestamptz;
CREATE TABLE catalog_mirror_sync (
  instance_id text PRIMARY KEY REFERENCES plugin_instances (id) ON DELETE CASCADE,
  synced_at timestamptz NOT NULL
);
INSERT INTO catalog_mirror_sync (instance_id, synced_at)
SELECT instance_id, max(fetched_at) FROM catalog_mirror GROUP BY instance_id;

--rollback DROP TABLE catalog_mirror_sync; ALTER TABLE plugin_instances DROP COLUMN rebuild_after;

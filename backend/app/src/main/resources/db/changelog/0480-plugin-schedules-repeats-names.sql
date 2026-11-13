--liquibase formatted sql
-- Keep the legacy English columns for background run labels.

--changeset vera:0480-plugin-schedules-repeats-names
ALTER TABLE plugin_instances ADD COLUMN names jsonb;
UPDATE plugin_instances SET names = jsonb_build_object('en', name);
ALTER TABLE plugin_instances ALTER COLUMN names SET NOT NULL;

ALTER TABLE schedules ADD COLUMN names jsonb;
UPDATE schedules SET names = jsonb_build_object('en', name);
ALTER TABLE schedules ALTER COLUMN names SET NOT NULL;

ALTER TABLE intention_templates ADD COLUMN name_patterns jsonb;
UPDATE intention_templates SET name_patterns = jsonb_build_object('en', name_pattern);
ALTER TABLE intention_templates ALTER COLUMN name_patterns SET NOT NULL;
--rollback ALTER TABLE intention_templates DROP COLUMN name_patterns; ALTER TABLE schedules DROP COLUMN names; ALTER TABLE plugin_instances DROP COLUMN names;

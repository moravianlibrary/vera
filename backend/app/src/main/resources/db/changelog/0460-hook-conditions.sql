--liquibase formatted sql

--changeset vera:0460-hook-conditions
-- Existing free-text conditions cannot be translated safely. Seeded development databases are rebuilt.
ALTER TABLE hooks DROP COLUMN filter;
ALTER TABLE hooks ADD COLUMN conditions jsonb NOT NULL DEFAULT '{}'::jsonb;
--rollback ALTER TABLE hooks DROP COLUMN conditions; ALTER TABLE hooks ADD COLUMN filter text NOT NULL DEFAULT '';

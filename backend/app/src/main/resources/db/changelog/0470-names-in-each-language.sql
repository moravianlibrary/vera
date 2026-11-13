--liquibase formatted sql
-- Names are stored in both languages; name remains the English label for background jobs.

--changeset vera:0470-names-in-each-language
ALTER TABLE roles ADD COLUMN names jsonb;
UPDATE roles SET names = jsonb_build_object('en', name);
ALTER TABLE roles ALTER COLUMN names SET NOT NULL;

ALTER TABLE request_custodies ADD COLUMN names jsonb;
UPDATE request_custodies SET names = jsonb_build_object('en', name);
ALTER TABLE request_custodies ALTER COLUMN names SET NOT NULL;

ALTER TABLE watchlists ADD COLUMN names jsonb;
UPDATE watchlists SET names = jsonb_build_object('en', name);
ALTER TABLE watchlists ALTER COLUMN names SET NOT NULL;

ALTER TABLE categories ADD COLUMN names jsonb;
UPDATE categories SET names = jsonb_build_object('en', name);
ALTER TABLE categories ALTER COLUMN names SET NOT NULL;

ALTER TABLE mixes ADD COLUMN names jsonb;
UPDATE mixes SET names = jsonb_build_object('en', name);
ALTER TABLE mixes ALTER COLUMN names SET NOT NULL;
--rollback ALTER TABLE mixes DROP COLUMN names; ALTER TABLE categories DROP COLUMN names; ALTER TABLE watchlists DROP COLUMN names; ALTER TABLE request_custodies DROP COLUMN names; ALTER TABLE roles DROP COLUMN names;

--liquibase formatted sql
-- Stable history and batch order (VIEW-documents).

--changeset vera:0018-insertion-order
ALTER TABLE events ADD COLUMN position bigint GENERATED ALWAYS AS IDENTITY;
ALTER TABLE batches ADD COLUMN position bigint GENERATED ALWAYS AS IDENTITY;
--rollback ALTER TABLE batches DROP COLUMN position; ALTER TABLE events DROP COLUMN position;

--liquibase formatted sql
-- PLAN-mix-remove: IDs remain retired after a mix is permanently removed.

--changeset vera:0230-mix-deleted-ids
CREATE TABLE deleted_mix_ids (
  id text PRIMARY KEY
);

--rollback DROP TABLE deleted_mix_ids;

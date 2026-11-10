--liquibase formatted sql
-- PLG-run-items: page-based runs can record an item error before it has an iteration.

--changeset vera:0316-run-page-errors
ALTER TABLE run_errors ALTER COLUMN iteration_id DROP NOT NULL;

--rollback ALTER TABLE run_errors ALTER COLUMN iteration_id SET NOT NULL;

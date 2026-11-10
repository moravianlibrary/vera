--liquibase formatted sql
-- ENT-schedule; a queued occurrence is also the stale-job token, and position preserves seed order.
--changeset vera:0340-schedule-occurrence
ALTER TABLE schedules ADD COLUMN next_at timestamptz;
ALTER TABLE schedules ADD COLUMN position integer NOT NULL DEFAULT 0;
--rollback ALTER TABLE schedules DROP COLUMN position; ALTER TABLE schedules DROP COLUMN next_at;

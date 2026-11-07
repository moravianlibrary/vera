--liquibase formatted sql
-- Values needed by the validation list without decoding every iteration (STAT-validation).

--changeset vera:0080-validation-states
ALTER TABLE iteration_states ADD COLUMN review_state text CHECK (review_state IS NULL OR
  review_state IN ('Needed', 'Denied', 'Approved', 'Forbidden'));
ALTER TABLE iteration_states ADD COLUMN waiting_since timestamptz;
--rollback ALTER TABLE iteration_states DROP COLUMN waiting_since; ALTER TABLE iteration_states DROP COLUMN review_state;

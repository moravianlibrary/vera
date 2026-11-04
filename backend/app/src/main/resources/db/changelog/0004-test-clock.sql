--liquibase formatted sql
-- The movable test clock (B5, B8); `wall_at` records when the running clock was set and is null when frozen.

--changeset vera:0004-test-clock context:test
CREATE TABLE test_clock (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  at timestamptz NOT NULL,
  wall_at timestamptz
);
--rollback DROP TABLE test_clock;

--liquibase formatted sql
-- LC-LIST-state; ACT-cancel; ACT-list-create.

--changeset vera:0140-digitization-lists
CREATE TABLE digitization_lists (
  id text PRIMARY KEY,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  target_pages integer CHECK (target_pages IS NULL OR target_pages >= 0),
  generated jsonb,
  created_by text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  created_at timestamptz NOT NULL,
  done_actor_id text REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  done_at timestamptz,
  position integer NOT NULL,
  CHECK ((done_actor_id IS NULL) = (done_at IS NULL))
);

-- Lists were not stored before this changeset; a reset reloads them from the seed.
UPDATE iterations
SET list_id = NULL
WHERE list_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM digitization_lists WHERE digitization_lists.id = iterations.list_id
  );

ALTER TABLE iterations
  ADD CONSTRAINT iterations_list_fk FOREIGN KEY (list_id) REFERENCES digitization_lists (id)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT iterations_former_list_name_check CHECK (list_id IS NULL OR former_list_name IS NULL);

--rollback ALTER TABLE iterations DROP CONSTRAINT iterations_former_list_name_check, DROP CONSTRAINT iterations_list_fk; DROP TABLE digitization_lists;

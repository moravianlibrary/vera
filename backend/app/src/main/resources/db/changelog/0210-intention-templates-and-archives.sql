--liquibase formatted sql
-- PLAN-repeat; LC-INT-repeat; LC-INT-archive. Archives capture the displayed intention row,
-- its selected mix tree when it has a mix, and the category tree at archive time.

--changeset vera:0210-intention-templates-and-archives
CREATE TABLE intention_templates (
  id text PRIMARY KEY,
  name_pattern text NOT NULL,
  every text NOT NULL CHECK (every IN ('week', 'month', 'quarter')),
  funding_kind text NOT NULL CHECK (funding_kind IN ('any', 'none', 'project')),
  funding_project_id text REFERENCES projects (id) DEFERRABLE INITIALLY DEFERRED,
  scope_category_id text REFERENCES categories (id) DEFERRABLE INITIALLY DEFERRED,
  scope_conditions jsonb,
  distribution_id text REFERENCES mixes (id) DEFERRABLE INITIALLY DEFERRED,
  mix_revision integer CHECK (mix_revision IS NULL OR mix_revision > 0),
  target_pages integer CHECK (target_pages IS NULL OR target_pages > 0),
  is_archiving_previous boolean NOT NULL,
  since date NOT NULL,
  next_on date NOT NULL,
  created_by text NOT NULL REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED,
  position integer NOT NULL,
  CHECK ((funding_kind = 'project') = (funding_project_id IS NOT NULL)),
  FOREIGN KEY (distribution_id, mix_revision) REFERENCES mix_revisions (mix_id, revision)
    DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE archived_intention_snapshots (
  intention_id text PRIMARY KEY REFERENCES intentions (id) DEFERRABLE INITIALLY DEFERRED,
  captured_row jsonb NOT NULL,
  mix_tree jsonb,
  category_tree jsonb NOT NULL
);
ALTER TABLE intentions
  ADD CONSTRAINT intentions_template_fk FOREIGN KEY (template_id) REFERENCES intention_templates (id)
    DEFERRABLE INITIALLY DEFERRED;

--rollback ALTER TABLE intentions DROP CONSTRAINT intentions_template_fk; DROP TABLE archived_intention_snapshots; DROP TABLE intention_templates;

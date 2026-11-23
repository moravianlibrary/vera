--liquibase formatted sql
-- STAT-public: what askers read about a restriction, per language; null for VERA's own wording.

--changeset vera:0520-restriction-public-texts
ALTER TABLE iterations ALTER COLUMN restriction_public_text TYPE jsonb
  USING CASE WHEN restriction_public_text IS NULL THEN NULL
    ELSE jsonb_build_object('en', restriction_public_text) END;
--rollback ALTER TABLE iterations ALTER COLUMN restriction_public_text TYPE text USING restriction_public_text ->> 'en';

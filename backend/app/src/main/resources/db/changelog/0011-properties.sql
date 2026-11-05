--liquibase formatted sql
-- Definitions for document and iteration properties (PROP-definition, PROP-value).

--changeset vera:0011-properties
CREATE TABLE property_definitions (
  key text PRIMARY KEY,
  names jsonb NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('public', 'staff')),
  type jsonb NOT NULL,
  is_list boolean NOT NULL,
  about text NOT NULL CHECK (about IN ('document', 'attempt')),
  hand_tier integer,
  is_predefined boolean NOT NULL,
  position integer NOT NULL
);
--rollback DROP TABLE property_definitions;

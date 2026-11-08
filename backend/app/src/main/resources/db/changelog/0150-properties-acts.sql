--liquibase formatted sql
-- Deleted keys remain reserved forever (DOC-property-delete).

--changeset vera:0150-properties-acts
CREATE TABLE deleted_property_keys (
  key text PRIMARY KEY
);

--rollback DROP TABLE deleted_property_keys;

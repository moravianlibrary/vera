--liquibase formatted sql

--changeset vera:0255-intention-template-descriptions
ALTER TABLE intention_templates ADD COLUMN description text NOT NULL DEFAULT '';

--rollback ALTER TABLE intention_templates DROP COLUMN description;

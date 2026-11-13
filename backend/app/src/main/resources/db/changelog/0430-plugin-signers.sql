--liquibase formatted sql
-- PLG-upload; B6 Signed: keep the certificate subject with the installed package.

--changeset vera:0430-plugin-signers
ALTER TABLE plugin_packages ADD COLUMN signer text;
--rollback ALTER TABLE plugin_packages DROP COLUMN signer;

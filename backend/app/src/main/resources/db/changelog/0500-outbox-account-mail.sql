--liquibase formatted sql
-- ACCESS-sign-up: VERA's record of an account mail, which the account.mail job sends.

--changeset vera:0500-outbox-account-mail
ALTER TABLE outbox DROP CONSTRAINT outbox_channel_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_channel_check
    CHECK (channel IN ('mail', 'chat', 'webhook', 'push', 'file', 'account'));
--rollback ALTER TABLE outbox DROP CONSTRAINT outbox_channel_check; ALTER TABLE outbox ADD CONSTRAINT outbox_channel_check CHECK (channel IN ('mail', 'chat', 'webhook', 'push', 'file'));

--liquibase formatted sql
-- EVENT-destinations: SFTP delivery records use the same test outbox.

--changeset vera:0290-delivery-outbox-file
ALTER TABLE outbox DROP CONSTRAINT outbox_channel_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_channel_check
    CHECK (channel IN ('mail', 'chat', 'webhook', 'push', 'file'));
--rollback ALTER TABLE outbox DROP CONSTRAINT outbox_channel_check; ALTER TABLE outbox ADD CONSTRAINT outbox_channel_check CHECK (channel IN ('mail', 'chat', 'webhook', 'push'));

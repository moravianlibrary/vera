--liquibase formatted sql
-- LC-REQ-approve-now; LC-REQ-checks-job: keep approval while a proposal awaits its checks.

--changeset vera:0410-proposal-checks
ALTER TABLE requests ADD COLUMN approval_after_check_category_id text;
ALTER TABLE requests ADD COLUMN approval_after_check_priority text;
--rollback ALTER TABLE requests DROP COLUMN approval_after_check_priority; ALTER TABLE requests DROP COLUMN approval_after_check_category_id;

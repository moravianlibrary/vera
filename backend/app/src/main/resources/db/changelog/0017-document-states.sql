--liquibase formatted sql
-- Stored list states, written only by documents (STAT-validation, STAT-public, VIEW-documents).

--changeset vera:0017-document-states
CREATE TABLE document_states (
  document_id text PRIMARY KEY REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  current_iteration_id text REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  project_id text REFERENCES projects (id) DEFERRABLE INITIALLY DEFERRED,
  batch_id text REFERENCES batches (id) DEFERRABLE INITIALLY DEFERRED,
  addition_state text CHECK (addition_state IS NULL OR addition_state IN (
    'awaiting', 'declined', 'withdrawn', 'forbidden', 'reviewNeeded', 'deniedInReview', 'adding',
    'failed', 'added', 'cancelled')),
  page_count integer,
  existing_copy_state text NOT NULL CHECK (existing_copy_state IN (
    'CheckFailed', 'Unmapped', 'Planned', 'InProgress', 'Digitized', 'Published', 'None'))
);
CREATE TABLE iteration_states (
  iteration_id text PRIMARY KEY REFERENCES iterations (id) DEFERRABLE INITIALLY DEFERRED,
  document_id text NOT NULL REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  status text NOT NULL CHECK (status IN (
    'Declined', 'Withdrawn', 'AwaitingReview', 'BeingAdded', 'Cancelled', 'NotDigitizable', 'Forbidden',
    'ValidationDenied', 'ReviewNeeded', 'Enqueued', 'IngestFailed', 'Ready', 'Planned', 'InProgress',
    'Digitized', 'Published')),
  validation text NOT NULL CHECK (validation IN ('Needed', 'Denied', 'Approved', 'NotRequired')),
  is_restricted boolean NOT NULL
);
CREATE TABLE request_states (
  request_id text PRIMARY KEY REFERENCES requests (id) DEFERRABLE INITIALLY DEFERRED,
  document_id text NOT NULL REFERENCES documents (id) DEFERRABLE INITIALLY DEFERRED,
  public_status text NOT NULL CHECK (public_status IN (
    'WaitingForReview', 'NotAccepted', 'Withdrawn', 'BeingAdded', 'BeingChecked', 'WaitingToBeScheduled',
    'Scheduled', 'Available', 'OnHold', 'NotAvailable')),
  is_asker boolean NOT NULL
);
--rollback DROP TABLE request_states; DROP TABLE iteration_states; DROP TABLE document_states;

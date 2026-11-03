-- Projects held whole for project reads (PROJ-state).
CREATE TABLE projects (id TEXT PRIMARY KEY, record TEXT NOT NULL);
-- Batches held whole for request grouping (ENT-batch).
CREATE TABLE batches (id TEXT PRIMARY KEY, record TEXT NOT NULL);
-- Documents held whole for document queries (VIEW-documents).
CREATE TABLE documents (id TEXT PRIMARY KEY, record TEXT NOT NULL);
-- Attempts held whole and indexed by document (VIEW-documents).
CREATE TABLE iterations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED,
  record TEXT NOT NULL
);
CREATE INDEX iterations_document ON iterations(document_id);
-- Requests held whole and indexed for document and batch lookup (VIEW-requests).
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED,
  batch_id TEXT NOT NULL REFERENCES batches(id) DEFERRABLE INITIALLY DEFERRED,
  record TEXT NOT NULL
);
CREATE INDEX requests_document ON requests(document_id);
CREATE INDEX requests_batch ON requests(batch_id);
-- Property definitions used to interpret filters (DOC-property).
CREATE TABLE property_definitions (key TEXT PRIMARY KEY, record TEXT NOT NULL);
-- Deleted keys can never be defined again (DOC-property-delete).
CREATE TABLE deleted_property_keys (key TEXT PRIMARY KEY);
-- Opaque seed answers consumed by deterministic fake plugins (E3T4).
CREATE TABLE seed_fakes (key TEXT PRIMARY KEY, value TEXT NOT NULL);

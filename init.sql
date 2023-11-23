-- Creates actions types enum
CREATE TYPE action_type AS ENUM (
	'read_datatable_own', 'read_datatable_department', 'read_datatable_all',
	'edit_datatable_own', 'edit_datatable_department', 'edit_datatable_all',
	'write_datatable', 'comment_on_datatable',
	'edit_access', 'edit_categories',
	'extract'
);
CREATE TYPE material_type AS ENUM (
	'book', 'continuing_resource', 'map', 'msuic', 'other'
);
CREATE TYPE TASK_TYPE AS ENUM (
	'PREDICT_ITEMS_PAGES'
);
CREATE TYPE TASK_SCOPE AS ENUM (
    'ALL', 'PROCESSED', 'UNPROCESSED', 'SELECT'
);
CREATE TYPE TASK_STATE AS ENUM (
    'PLANNED', 'RUNNING', 'FINISHED', 'FAILED'
);

-- Creates roles table
CREATE TABLE IF NOT EXISTS roles (
	id serial PRIMARY KEY,
	name VARCHAR(64) UNIQUE
);

-- Creates actions x roles mapping table
CREATE TABLE IF NOT EXISTS actions (
	role_id INT NOT NULL REFERENCES roles(id),
	action action_type NOT NULL,
	PRIMARY KEY (role_id, action)
);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
	id serial PRIMARY KEY,
	abbreviation VARCHAR(16) UNIQUE,
	name VARCHAR(128) UNIQUE
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
	id serial PRIMARY KEY,
	username VARCHAR(64) UNIQUE,
	password VARCHAR(64),
	department_id INT REFERENCES departments(id),
	role_id INT REFERENCES roles(id)
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
	id SERIAL PRIMARY KEY,
	name VARCHAR(128) NOT NULL UNIQUE
);

-- Create extractions table
CREATE TABLE IF NOT EXISTS extractions (
	id SERIAL PRIMARY KEY,
	extractor_id INT REFERENCES users(id),
	extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the main data table documents
CREATE TABLE IF NOT EXISTS documents (
	id SERIAL PRIMARY KEY,
    
	-- Identifiers
	sysno VARCHAR(16) NOT NULL,
	volume_number VARCHAR(16),
	item_number VARCHAR(16),
	CONSTRAINT unique_combination UNIQUE NULLS NOT DISTINCT (sysno, volume_number, item_number),

	category_id INT REFERENCES categories(id),

	-- Information
	material_type material_type,
	title TEXT NOT NULL,
	publishers TEXT[],

	pages_count INTEGER,
	size VARCHAR(32),

	-- Additional information
	signature VARCHAR(64),
	barcode VARCHAR(32),
	ccnb VARCHAR(32),
	isbn VARCHAR(32),

	-- Insertion details
	creator_id INT NOT NULL REFERENCES users(id),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

	-- Extraction details
	extraction_id INT REFERENCES extractions(id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
	id serial PRIMARY KEY,
	document_id INT REFERENCES documents(id),
	user_id INT REFERENCES users(id),
	text TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	edited_at TIMESTAMP
);

CREATE SEQUENCE task_id_sequence;

CREATE TABLE celery_tasks (
    id INTEGER DEFAULT nextval('task_id_sequence') PRIMARY KEY,
    task_id VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(50),
    result TEXT,
    date_done TIMESTAMP WITH TIME ZONE,
    traceback TEXT,
    name VARCHAR(250),
    args TEXT,
    kwargs TEXT,
    worker VARCHAR(250),
    retries INTEGER,
    queue VARCHAR(250)
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
	id serial PRIMARY KEY,
	task_type TASK_TYPE NOT NULL,
	task_scope TASK_SCOPE NOT NULL,
	query TEXT,

	owner_id INT REFERENCES users(id),
	process_uuid VARCHAR(64) REFERENCES celery_tasks(task_id),
	task_state TASK_STATE NOT NULL,

	planned TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	started TIMESTAMP,
	finished TIMESTAMP
);

-- Create task x documents mapping table
CREATE TABLE IF NOT EXISTS task_documents (
	task_id INT REFERENCES tasks(id),
	document_id INT REFERENCES documents(id),
	processed BOOLEAN,
    PRIMARY KEY (task_id, document_id)
);

-- Create admin role
INSERT INTO roles (name) VALUES ('Admin');

INSERT INTO actions (role_id, action)
SELECT 1, (ev.a_type)::action_type
FROM (VALUES
    ('read_datatable_all'),
    ('edit_datatable_all'),
    ('write_datatable'),
    ('comment_on_datatable'),
    ('edit_access'),
    ('edit_categories'),
    ('extract')
) AS ev(a_type);

-- Create views
CREATE OR REPLACE VIEW role_view AS
SELECT
	r.id,
	r.name,
	a.action
FROM roles r
LEFT JOIN actions a ON r.id = a.role_id;

CREATE OR REPLACE VIEW user_view AS
SELECT
	u.id,
	u.username,
	u.department_id,
	u.role_id,
	d.abbreviation AS department_abbreviation,
	d.name AS department_name,
	r.name AS role_name
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN roles r ON u.role_id = r.id;

CREATE OR REPLACE VIEW document_view AS
SELECT
	r.id,
	r.sysno,
	r.volume_number,
	r.item_number,
	r.category_id,
	cs.name AS category_name,
	r.material_type,
	r.title,
	r.publishers,
	r.pages_count,
	r.size,
	r.signature,
	r.barcode,
	r.ccnb,
	r.isbn,
	r.creator_id,
	c.department_id AS creator_department_id,
	c.username AS creator,
	r.created_at,
	r.extraction_id,
	es.extractor_id,
	e.username AS extractor,
	es.extracted_at,
	(SELECT COUNT(*) FROM comments cm WHERE r.id = cm.document_id) AS comments_count
FROM documents r
LEFT JOIN categories cs ON r.category_id = cs.id
LEFT JOIN users c ON r.creator_id = c.id
LEFT JOIN extractions es ON r.extraction_id = es.id
LEFT JOIN users e ON es.extractor_id = e.id;

CREATE OR REPLACE VIEW task_view AS
SELECT
	t.id,
    t.task_type,
    t.task_scope,
    t.query,
    t.owner_id,
    u.username AS owner_name,
    t.task_state,
    t.planned,
    t.started,
    t.finished,
	(SELECT COUNT(*) FROM task_documents tr 
		WHERE t.id = tr.task_id AND processed) 
		AS processed_count,
	(SELECT COUNT(*) FROM task_documents tr 
		WHERE t.id = tr.task_id) 
		AS total_count
FROM tasks t
LEFT JOIN users u ON t.owner_id = u.id;

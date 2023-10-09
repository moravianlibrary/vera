-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
	username VARCHAR(64) UNIQUE,
	password VARCHAR(64),
	department VARCHAR(128)
);

-- Creates role enum
CREATE TYPE role AS ENUM ('admin', 'insertor', 'commentator', 'editor', 'extractor');

-- Creates roles mapping table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT REFERENCES users(id),
	user_role role,
	PRIMARY KEY (user_id, user_role)
);

-- Create the main data table 'board'
CREATE TABLE IF NOT EXISTS board (
    id SERIAL PRIMARY KEY,
    
    -- Identifiers
    sysno VARCHAR(16) NOT NULL,
    volume_number VARCHAR(16),
    item_number VARCHAR(16),
    CONSTRAINT unique_combination UNIQUE (sysno, volume_number, item_number),
    
    -- Information
    category VARCHAR(64) NOT NULL,
    title VARCHAR(256) NOT NULL,
    pages_count INTEGER,

	-- Additional information
	-- model
	signature VARCHAR(32),
	issn VARCHAR(32),
	isbn VARCHAR(32),
	barcode VARCHAR(32),
    
    -- Insertion details
    creator_id INT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Extraction details
    extractor_id INT REFERENCES users(id),
    extracted_at TIMESTAMP
);

CREATE OR REPLACE VIEW board_with_usernames AS
SELECT
    b.id,
    b.sysno,
    b.volume_number,
    b.item_number,
    b.category,
    b.title,
    b.pages_count,
    b.signature,
    b.issn,
    b.isbn,
    b.barcode,
    c.username AS creator,
    e.username AS extractor,
    b.created_at,
    b.extracted_at
FROM board b
LEFT JOIN users c ON b.creator_id = c.id
LEFT JOIN users e ON b.extractor_id = e.id;

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id serial PRIMARY KEY,
    record_id INT REFERENCES board(id),
    user_id INT REFERENCES users(id),
    note_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP
);

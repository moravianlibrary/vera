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
    creator VARCHAR(64) NOT NULL REFERENCES users(login),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    
    -- Extraction details
    extractor VARCHAR(64) REFERENCES users(login),
    extracted_at TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
	login VARCHAR(64) PRIMARY KEY,
	password VARCHAR(64),
	department VARCHAR(128)
);

-- Creates roles mapping table

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id serial PRIMARY KEY,
    board_id INT REFERENCES board(id),
    user_login VARCHAR(64) REFERENCES users(login),
    note_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

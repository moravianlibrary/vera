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
    
    -- Insertion details
    insertion_user VARCHAR(64) NOT NULL,
    insertion_time TIMESTAMP NOT NULL,
    
    -- Extraction details
    extractor VARCHAR(64),
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

);

-- Create a trigger to insert the insertion timestamp for new records
CREATE OR REPLACE FUNCTION set_insertion_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.insertion_time = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the insertion timestamp trigger
CREATE TRIGGER trigger_set_insertion_time
BEFORE INSERT ON board
FOR EACH ROW
EXECUTE FUNCTION set_insertion_time();

-- Create a trigger to insert the extraction timestamp for updated records
CREATE OR REPLACE FUNCTION set_extracted_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.extracted_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the extraction timestamp trigger
CREATE TRIGGER trigger_set_extracted_at
BEFORE UPDATE ON board
FOR EACH ROW
EXECUTE FUNCTION set_extracted_at();


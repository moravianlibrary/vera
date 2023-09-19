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
    pages_count INTEGER NOT NULL,
    title VARCHAR(256) NOT NULL,
    
    -- Insertion details
    insertion_user VARCHAR(64) NOT NULL,
    insertion_time TIMESTAMP NOT NULL,
    
    -- Extraction details
    extraction_user VARCHAR(64),
    extraction_time TIMESTAMP
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
CREATE OR REPLACE FUNCTION set_extraction_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.extraction_time = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the extraction timestamp trigger
CREATE TRIGGER trigger_set_extraction_time
BEFORE UPDATE ON board
FOR EACH ROW
EXECUTE FUNCTION set_extraction_time();


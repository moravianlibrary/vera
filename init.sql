-- Create main data table
CREATE TABLE IF NOT EXISTS board (
	sysno VARCHAR(16) NOT NULL,
	volume_number VARCHAR(16),
	item_number VARCHAR(16),
	PRIMARY KEY (sysno, volume_number, item_number),
	category VARCHAR(64) NOT NULL,
	pages_count INTEGER NOT NULL,

	title VARCHAR(256) NOT NULL,

	insertion_user VARCHAR(64) NOT NULL,
	insertion_time TIMESTAMP NOT NULL,
	extraction_user VARCHAR(64),
	extraction_time TIMESTAMP
);

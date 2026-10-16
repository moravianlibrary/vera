-- The engine's own state: the clock, the jobs it runs on that clock, and what the fakes "sent".

CREATE TABLE engine_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  due_at TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'due' CHECK (state IN ('due', 'done', 'failed')),
  ran_at TEXT,
  error TEXT
);

CREATE INDEX jobs_due ON jobs (state, due_at);

CREATE TABLE outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK (channel IN ('mail', 'chat', 'webhook', 'push')),
  recipient TEXT NOT NULL,
  payload TEXT NOT NULL,
  sent_at TEXT NOT NULL
);

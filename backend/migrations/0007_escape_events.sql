PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS escape_events (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  job_number TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('escaped','returned')),
  timestamp TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT,
  actor_name TEXT,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_escape_employee_time ON escape_events(employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_escape_time ON escape_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_escape_status ON escape_events(status);

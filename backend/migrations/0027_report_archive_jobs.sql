CREATE TABLE IF NOT EXISTS report_archive_jobs (
  job_id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  day_cursor INTEGER NOT NULL DEFAULT 0,
  employee_cursor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  requested_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  lease_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_archive_jobs_status
  ON report_archive_jobs(status, updated_at);

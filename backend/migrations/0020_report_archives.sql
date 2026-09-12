-- Immutable manifest for verified report archives stored in R2.
-- Report reads never write this table. Only the scheduled archive job does.
CREATE TABLE IF NOT EXISTS report_archives (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('attendance_period','attendance_employee')),
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  employee_id TEXT,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0 CHECK (byte_size >= 0),
  sha256 TEXT,
  report_version TEXT NOT NULL,
  data_snapshot_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('BUILDING','VERIFIED','FAILED')),
  created_at TEXT NOT NULL,
  verified_at TEXT,
  last_error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_archives_period_scope
  ON report_archives(report_type, period_from, period_to, COALESCE(employee_id, ''));
CREATE INDEX IF NOT EXISTS idx_report_archives_period
  ON report_archives(period_from, period_to);
CREATE INDEX IF NOT EXISTS idx_report_archives_status
  ON report_archives(status, period_from);

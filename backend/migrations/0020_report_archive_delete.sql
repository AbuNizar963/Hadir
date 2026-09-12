ALTER TABLE report_archives RENAME TO report_archives_before_delete;

CREATE TABLE report_archives (
  report_id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('attendance_daily','attendance_period','attendance_employee')),
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  employee_id TEXT,
  generated_at TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  generated_by_name TEXT NOT NULL,
  report_version TEXT NOT NULL,
  data_snapshot_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('DRAFT','CALCULATED','REVIEWED','LOCKED','DELETED')),
  file_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  locked_at TEXT,
  locked_by TEXT,
  revision INTEGER NOT NULL DEFAULT 1
);

INSERT INTO report_archives SELECT * FROM report_archives_before_delete;
DROP TABLE report_archives_before_delete;

CREATE INDEX idx_report_archives_period
  ON report_archives(period_from, period_to, report_type);
CREATE INDEX idx_report_archives_employee_period
  ON report_archives(employee_id, period_from, period_to);
CREATE INDEX idx_report_archives_status
  ON report_archives(status, created_at);
CREATE UNIQUE INDEX idx_report_archives_snapshot_revision
  ON report_archives(report_type, period_from, period_to, COALESCE(employee_id, ''), data_snapshot_hash, revision);

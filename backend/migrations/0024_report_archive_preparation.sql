-- Track bounded archive preparation so finalization never recomputes a whole month
-- in one Worker invocation. A marker is written only after every employee cursor
-- for a calendar day has completed successfully.
CREATE TABLE IF NOT EXISTS report_archive_preparation (
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  attendance_day TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  timezone TEXT NOT NULL,
  prepared_at TEXT NOT NULL,
  PRIMARY KEY (period_from, attendance_day)
);

CREATE INDEX IF NOT EXISTS idx_report_archive_preparation_period
  ON report_archive_preparation(period_from, period_to, calculation_version, timezone);

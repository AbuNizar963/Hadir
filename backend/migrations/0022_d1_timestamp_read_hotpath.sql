-- Support exact-day attendance reads used by the live professional report.
-- The timestamp predicate is a hot read path; keep this as a migration,
-- never as request-time schema work.
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp
  ON attendance(timestamp);

PRAGMA optimize;

-- Repair the canonical daily-status cache schema on installations where the earlier
-- 0013 ESCAPED migration could not be applied because this repository contains
-- multiple migrations sharing the 0013 numeric prefix.
-- Keep every currently supported derived status, including OPEN and ESCAPED.
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS daily_attendance_status__escaped_repair (
  attendance_day TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT','LATE','ABSENT','REST','LEAVE','PERMISSION','ESCAPED','NOT_STARTED','INVALID','OPEN')),
  check_in_at TEXT,
  check_out_at TEXT,
  schedule_type TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (attendance_day, employee_id),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO daily_attendance_status__escaped_repair
  (attendance_day, employee_id, status, check_in_at, check_out_at, schedule_type, computed_at)
SELECT d.attendance_day, d.employee_id, d.status, d.check_in_at, d.check_out_at, d.schedule_type, d.computed_at
FROM daily_attendance_status d;

DROP TABLE daily_attendance_status;
ALTER TABLE daily_attendance_status__escaped_repair RENAME TO daily_attendance_status;

CREATE INDEX IF NOT EXISTS idx_daily_attendance_status_day_status
  ON daily_attendance_status(attendance_day, status);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_status_employee_day
  ON daily_attendance_status(employee_id, attendance_day DESC);

PRAGMA foreign_keys = ON;

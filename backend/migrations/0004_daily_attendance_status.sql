CREATE TABLE IF NOT EXISTS daily_attendance_status (
  attendance_day TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT','LATE','ABSENT','REST','LEAVE','PERMISSION','NOT_STARTED','INVALID')),
  check_in_at TEXT,
  check_out_at TEXT,
  schedule_type TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (attendance_day, employee_id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_daily_attendance_status_day_status
  ON daily_attendance_status(attendance_day, status);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_status_employee_day
  ON daily_attendance_status(employee_id, attendance_day DESC);
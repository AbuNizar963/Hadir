-- Optimize employee-scoped daily attendance lookups used by the attendance engine.
-- The existing day/status index remains in place for manager status summaries.
CREATE INDEX IF NOT EXISTS idx_daily_attendance_status_day_employee
  ON daily_attendance_status(attendance_day, employee_id);

PRAGMA optimize;

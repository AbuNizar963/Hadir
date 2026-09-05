-- Reporting facts are a derived, immutable-by-source snapshot layer.
-- Raw attendance, requests, and audit records remain the system of record and are never deleted or rewritten here.
CREATE TABLE IF NOT EXISTS attendance_reporting_facts (
  attendance_day TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  job_number TEXT NOT NULL,
  status TEXT NOT NULL,
  schedule_type TEXT NOT NULL,
  scheduled_start TEXT,
  scheduled_end TEXT,
  expected_minutes INTEGER,
  check_in_at TEXT,
  check_out_at TEXT,
  worked_minutes INTEGER,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  early_leave_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  is_open INTEGER NOT NULL DEFAULT 0 CHECK (is_open IN (0,1)),
  exception_code TEXT,
  attendance_event_ids_json TEXT NOT NULL DEFAULT '[]',
  request_ids_json TEXT NOT NULL DEFAULT '[]',
  audit_ids_json TEXT NOT NULL DEFAULT '[]',
  schedule_snapshot_json TEXT NOT NULL DEFAULT '{}',
  calculation_source TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  timezone TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (attendance_day, employee_id),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_day_status
  ON attendance_reporting_facts(attendance_day, status);

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_employee_day
  ON attendance_reporting_facts(employee_id, attendance_day DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_exception
  ON attendance_reporting_facts(attendance_day, exception_code);

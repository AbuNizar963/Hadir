-- Professional reporting starts here.
-- This table is a reporting fact/snapshot layer. It never replaces or deletes raw attendance events.
-- No foreign key to employees is intentional: historical reporting must remain readable after employee lifecycle changes.

CREATE TABLE IF NOT EXISTS attendance_reporting_facts (
  attendance_day TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  job_number TEXT,
  employee_name TEXT NOT NULL,
  location_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('PRESENT','LATE','ABSENT','REST','LEAVE','PERMISSION','NOT_STARTED','INVALID')),
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
  open INTEGER NOT NULL DEFAULT 0 CHECK (open IN (0,1)),
  exception_code TEXT,
  attendance_event_ids_json TEXT NOT NULL DEFAULT '[]',
  request_ids_json TEXT NOT NULL DEFAULT '[]',
  audit_ids_json TEXT NOT NULL DEFAULT '[]',
  calculation_source TEXT NOT NULL,
  calculation_version TEXT NOT NULL,
  historical_data_quality TEXT NOT NULL DEFAULT 'exact' CHECK (historical_data_quality IN ('exact','reconstructed','incomplete')),
  timezone TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (attendance_day, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_day_status
  ON attendance_reporting_facts(attendance_day, status);

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_employee_day
  ON attendance_reporting_facts(employee_id, attendance_day DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_exception
  ON attendance_reporting_facts(attendance_day, exception_code);

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_location_day
  ON attendance_reporting_facts(location_id, attendance_day);

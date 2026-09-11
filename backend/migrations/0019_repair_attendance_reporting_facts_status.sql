-- Final repair for the professional reporting fact layer.
-- The central attendance engine can emit ESCAPED and OPEN, but the original
-- reporting-facts CHECK constraint only allowed the older status set. Rebuild
-- the fact table without changing or deleting any historical fact values.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS attendance_reporting_facts__final (
  attendance_day TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  job_number TEXT,
  employee_name TEXT NOT NULL,
  location_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('PRESENT','LATE','ABSENT','REST','LEAVE','PERMISSION','ESCAPED','NOT_STARTED','INVALID','OPEN')),
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
  attendance_source TEXT NOT NULL DEFAULT 'UNKNOWN',
  schedule_snapshot_json TEXT NOT NULL DEFAULT '{}',
  data_quality_reason TEXT,
  PRIMARY KEY (attendance_day, employee_id)
);

INSERT OR REPLACE INTO attendance_reporting_facts__final
  (attendance_day, employee_id, job_number, employee_name, location_id, status,
   schedule_type, scheduled_start, scheduled_end, expected_minutes, check_in_at,
   check_out_at, worked_minutes, late_minutes, early_leave_minutes, overtime_minutes,
   open, exception_code, attendance_event_ids_json, request_ids_json, audit_ids_json,
   calculation_source, calculation_version, historical_data_quality, timezone,
   computed_at, attendance_source, schedule_snapshot_json, data_quality_reason)
SELECT attendance_day, employee_id, job_number, employee_name, location_id, status,
       schedule_type, scheduled_start, scheduled_end, expected_minutes, check_in_at,
       check_out_at, worked_minutes, late_minutes, early_leave_minutes, overtime_minutes,
       open, exception_code, attendance_event_ids_json, request_ids_json, audit_ids_json,
       calculation_source, calculation_version, historical_data_quality, timezone,
       computed_at, attendance_source, schedule_snapshot_json, data_quality_reason
FROM attendance_reporting_facts;

DROP TABLE attendance_reporting_facts;
ALTER TABLE attendance_reporting_facts__final RENAME TO attendance_reporting_facts;

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_day_status
  ON attendance_reporting_facts(attendance_day, status);
CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_employee_day
  ON attendance_reporting_facts(employee_id, attendance_day DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_exception
  ON attendance_reporting_facts(attendance_day, exception_code);
CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_location_day
  ON attendance_reporting_facts(location_id, attendance_day);
CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_source
  ON attendance_reporting_facts(attendance_day, attendance_source);
CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_quality
  ON attendance_reporting_facts(attendance_day, historical_data_quality);

PRAGMA foreign_keys = ON;

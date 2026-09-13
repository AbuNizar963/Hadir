-- Canonical exception layer for enterprise attendance workflows.
-- Raw attendance events remain immutable; this table stores derived operational/payroll state.
CREATE TABLE IF NOT EXISTS attendance_exceptions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  attendance_day TEXT NOT NULL,
  shift_start TEXT NOT NULL,
  shift_end TEXT NOT NULL,
  schedule_type TEXT NOT NULL,
  exception_code TEXT NOT NULL CHECK (exception_code IN ('MISSING_CLOCK_IN','MISSING_CLOCK_OUT','NO_SHOW')),
  state TEXT NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN','PENDING_REGULARIZATION','APPROVED','REJECTED','CANCELLED')),
  first_event_at TEXT,
  last_event_at TEXT,
  raw_worked_minutes INTEGER NOT NULL DEFAULT 0,
  payroll_approved_minutes INTEGER NOT NULL DEFAULT 0,
  safety_cutoff_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(employee_id, shift_start, exception_code)
);
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_day_state ON attendance_exceptions(attendance_day,state);
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_employee ON attendance_exceptions(employee_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_cutoff ON attendance_exceptions(safety_cutoff_at,state);

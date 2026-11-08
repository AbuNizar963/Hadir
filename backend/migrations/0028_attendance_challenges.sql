-- Persist short-lived, single-use attendance verification challenges.
-- The challenge is bound to an employee, device, attendance type, QR value,
-- and a verified location. Raw attendance events remain in the attendance table.

CREATE TABLE IF NOT EXISTS attendance_challenges (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('check-in', 'check-out')),
  qr_code TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  location_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_attendance_challenges_employee_created
  ON attendance_challenges(employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_challenges_expiry
  ON attendance_challenges(expires_at, used_at);

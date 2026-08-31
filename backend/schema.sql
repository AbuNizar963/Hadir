PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','supervisor')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  job_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  device_id TEXT,
  device_label TEXT,
  created_at TEXT NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'ADMIN',
  rotation_start_date TEXT,
  work_start_time TEXT,
  work_end_time TEXT,
  grace_period_minutes INTEGER NOT NULL DEFAULT 10,
  role TEXT NOT NULL DEFAULT 'staff',
  location_id TEXT,
  rotation_days_on INTEGER,
  rotation_days_off INTEGER,
  specialties_json TEXT NOT NULL DEFAULT '[]',
  work_days_json TEXT NOT NULL DEFAULT '[]',
  avatar TEXT,
  avatar_key TEXT,
  is_vip INTEGER NOT NULL DEFAULT 0,
  auto_check_in INTEGER NOT NULL DEFAULT 0,
  auto_check_out INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_meters REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  job_number TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('check-in','check-out')),
  timestamp TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  distance_meters REAL NOT NULL,
  device_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  qr_code TEXT NOT NULL,
  location_id TEXT
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  job_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('permission','leave','checkout')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','confirmed','cancelled')),
  created_at TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT
);

CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  job_number TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success','rejected')),
  reason TEXT,
  timestamp TEXT NOT NULL,
  device_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  lat REAL,
  lng REAL,
  distance_meters REAL
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_time ON attendance(employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_time ON attendance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_employee_dates ON requests(employee_id, start_date, end_date, status);

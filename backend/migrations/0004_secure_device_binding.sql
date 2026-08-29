-- Security upgrade: keep a server-side device binding and a WebAuthn credential.
ALTER TABLE employees ADD COLUMN device_fingerprint TEXT;
ALTER TABLE employees ADD COLUMN device_bound_at TEXT;
ALTER TABLE employees ADD COLUMN device_last_seen_at TEXT;

CREATE TABLE IF NOT EXISTS employee_webauthn_credentials (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employee_webauthn_employee
  ON employee_webauthn_credentials(employee_id);

CREATE TABLE IF NOT EXISTS employee_webauthn_challenges (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  challenge TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('registration','authentication')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenge_employee
  ON employee_webauthn_challenges(employee_id,purpose,expires_at);

CREATE TABLE IF NOT EXISTS employee_device_events (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  event TEXT NOT NULL,
  device_label TEXT,
  fingerprint TEXT,
  created_at TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employee_device_events_employee
  ON employee_device_events(employee_id,created_at DESC);

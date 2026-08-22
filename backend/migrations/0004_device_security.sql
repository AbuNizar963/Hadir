-- Stronger employee device binding.
-- device_id remains the stable server-issued browser credential; device_fingerprint
-- stores only a SHA-256 digest of the client fingerprint signal.
ALTER TABLE employees ADD COLUMN device_fingerprint TEXT;
ALTER TABLE employees ADD COLUMN device_bound_at TEXT;
ALTER TABLE employees ADD COLUMN device_last_seen_at TEXT;

CREATE INDEX IF NOT EXISTS idx_employees_device_fingerprint ON employees(device_fingerprint);

CREATE TABLE IF NOT EXISTS employee_passkeys (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  device_type TEXT,
  backed_up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_employee_passkeys_employee ON employee_passkeys(employee_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('registration','authentication')),
  challenge TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_employee_kind ON webauthn_challenges(employee_id, kind);

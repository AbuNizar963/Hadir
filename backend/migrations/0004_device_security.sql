-- Security support tables for employee device binding and WebAuthn.
--
-- The production database already contains the employee device columns from
-- 0004_secure_device_binding.sql. Do NOT ALTER employees here: duplicate
-- ALTER TABLE statements would make remote D1 migrations fail.

CREATE INDEX IF NOT EXISTS idx_employees_device_fingerprint
  ON employees(device_fingerprint);

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
  last_used_at TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employee_passkeys_employee
  ON employee_passkeys(employee_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('registration','authentication')),
  challenge TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_employee_kind
  ON webauthn_challenges(employee_id, kind);

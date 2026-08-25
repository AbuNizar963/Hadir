-- Persistent server-side sessions for owners, managers, supervisors and employees.
-- The session is intentionally not given an automatic expiry; logout/revocation is the authority.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin','employee')),
  role TEXT NOT NULL CHECK (role IN ('owner','manager','supervisor','staff')),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(token_hash, revoked_at);

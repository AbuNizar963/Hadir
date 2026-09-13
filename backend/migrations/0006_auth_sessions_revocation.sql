-- Align existing databases with the server-side session revocation contract.
-- Migration 0005 creates revoked_at for new databases, but older databases may
-- already have auth_sessions without that column. Keep this migration idempotent
-- so deployments can safely bring those databases to the same schema.

ALTER TABLE auth_sessions ADD COLUMN revoked_at TEXT;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_active
  ON auth_sessions(token_hash, revoked_at);

CREATE TABLE IF NOT EXISTS login_rate_limits (
  subject_hash TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  first_failed_at TEXT NOT NULL,
  locked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_rate_limits_locked_until
  ON login_rate_limits(locked_until);

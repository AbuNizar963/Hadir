CREATE TABLE IF NOT EXISTS recovery_rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

-- Persistent employee requests and notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK(request_type IN ('permission','leave','checkout')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','confirmed','cancelled')),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_employee_requests_employee ON employee_requests(employee_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON employee_requests(status, requested_at DESC);

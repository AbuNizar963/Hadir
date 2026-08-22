-- Compatibility table for the current request API.
-- The API historically used `requests`, while the durable workflow schema uses
-- `employee_requests`. Keep one canonical table and expose the legacy name
-- through a view so existing API clients do not lose requests.
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  job_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('permission','leave','checkout')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','confirmed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_employee ON requests(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, created_at DESC);

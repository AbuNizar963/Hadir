-- Align the live D1 schema with the application contract.
-- 1) Store only the R2 object key for employee avatars.
ALTER TABLE employees ADD COLUMN avatar_key TEXT;
UPDATE employees
SET avatar_key = avatar
WHERE avatar_key IS NULL AND avatar IS NOT NULL;

-- 2) The application supports the full request lifecycle, including confirmation.
PRAGMA foreign_keys = OFF;

CREATE TABLE requests_v2 (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  job_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('permission','leave','checkout')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','confirmed','cancelled')),
  created_at TEXT NOT NULL
);

INSERT INTO requests_v2 (id, employee_id, employee_name, job_number, type, reason, status, created_at)
SELECT id, employee_id, employee_name, job_number, type, reason, status, created_at
FROM requests;

DROP TABLE requests;
ALTER TABLE requests_v2 RENAME TO requests;

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

PRAGMA foreign_keys = ON;

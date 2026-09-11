-- Canonical daily-status reads request date ranges directly from `requests`.
-- The legacy compatibility table originally omitted these columns, while the
-- request API added them lazily at runtime. Make the schema deterministic so
-- daily-status does not fail with "no such column: start_date" on a fresh D1.
ALTER TABLE requests ADD COLUMN start_date TEXT;
ALTER TABLE requests ADD COLUMN end_date TEXT;

CREATE INDEX IF NOT EXISTS idx_requests_employee_dates
  ON requests(employee_id, start_date, end_date);

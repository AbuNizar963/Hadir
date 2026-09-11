-- Canonical daily-status reads request date ranges directly from `requests`.
-- The base `requests` schema now owns these columns; this migration only adds
-- the lookup index so it remains safe when the columns already exist.
CREATE INDEX IF NOT EXISTS idx_requests_employee_dates
  ON requests(employee_id, start_date, end_date);

-- Reduce repeated full scans on the daily-status and request-list hot paths.
-- These indexes are applied once through D1 migrations rather than on requests.
CREATE INDEX IF NOT EXISTS idx_requests_created
  ON requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_status_type_dates
  ON requests(status, type, start_date, end_date, employee_id);

PRAGMA optimize;

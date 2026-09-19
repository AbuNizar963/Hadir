-- Normalize legacy OPEN rows without rebuilding production tables.
-- OPEN is no longer a canonical primary status. Keep the existing schema for
-- backward compatibility, but materialize historical rows into the canonical
-- status/exception model before the application reads them.

UPDATE daily_attendance_status
SET status = CASE
  WHEN status = 'OPEN' AND check_in_at IS NOT NULL THEN 'PRESENT'
  WHEN status = 'OPEN' THEN 'INVALID'
  ELSE status
END
WHERE status = 'OPEN';

UPDATE attendance_reporting_facts
SET
  status = CASE
    WHEN status = 'OPEN' AND check_in_at IS NOT NULL THEN 'PRESENT'
    WHEN status = 'OPEN' THEN 'INVALID'
    ELSE status
  END,
  open = CASE
    WHEN status = 'OPEN' AND check_in_at IS NOT NULL AND check_out_at IS NULL THEN 1
    ELSE open
  END,
  exception_code = CASE
    WHEN status = 'OPEN' AND check_in_at IS NOT NULL AND check_out_at IS NULL THEN 'MISSING_CHECKOUT'
    ELSE exception_code
  END
WHERE status = 'OPEN';

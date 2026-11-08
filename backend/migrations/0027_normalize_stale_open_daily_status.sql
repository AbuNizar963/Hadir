-- Repair stale derived attendance cache rows reintroduced by the legacy API worker.
-- Keep the canonical status model used by the reporting-facts layer:
-- a row with a recorded check-in is PRESENT; a row without one is INVALID.
-- This is an idempotent data normalization and does not delete attendance history.

UPDATE daily_attendance_status
SET status = CASE
  WHEN check_in_at IS NOT NULL THEN 'PRESENT'
  ELSE 'INVALID'
END
WHERE status = 'OPEN';

UPDATE attendance_reporting_facts
SET
  status = CASE
    WHEN check_in_at IS NOT NULL THEN 'PRESENT'
    ELSE 'INVALID'
  END,
  open = CASE
    WHEN check_in_at IS NOT NULL AND check_out_at IS NULL THEN 1
    ELSE open
  END,
  exception_code = CASE
    WHEN check_in_at IS NOT NULL AND check_out_at IS NULL THEN 'MISSING_CHECKOUT'
    ELSE exception_code
  END
WHERE status = 'OPEN';

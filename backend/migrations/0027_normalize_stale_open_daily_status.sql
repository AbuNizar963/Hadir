-- Repair stale derived OPEN attendance rows reintroduced by the legacy API worker.
-- Preserve raw attendance events and normalize only the derived reporting layers.
-- A recorded check-in is PRESENT; an OPEN row without check-in is INVALID.
-- The open flag is recalculated from the check-in/check-out timestamps so it
-- cannot remain true for an invalid row or a completed attendance session.
-- This migration is idempotent and does not delete attendance history.

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
    ELSE 0
  END,
  exception_code = CASE
    WHEN check_in_at IS NOT NULL AND check_out_at IS NULL THEN 'MISSING_CHECKOUT'
    WHEN exception_code = 'MISSING_CHECKOUT' THEN NULL
    ELSE exception_code
  END
WHERE status = 'OPEN';

-- Security hardening: an already-bound employee device may not be replaced
-- directly by the employee login endpoint. Administrative reset must first
-- clear device_id/device_fingerprint, after which the next valid login may
-- perform the first-bind operation.
DROP TRIGGER IF EXISTS trg_employee_device_no_direct_rebind;
CREATE TRIGGER trg_employee_device_no_direct_rebind
BEFORE UPDATE OF device_id ON employees
WHEN OLD.device_id IS NOT NULL
  AND NEW.device_id IS NOT NULL
  AND NEW.device_id <> OLD.device_id
BEGIN
  SELECT RAISE(ABORT, 'DEVICE_REBIND_REQUIRES_ADMIN_RESET');
END;

CREATE INDEX IF NOT EXISTS idx_employee_device_fingerprint
  ON employees(device_fingerprint);

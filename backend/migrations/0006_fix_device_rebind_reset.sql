-- Fix device rebind approval: clearing only device_id left the old
-- fingerprint in place, so bindEmployeeDevice still treated the account as
-- bound to the previous phone. A reset must clear every device security
-- anchor and invalidate old passkeys/sessions.
DROP TRIGGER IF EXISTS trg_employee_device_rebind_reset;
CREATE TRIGGER trg_employee_device_rebind_reset
AFTER UPDATE OF device_id ON employees
WHEN OLD.device_id IS NOT NULL AND NEW.device_id IS NULL
BEGIN
  UPDATE employees
  SET device_label = NULL,
      device_fingerprint = NULL,
      device_bound_at = NULL,
      device_last_seen_at = NULL,
      device_binding_reset_at = COALESCE(device_binding_reset_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  WHERE id = NEW.id;

  DELETE FROM employee_passkeys WHERE employee_id = NEW.id;
  DELETE FROM webauthn_challenges WHERE employee_id = NEW.id;
  DELETE FROM auth_sessions WHERE user_id = NEW.id AND user_type = 'employee';
END;

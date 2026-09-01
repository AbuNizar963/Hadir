-- Re-enable server-enforced employee device binding.
-- Migration 0002 intentionally disabled binding; this migration removes those
-- disabling triggers so the login flow can persist and enforce device_id again.
DROP TRIGGER IF EXISTS trg_employees_no_device_binding_insert;
DROP TRIGGER IF EXISTS trg_employees_no_device_binding_update;

-- Existing employees were cleared by 0002 and will bind to the browser/device
-- presented at their next successful login. No PIN or password is stored here.

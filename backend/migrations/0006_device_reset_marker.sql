-- Authoritative administrative device reset marker.
-- A reset is an explicit server-side authorization for the next successful
-- employee login to establish a new device binding.
ALTER TABLE employees ADD COLUMN device_binding_reset_at TEXT;
CREATE INDEX IF NOT EXISTS idx_employee_device_reset ON employees(device_binding_reset_at);

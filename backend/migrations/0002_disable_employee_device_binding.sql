-- Employee authentication is no longer tied to a phone/browser/device.
-- D1 remains the single source of truth for employee identity and PIN.
UPDATE employees SET device_id = NULL, device_label = NULL;

CREATE TRIGGER IF NOT EXISTS trg_employees_no_device_binding_insert
AFTER INSERT ON employees
BEGIN
  UPDATE employees
  SET device_id = NULL,
      device_label = NULL
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_employees_no_device_binding_update
AFTER UPDATE OF device_id, device_label ON employees
BEGIN
  UPDATE employees
  SET device_id = NULL,
      device_label = NULL
  WHERE id = NEW.id;
END;

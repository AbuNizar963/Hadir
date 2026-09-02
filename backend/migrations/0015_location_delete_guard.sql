-- Prevent deleting a work location from Manager Settings while employees
-- are still assigned to it. The manager must reassign those employees first.
-- Direct DELETEs remain protected by the existing location delete trigger;
-- this guard specifically stops the settings-list synchronization path.

DROP TRIGGER IF EXISTS trg_settings_block_used_location_delete_insert;
DROP TRIGGER IF EXISTS trg_settings_block_used_location_delete_update;

CREATE TRIGGER IF NOT EXISTS trg_settings_block_used_location_delete_insert
BEFORE INSERT ON settings
WHEN NEW.key = 'locations'
  AND json_valid(NEW.value)
  AND json_type(NEW.value) = 'array'
  AND EXISTS (
    SELECT 1
    FROM employees e
    JOIN locations l ON l.id = e.location_id
    WHERE e.location_id IS NOT NULL
      AND e.location_id <> 'main'
      AND l.id <> 'main'
      AND l.id NOT IN (
        SELECT json_extract(item.value, '$.id')
        FROM json_each(NEW.value) AS item
        WHERE json_extract(item.value, '$.id') IS NOT NULL
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'لا يمكن حذف هذا الموقع لأنه مرتبط بموظفين. غيّر مواقعهم أولاً ثم عاود المحاولة.');
END;

CREATE TRIGGER IF NOT EXISTS trg_settings_block_used_location_delete_update
BEFORE UPDATE OF value ON settings
WHEN NEW.key = 'locations'
  AND json_valid(NEW.value)
  AND json_type(NEW.value) = 'array'
  AND EXISTS (
    SELECT 1
    FROM employees e
    JOIN locations l ON l.id = e.location_id
    WHERE e.location_id IS NOT NULL
      AND e.location_id <> 'main'
      AND l.id <> 'main'
      AND l.id NOT IN (
        SELECT json_extract(item.value, '$.id')
        FROM json_each(NEW.value) AS item
        WHERE json_extract(item.value, '$.id') IS NOT NULL
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'لا يمكن حذف هذا الموقع لأنه مرتبط بموظفين. غيّر مواقعهم أولاً ثم عاود المحاولة.');
END;

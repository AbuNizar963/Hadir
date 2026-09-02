-- Keep D1 locations synchronized with the manager settings list.
-- ManagerSettings already sends the complete `locations` array when saving.
-- Any non-main location removed from that array is safely removed from D1,
-- and employees assigned to it are moved to the headquarters first.
-- The headquarters row (`main`) is always preserved.

DROP TRIGGER IF EXISTS trg_settings_sync_location_deletions_insert;
DROP TRIGGER IF EXISTS trg_settings_sync_location_deletions_update;

CREATE TRIGGER IF NOT EXISTS trg_settings_sync_location_deletions_insert
AFTER INSERT ON settings
WHEN NEW.key = 'locations' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  UPDATE employees
  SET location_id = 'main'
  WHERE location_id IS NOT NULL
    AND location_id <> 'main'
    AND location_id IN (
      SELECT id
      FROM locations
      WHERE id <> 'main'
        AND id NOT IN (
          SELECT json_extract(item.value, '$.id')
          FROM json_each(NEW.value) AS item
          WHERE json_extract(item.value, '$.id') IS NOT NULL
        )
    );

  DELETE FROM locations
  WHERE id <> 'main'
    AND id NOT IN (
      SELECT json_extract(item.value, '$.id')
      FROM json_each(NEW.value) AS item
      WHERE json_extract(item.value, '$.id') IS NOT NULL
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_settings_sync_location_deletions_update
AFTER UPDATE OF value ON settings
WHEN NEW.key = 'locations' AND json_valid(NEW.value) AND json_type(NEW.value) = 'array'
BEGIN
  UPDATE employees
  SET location_id = 'main'
  WHERE location_id IS NOT NULL
    AND location_id <> 'main'
    AND location_id IN (
      SELECT id
      FROM locations
      WHERE id <> 'main'
        AND id NOT IN (
          SELECT json_extract(item.value, '$.id')
          FROM json_each(NEW.value) AS item
          WHERE json_extract(item.value, '$.id') IS NOT NULL
        )
    );

  DELETE FROM locations
  WHERE id <> 'main'
    AND id NOT IN (
      SELECT json_extract(item.value, '$.id')
      FROM json_each(NEW.value) AS item
      WHERE json_extract(item.value, '$.id') IS NOT NULL
    );
END;

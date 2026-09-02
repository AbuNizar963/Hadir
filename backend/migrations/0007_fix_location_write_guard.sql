-- Rebuild the deduplication trigger so a generated duplicate ID can never
-- become the canonical employee location before it is deleted.
DROP TRIGGER IF EXISTS trg_locations_canonicalize_exact_duplicate;

CREATE TRIGGER IF NOT EXISTS trg_locations_canonicalize_exact_duplicate
AFTER INSERT ON locations
WHEN EXISTS (
  SELECT 1
  FROM locations existing
  WHERE existing.id <> NEW.id
    AND existing.name = NEW.name
    AND existing.lat = NEW.lat
    AND existing.lng = NEW.lng
    AND existing.radius_meters = NEW.radius_meters
)
BEGIN
  UPDATE employees
  SET location_id = (
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM locations m
        WHERE m.id = 'main'
          AND m.name = NEW.name
          AND m.lat = NEW.lat
          AND m.lng = NEW.lng
          AND m.radius_meters = NEW.radius_meters
      ) THEN 'main'
      ELSE MIN(existing.id)
    END
    FROM locations existing
    WHERE existing.id <> NEW.id
      AND existing.name = NEW.name
      AND existing.lat = NEW.lat
      AND existing.lng = NEW.lng
      AND existing.radius_meters = NEW.radius_meters
  )
  WHERE location_id = NEW.id;

  DELETE FROM locations
  WHERE id = NEW.id;
END;

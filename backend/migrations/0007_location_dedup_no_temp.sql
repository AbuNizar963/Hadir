-- Re-run-safe location deduplication without TEMP tables.
-- D1's remote /query API rejects CREATE TEMP TABLE with SQLITE_AUTH (7500).
-- Keep `main` canonical whenever it belongs to a duplicate group.

UPDATE employees
SET location_id = (
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM locations main_location
      WHERE main_location.id = 'main'
        AND main_location.name = current_location.name
        AND main_location.lat = current_location.lat
        AND main_location.lng = current_location.lng
        AND main_location.radius_meters = current_location.radius_meters
    ) THEN 'main'
    ELSE (
      SELECT MIN(canonical_candidate.id)
      FROM locations canonical_candidate
      WHERE canonical_candidate.name = current_location.name
        AND canonical_candidate.lat = current_location.lat
        AND canonical_candidate.lng = current_location.lng
        AND canonical_candidate.radius_meters = current_location.radius_meters
    )
  END
  FROM locations current_location
  WHERE current_location.id = employees.location_id
)
WHERE location_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM locations current_location
    JOIN locations duplicate_candidate
      ON duplicate_candidate.name = current_location.name
     AND duplicate_candidate.lat = current_location.lat
     AND duplicate_candidate.lng = current_location.lng
     AND duplicate_candidate.radius_meters = current_location.radius_meters
     AND duplicate_candidate.id <> current_location.id
    WHERE current_location.id = employees.location_id
  );

DELETE FROM locations AS duplicate_location
WHERE EXISTS (
    SELECT 1
    FROM locations same_group
    WHERE same_group.id <> duplicate_location.id
      AND same_group.name = duplicate_location.name
      AND same_group.lat = duplicate_location.lat
      AND same_group.lng = duplicate_location.lng
      AND same_group.radius_meters = duplicate_location.radius_meters
  )
  AND duplicate_location.id <> CASE
    WHEN EXISTS (
      SELECT 1
      FROM locations main_location
      WHERE main_location.id = 'main'
        AND main_location.name = duplicate_location.name
        AND main_location.lat = duplicate_location.lat
        AND main_location.lng = duplicate_location.lng
        AND main_location.radius_meters = duplicate_location.radius_meters
    ) THEN 'main'
    ELSE (
      SELECT MIN(canonical_candidate.id)
      FROM locations canonical_candidate
      WHERE canonical_candidate.name = duplicate_location.name
        AND canonical_candidate.lat = duplicate_location.lat
        AND canonical_candidate.lng = duplicate_location.lng
        AND canonical_candidate.radius_meters = duplicate_location.radius_meters
    )
  END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_exact_unique
ON locations(name, lat, lng, radius_meters);

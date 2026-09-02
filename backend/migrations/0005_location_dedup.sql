-- Canonicalize exact duplicate work locations without changing historical attendance records.
-- `main` remains the canonical row whenever it belongs to a duplicate group.
CREATE TEMP TABLE location_dedup AS
SELECT
  CASE WHEN MAX(CASE WHEN id = 'main' THEN 1 ELSE 0 END) = 1 THEN 'main' ELSE MIN(id) END AS canonical_id,
  name, lat, lng, radius_meters
FROM locations
GROUP BY name, lat, lng, radius_meters;

UPDATE employees
SET location_id = (
  SELECT d.canonical_id
  FROM location_dedup d
  JOIN locations l ON l.id = employees.location_id
  WHERE l.name = d.name
    AND l.lat = d.lat
    AND l.lng = d.lng
    AND l.radius_meters = d.radius_meters
  LIMIT 1
)
WHERE location_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM location_dedup d
    JOIN locations l ON l.id = employees.location_id
    WHERE l.name = d.name
      AND l.lat = d.lat
      AND l.lng = d.lng
      AND l.radius_meters = d.radius_meters
  );

DELETE FROM locations
WHERE id NOT IN (SELECT canonical_id FROM location_dedup);

DROP TABLE location_dedup;

-- Prevent future exact duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_exact_unique
ON locations(name, lat, lng, radius_meters);

-- Make the locations table authoritative.
-- ManagerSettings uses the dedicated /api/locations CRUD endpoints; a stale
-- settings payload must never be allowed to delete durable D1 locations.
DROP TRIGGER IF EXISTS trg_settings_sync_location_deletions_insert;
DROP TRIGGER IF EXISTS trg_settings_sync_location_deletions_update;

-- Keep the legacy settings cache synchronized with the authoritative table.
DROP TRIGGER IF EXISTS trg_locations_sync_settings_insert;
DROP TRIGGER IF EXISTS trg_locations_sync_settings_update;
DROP TRIGGER IF EXISTS trg_locations_sync_settings_delete;

CREATE TRIGGER IF NOT EXISTS trg_locations_sync_settings_insert
AFTER INSERT ON locations
BEGIN
  INSERT INTO settings(key,value)
  VALUES('locations', COALESCE((SELECT json_group_array(json_object('id',id,'name',name,'lat',lat,'lng',lng,'radiusMeters',radius_meters)) FROM (SELECT id,name,lat,lng,radius_meters FROM locations ORDER BY name)), '[]'))
  ON CONFLICT(key) DO UPDATE SET value=excluded.value;
END;

CREATE TRIGGER IF NOT EXISTS trg_locations_sync_settings_update
AFTER UPDATE OF id,name,lat,lng,radius_meters ON locations
BEGIN
  INSERT INTO settings(key,value)
  VALUES('locations', COALESCE((SELECT json_group_array(json_object('id',id,'name',name,'lat',lat,'lng',lng,'radiusMeters',radius_meters)) FROM (SELECT id,name,lat,lng,radius_meters FROM locations ORDER BY name)), '[]'))
  ON CONFLICT(key) DO UPDATE SET value=excluded.value;
END;

CREATE TRIGGER IF NOT EXISTS trg_locations_sync_settings_delete
AFTER DELETE ON locations
BEGIN
  INSERT INTO settings(key,value)
  VALUES('locations', COALESCE((SELECT json_group_array(json_object('id',id,'name',name,'lat',lat,'lng',lng,'radiusMeters',radius_meters)) FROM (SELECT id,name,lat,lng,radius_meters FROM locations ORDER BY name)), '[]'))
  ON CONFLICT(key) DO UPDATE SET value=excluded.value;
END;

-- Backfill the legacy cache from the current durable location table.
INSERT INTO settings(key,value)
SELECT 'locations', COALESCE((SELECT json_group_array(json_object('id',id,'name',name,'lat',lat,'lng',lng,'radiusMeters',radius_meters)) FROM (SELECT id,name,lat,lng,radius_meters FROM locations ORDER BY name)), '[]')
WHERE EXISTS (SELECT 1 FROM locations)
ON CONFLICT(key) DO UPDATE SET value=excluded.value;

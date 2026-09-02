-- Never orphan employees when a non-main work location is deleted.
-- Employees assigned to the removed location are moved to the canonical
-- headquarters location before the DELETE is allowed to complete.
-- The main location itself is protected and cannot be deleted.

DROP TRIGGER IF EXISTS trg_locations_reassign_on_delete;

CREATE TRIGGER IF NOT EXISTS trg_locations_reassign_on_delete
BEFORE DELETE ON locations
WHEN OLD.id <> 'main'
BEGIN
  UPDATE employees
  SET location_id = 'main'
  WHERE location_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_locations_protect_main_delete
BEFORE DELETE ON locations
WHEN OLD.id = 'main'
BEGIN
  SELECT RAISE(ABORT, 'لا يمكن حذف المقر الرئيسي');
END;

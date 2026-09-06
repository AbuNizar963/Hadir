-- Keep attendance_source synchronized when reporting facts are re-materialized.
-- The trigger is restricted to changes of attendance_event_ids_json so its internal
-- attendance_source update cannot recursively fire the same trigger.

DROP TRIGGER IF EXISTS trg_attendance_reporting_source_after_insert;

CREATE TRIGGER IF NOT EXISTS trg_attendance_reporting_source_after_insert
AFTER INSERT ON attendance_reporting_facts
BEGIN
  UPDATE attendance_reporting_facts
  SET attendance_source = CASE
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP')
      AND NOT EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')) THEN 'AUTOMATIC_VIP'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')
      AND NOT EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')) THEN 'AUTOMATIC'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي') THEN 'MIXED'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'ADMIN_DIRECT' OR a.qr_code = 'ADMIN_DIRECT') THEN 'MANUAL_OWNER'
    WHEN json_array_length(NEW.attendance_event_ids_json) > 0 THEN 'MANUAL_EMPLOYEE'
    ELSE 'UNKNOWN'
  END
  WHERE attendance_day = NEW.attendance_day AND employee_id = NEW.employee_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_attendance_reporting_source_after_events_update
AFTER UPDATE OF attendance_event_ids_json ON attendance_reporting_facts
BEGIN
  UPDATE attendance_reporting_facts
  SET attendance_source = CASE
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP')
      AND NOT EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')) THEN 'AUTOMATIC_VIP'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')
      AND NOT EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')) THEN 'AUTOMATIC'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي') THEN 'MIXED'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'ADMIN_DIRECT' OR a.qr_code = 'ADMIN_DIRECT') THEN 'MANUAL_OWNER'
    WHEN json_array_length(NEW.attendance_event_ids_json) > 0 THEN 'MANUAL_EMPLOYEE'
    ELSE 'UNKNOWN'
  END
  WHERE attendance_day = NEW.attendance_day AND employee_id = NEW.employee_id;
END;

-- Refresh the stored classification after installing the corrected trigger logic.
UPDATE attendance_reporting_facts
SET attendance_source = CASE
  WHEN EXISTS (SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP')
    AND NOT EXISTS (SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')) THEN 'AUTOMATIC_VIP'
  WHEN EXISTS (SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')
    AND NOT EXISTS (SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')) THEN 'AUTOMATIC'
  WHEN EXISTS (SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي') THEN 'MIXED'
  WHEN EXISTS (SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'ADMIN_DIRECT' OR a.qr_code = 'ADMIN_DIRECT') THEN 'MANUAL_OWNER'
  WHEN json_array_length(attendance_reporting_facts.attendance_event_ids_json) > 0 THEN 'MANUAL_EMPLOYEE'
  ELSE 'UNKNOWN'
END;

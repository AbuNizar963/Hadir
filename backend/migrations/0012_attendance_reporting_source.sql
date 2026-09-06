-- Preserve raw attendance events while recording their origin in the reporting fact layer.
-- Source is derived from immutable attendance metadata; raw attendance rows are never changed.

ALTER TABLE attendance_reporting_facts ADD COLUMN attendance_source TEXT NOT NULL DEFAULT 'UNKNOWN';

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_source
  ON attendance_reporting_facts(attendance_day, attendance_source);

-- Backfill existing reporting facts from the raw attendance events referenced by each fact.
UPDATE attendance_reporting_facts
SET attendance_source = CASE
  WHEN EXISTS (
    SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids
    JOIN attendance a ON a.id = ids.value
    WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP'
  ) AND NOT EXISTS (
    SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids
    JOIN attendance a ON a.id = ids.value
    WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id LIKE 'ADMIN_DIRECT:%')
  ) THEN 'AUTOMATIC_VIP'
  WHEN EXISTS (
    SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids
    JOIN attendance a ON a.id = ids.value
    WHERE a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي'
  ) AND NOT EXISTS (
    SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids
    JOIN attendance a ON a.id = ids.value
    WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')
  ) THEN 'AUTOMATIC'
  WHEN EXISTS (
    SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids
    JOIN attendance a ON a.id = ids.value
    WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي'
  ) THEN 'MIXED'
  WHEN EXISTS (
    SELECT 1 FROM json_each(attendance_reporting_facts.attendance_event_ids_json) ids
    JOIN attendance a ON a.id = ids.value
    WHERE a.device_id = 'ADMIN_DIRECT' OR a.qr_code = 'ADMIN_DIRECT'
  ) THEN 'MANUAL_OWNER'
  WHEN json_array_length(attendance_reporting_facts.attendance_event_ids_json) > 0 THEN 'MANUAL_EMPLOYEE'
  ELSE 'UNKNOWN'
END;

-- Keep the source available through the existing public calculationSource field even
-- for clients that have not yet been updated to read attendanceSource directly.
UPDATE attendance_reporting_facts
SET calculation_source = calculation_source || ';attendanceSource=' || attendance_source;

CREATE TRIGGER IF NOT EXISTS trg_attendance_reporting_source_after_insert
AFTER INSERT ON attendance_reporting_facts
BEGIN
  UPDATE attendance_reporting_facts
  SET attendance_source = CASE
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP')
      AND NOT EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id LIKE 'ADMIN_DIRECT:%')) THEN 'AUTOMATIC_VIP'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')
      AND NOT EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE NOT (a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي')) THEN 'AUTOMATIC'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP' OR a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي') THEN 'MIXED'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'ADMIN_DIRECT' OR a.qr_code = 'ADMIN_DIRECT') THEN 'MANUAL_OWNER'
    WHEN json_array_length(NEW.attendance_event_ids_json) > 0 THEN 'MANUAL_EMPLOYEE'
    ELSE 'UNKNOWN'
  END,
  calculation_source = calculation_source || ';attendanceSource=' || CASE
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'AUTO_VIP' OR a.qr_code = 'AUTO_VIP') THEN 'AUTOMATIC_VIP'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.qr_code = 'AUTO_DIRECT' OR a.device_id = 'ADMIN_DIRECT:التلقائي') THEN 'AUTOMATIC'
    WHEN EXISTS (SELECT 1 FROM json_each(NEW.attendance_event_ids_json) ids JOIN attendance a ON a.id = ids.value WHERE a.device_id = 'ADMIN_DIRECT' OR a.qr_code = 'ADMIN_DIRECT') THEN 'MANUAL_OWNER'
    WHEN json_array_length(NEW.attendance_event_ids_json) > 0 THEN 'MANUAL_EMPLOYEE'
    ELSE 'UNKNOWN'
  END
  WHERE attendance_day = NEW.attendance_day AND employee_id = NEW.employee_id;
END;

-- Preserve the raw attendance events while recording their origin in the reporting fact layer.
-- The source is derived from immutable attendance metadata; no raw attendance row is changed.

ALTER TABLE attendance_reporting_facts ADD COLUMN attendance_source TEXT NOT NULL DEFAULT 'UNKNOWN';

CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_source
  ON attendance_reporting_facts(attendance_day, attendance_source);

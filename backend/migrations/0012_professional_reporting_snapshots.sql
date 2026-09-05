-- Preserve the schedule inputs used by the official reporting calculation.
-- Existing rows remain valid; newly materialized facts can record the exact inputs used.
ALTER TABLE attendance_reporting_facts ADD COLUMN schedule_snapshot_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE attendance_reporting_facts ADD COLUMN data_quality_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_attendance_reporting_facts_quality ON attendance_reporting_facts(attendance_day,historical_data_quality);
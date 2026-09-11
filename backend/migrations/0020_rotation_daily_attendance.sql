-- Rotation employees may optionally use one attendance checkpoint per active rotation day.
-- Daily checkpoint has its own configurable grace window.
-- Final validation trigger; no schema change.
ALTER TABLE employees ADD COLUMN rotation_daily_attendance_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN rotation_daily_attendance_time TEXT;
ALTER TABLE employees ADD COLUMN rotation_daily_attendance_grace_minutes INTEGER NOT NULL DEFAULT 0;

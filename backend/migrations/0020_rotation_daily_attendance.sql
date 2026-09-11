-- Rotation employees may optionally use one attendance checkpoint per active rotation day.
-- The checkpoint has a manager-configurable time and dedicated grace window.
-- Workflow trigger only; migration unchanged.
ALTER TABLE employees ADD COLUMN rotation_daily_attendance_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN rotation_daily_attendance_time TEXT;
ALTER TABLE employees ADD COLUMN rotation_daily_attendance_grace_minutes INTEGER NOT NULL DEFAULT 0;

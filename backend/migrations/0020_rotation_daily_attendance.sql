-- Rotation employees may optionally use one attendance checkpoint per active rotation day.
ALTER TABLE employees ADD COLUMN rotation_daily_attendance_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN rotation_daily_attendance_time TEXT;

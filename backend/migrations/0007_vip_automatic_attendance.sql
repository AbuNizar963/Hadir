-- VIP and automatic attendance controls.
-- These controls are intentionally separate from normal employee permissions.
ALTER TABLE employees ADD COLUMN is_vip INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN auto_check_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN auto_check_out INTEGER NOT NULL DEFAULT 0;

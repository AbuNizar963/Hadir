-- Keep the employee-level early-checkout setting in the canonical D1 record.
-- This is intentionally nullable so existing employees retain their current behavior.
ALTER TABLE employees ADD COLUMN early_checkout_grace_minutes INTEGER;

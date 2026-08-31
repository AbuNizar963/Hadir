-- Persist per-employee early checkout grace in the canonical D1 employees table.
ALTER TABLE employees ADD COLUMN early_checkout_grace_minutes INTEGER NOT NULL DEFAULT 0;

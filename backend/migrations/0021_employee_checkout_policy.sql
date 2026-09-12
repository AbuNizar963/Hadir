CREATE TABLE IF NOT EXISTS employee_checkout_policies (
  employee_id TEXT PRIMARY KEY,
  early_checkout_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_checkout_policy_updated
  ON employee_checkout_policies(updated_at DESC);

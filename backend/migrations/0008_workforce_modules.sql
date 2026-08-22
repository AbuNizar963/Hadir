PRAGMA foreign_keys = ON;

-- Workforce-management foundation. All event-like records are append-friendly for auditability.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS violations (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  occurred_at TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_violations_employee ON violations(employee_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id, start_date DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'normal',
  due_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status, due_at);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  attendance_score REAL NOT NULL DEFAULT 0,
  punctuality_score REAL NOT NULL DEFAULT 0,
  reliability_score REAL NOT NULL DEFAULT 0,
  overall_score REAL NOT NULL DEFAULT 0,
  notes TEXT,
  reviewer_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_performance_employee ON performance_reviews(employee_id, period_end DESC);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  regular_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  absence_minutes INTEGER NOT NULL DEFAULT 0,
  adjustment_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll_entries(employee_id, period_end DESC);

CREATE TABLE IF NOT EXISTS anomaly_events (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  type TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  detected_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_anomaly_status ON anomaly_events(status, detected_at DESC);

CREATE TABLE IF NOT EXISTS ai_insights (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  scope_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence TEXT,
  confidence REAL,
  created_at TEXT NOT NULL,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_insights_scope ON ai_insights(scope, scope_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

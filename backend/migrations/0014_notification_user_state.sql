-- Per-user notification state. Notifications remain immutable/shared; each recipient can hide their own copy.
CREATE TABLE IF NOT EXISTS notification_user_state (
  notification_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_user_state_user_deleted
  ON notification_user_state(user_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_notification_user_state_notification
  ON notification_user_state(notification_id);

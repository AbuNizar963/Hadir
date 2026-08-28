PRAGMA foreign_keys = OFF;

-- 0008 normalized notifications to recipient_id/body/severity and 0009 added
-- legacy user_id/message columns. The application still has a legacy write path
-- for /api/requests, which omits recipient_id. Keep both contracts compatible
-- by making recipient_id defaultable and synchronizing both representations.
ALTER TABLE notifications RENAME TO notifications_legacy_compat;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL DEFAULT '',
  user_id TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'info',
  read_at TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO notifications (
  id, recipient_id, user_id, type, title, body, message, severity, read_at, created_at
)
SELECT
  id,
  COALESCE(NULLIF(recipient_id, ''), NULLIF(user_id, ''), ''),
  COALESCE(NULLIF(user_id, ''), NULLIF(recipient_id, '')),
  type,
  title,
  COALESCE(body, message, ''),
  COALESCE(message, body, ''),
  severity,
  read_at,
  created_at
FROM notifications_legacy_compat;

DROP TABLE notifications_legacy_compat;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE TRIGGER notifications_sync_insert
AFTER INSERT ON notifications
BEGIN
  UPDATE notifications
  SET
    recipient_id = CASE
      WHEN NEW.recipient_id = '' THEN COALESCE(NULLIF(NEW.user_id, ''), '')
      ELSE NEW.recipient_id
    END,
    user_id = COALESCE(NULLIF(NEW.user_id, ''), NULLIF(NEW.recipient_id, '')),
    body = CASE
      WHEN NEW.body = '' AND NEW.message <> '' THEN NEW.message
      ELSE NEW.body
    END,
    message = CASE
      WHEN NEW.message = '' AND NEW.body <> '' THEN NEW.body
      ELSE NEW.message
    END
  WHERE id = NEW.id;
END;

PRAGMA foreign_keys = ON;

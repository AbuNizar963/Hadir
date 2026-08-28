PRAGMA foreign_keys = OFF;

-- The production code still has a compatibility write path that supplies
-- user_id/message. Make recipient_id authoritative without allowing an INSERT
-- to fail before the compatibility mapping can run.
ALTER TABLE notifications RENAME TO notifications_pre_0011;

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
  COALESCE(type, 'info'),
  title,
  COALESCE(NULLIF(body, ''), NULLIF(message, ''), ''),
  COALESCE(NULLIF(message, ''), NULLIF(body, ''), ''),
  COALESCE(severity, type, 'info'),
  read_at,
  created_at
FROM notifications_pre_0011;

DROP TABLE notifications_pre_0011;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Compatibility writes that provide only user_id are normalized immediately.
CREATE TRIGGER notifications_recipient_contract_insert
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
    END,
    severity = CASE
      WHEN NEW.severity = '' THEN COALESCE(NULLIF(NEW.type, ''), 'info')
      ELSE NEW.severity
    END
  WHERE id = NEW.id;
END;

PRAGMA foreign_keys = ON;

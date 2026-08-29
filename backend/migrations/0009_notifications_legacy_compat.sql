-- The workforce migration normalized notifications to recipient_id/body/severity,
-- while backend/src/app.ts still reads and writes the legacy user_id/message fields.
-- Keep both representations during the compatibility window so existing notification
-- APIs continue working without rewriting the stable application layer in one step.

ALTER TABLE notifications ADD COLUMN user_id TEXT;
ALTER TABLE notifications ADD COLUMN message TEXT;

UPDATE notifications
SET user_id = recipient_id
WHERE user_id IS NULL;

UPDATE notifications
SET message = body
WHERE message IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
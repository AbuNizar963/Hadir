PRAGMA foreign_keys = OFF;

ALTER TABLE push_subscriptions RENAME TO push_subscriptions_legacy;

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth,created_at,updated_at)
SELECT id,user_id,endpoint,p256dh,auth,created_at,last_seen_at
FROM push_subscriptions_legacy;

DROP TABLE push_subscriptions_legacy;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

PRAGMA foreign_keys = ON;

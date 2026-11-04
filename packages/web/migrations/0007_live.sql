-- The live dashboard and its notifications.
--
-- live_events: what happened to a person's sites, in order, so a browser that
--   reconnects can be told what it missed. The newest few are kept.
-- push_subscriptions: one row per browser or device a person turned
--   notifications on for. Removed when the push service answers 410 Gone or
--   the person turns notifications off.
-- domains: whether a check is running now (checking_since), and what the last
--   check found, so the overview reads one table and no stored runs.

CREATE TABLE live_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_live_events_user ON live_events (user_id, id);

CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_sent_at TEXT
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

ALTER TABLE domains ADD COLUMN checking_since TEXT;
ALTER TABLE domains ADD COLUMN errors INTEGER;
ALTER TABLE domains ADD COLUMN warnings INTEGER;
ALTER TABLE domains ADD COLUMN hints INTEGER;
ALTER TABLE domains ADD COLUMN reachable INTEGER NOT NULL DEFAULT 1;

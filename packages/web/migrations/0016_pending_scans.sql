-- The scans waiting for the scan queue, one row for each thing to check.
--
-- A deployment, a change of rules or the scheduled re-check leaves its job here
-- and sends a message with the row's key to the queue. The row is what makes the
-- queue safe to retry and cheap to repeat: a newer job for the same key replaces
-- the older one, so several deployments in a row cause one scan of the newest
-- commit, and a job that a consumer was working on when it died is still here
-- for the retry (or for the next re-check) instead of being lost with the
-- message.
--
-- pending_scans: key is what is checked (deploy:owner/repo, config:owner/repo,
--   preview:owner/repo:url, site:user:host), the primary key and the only access
--   path (the producer and the consumer both go by key). seq counts the jobs the
--   key has had, so a consumer that finishes an old job does not delete a newer
--   one. claimed_at is the lease of the consumer running it: a retry does not run
--   a job whose lease is fresh, and takes one whose lease has run out.

CREATE TABLE pending_scans (
  key         TEXT PRIMARY KEY,
  job         TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  enqueued_at TEXT NOT NULL,
  claimed_at  TEXT
);

-- The scheduled sweep looks for jobs that have waited too long (their messages
-- were lost or dead-lettered) and sends them again.
CREATE INDEX idx_pending_scans_enqueued ON pending_scans (enqueued_at);

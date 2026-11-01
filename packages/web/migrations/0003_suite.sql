-- Server-side runs of the checks that fit in the Worker, started by a
-- deployment on GitHub, and the deliveries already handled.
--
-- suite_runs: one row per run of one host. `findings` is a JSON array of what
--   the run found ({ id, severity, message }); checks that found nothing are
--   not stored. `sha` is the deployed commit when GitHub said so.
-- webhook_deliveries: the id GitHub gave each delivery, so a delivery that is
--   sent again (GitHub retries) does not run the checks twice.

CREATE TABLE suite_runs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL,
  host     TEXT NOT NULL,
  repo     TEXT,
  sha      TEXT,
  status   INTEGER NOT NULL,
  ran_at   TEXT NOT NULL,
  findings TEXT NOT NULL
);

CREATE INDEX idx_suite_runs_host ON suite_runs (user_id, host, id);

CREATE TABLE webhook_deliveries (
  delivery_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL
);

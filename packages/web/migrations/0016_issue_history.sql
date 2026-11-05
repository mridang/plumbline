-- Every issue Plumbline opened on GitHub, kept for good.
--
-- suite_issues holds one issue per site and REPLACES it when a site gets a new
-- one, so which issues reported which check was lost. suite_issue_history keeps
-- one row per issue number.
--
-- state: open, fixed (closed by the app), dismissed (closed by a person) or
--   deleted (the issue is gone from GitHub; kept so the history is honest, not
--   shown as a link).
-- checks: a JSON array of the check ids the issue reported when it was last
--   written. It is only stored and returned whole, never filtered on in SQL (a
--   site has a handful of issues, read by (repo, host)), so it stays JSON.
-- idx_suite_issue_history_host: a site's issues, newest first.
-- idx_suite_issue_history_number: finds an issue by its number when it is
--   deleted or edited on GitHub (the webhook knows the repository and number,
--   not the host).

CREATE TABLE suite_issue_history (
  repo      TEXT NOT NULL,
  host      TEXT NOT NULL,
  number    INTEGER NOT NULL,
  state     TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  checks    TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (repo, host, number)
);

CREATE INDEX idx_suite_issue_history_host
  ON suite_issue_history (repo, host, opened_at DESC, number DESC);

CREATE INDEX idx_suite_issue_history_number
  ON suite_issue_history (repo, number);

-- The issues of today: when each was opened and which checks it reported are
-- not known, so the time is the migration's and the checks are empty.
INSERT INTO suite_issue_history (repo, host, number, state, opened_at, checks)
SELECT repo, host, number, state, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), '[]'
FROM suite_issues
WHERE number > 0 AND state IN ('open', 'fixed', 'dismissed');

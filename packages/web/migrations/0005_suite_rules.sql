-- Which rules a run used, and the issue that reports a site's problems.
--
-- suite_runs.rules: a short fingerprint of the rules (the rule set, the
--   configuration file and the environment) a run applied, so a changed
--   configuration is applied to a page that has not changed, instead of
--   reusing the findings the old rules produced.
-- suite_issues: the GitHub issue that reports the problems of one host of one
--   repository, so a later run edits it, reopens it or closes it instead of
--   opening another. `state` is 'open' while the issue is open, 'fixed' when
--   the app closed it because the problems were gone (so it reopens them if
--   they come back), and 'dismissed' when a person closed it with the problems
--   still there (so it stays closed until the problems change). `signature` is
--   a fingerprint of the problems the issue last reported.

ALTER TABLE suite_runs ADD COLUMN rules TEXT;

CREATE TABLE suite_issues (
  repo      TEXT NOT NULL,
  host      TEXT NOT NULL,
  number    INTEGER NOT NULL,
  state     TEXT NOT NULL,
  signature TEXT NOT NULL,
  PRIMARY KEY (repo, host)
);

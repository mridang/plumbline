-- One GitHub issue per check, not one per site.
--
-- suite_check_issues: the issue that tracks one check of one host of one
--   repository. A monorepo that deploys two hosts has two rows for the same
--   check. The key is (repo, host, check_id).
--   state: open, fixed (closed by the app: the problem is gone, or the rules no
--   longer ask for the check), dismissed (closed by a person while the problem
--   was still there) or opening (a delivery has claimed the right to open the
--   issue; number is 0 and signature holds the time of the claim).
--   signature: a fingerprint of the findings the issue last reported.
--   reopens: how many times the app reopened it after a person closed it; at
--   the limit the app leaves it closed.
-- idx_suite_check_issues_number: finds an issue by its number when it is closed,
--   reopened or deleted on GitHub (the webhook knows the repository and the
--   number, not the host or the check). Reads by repository, or by repository
--   and host, use the primary key.
--
-- suite_issues is the old table, one row per host. It is kept only so each host's
-- old issue can be closed once, with a comment, the first time the host is
-- checked under the new code; the row is deleted then.
--
-- suite_issue_history gets check_id, the one check an issue reports ('' for an
--   issue of the old kind, which reported several: those are retired as
--   'replaced' and are not listed).

CREATE TABLE suite_check_issues (
  repo      TEXT NOT NULL,
  host      TEXT NOT NULL,
  check_id  TEXT NOT NULL,
  number    INTEGER NOT NULL,
  state     TEXT NOT NULL,
  signature TEXT NOT NULL,
  reopens   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (repo, host, check_id)
);

CREATE INDEX idx_suite_check_issues_number
  ON suite_check_issues (repo, number);

-- A claim of the old kind was only ever a few minutes old.
DELETE FROM suite_issues WHERE state = 'opening';

ALTER TABLE suite_issue_history ADD COLUMN check_id TEXT NOT NULL DEFAULT '';

-- An issue that reported exactly one check already belongs to it.
UPDATE suite_issue_history
SET check_id = json_extract(checks, '$[0]')
WHERE json_array_length(checks) = 1;

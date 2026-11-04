-- Badges and the reports behind the checks on pull requests.
--
-- idx_domains_repo: a repository's badge reads only the sites found in that
--   repository, not every domain of every person.
-- preview_reports: what a check on a pull request found, kept under a random
--   id so the check's "Details" link opens it, and an agent can read it as
--   JSON, without signing in. Old ones are removed by created_at.

CREATE INDEX idx_domains_repo ON domains (repo) WHERE repo IS NOT NULL;

CREATE TABLE preview_reports (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  sha TEXT NOT NULL,
  url TEXT NOT NULL,
  errors INTEGER NOT NULL,
  warnings INTEGER NOT NULL,
  hints INTEGER NOT NULL,
  findings TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_preview_reports_created ON preview_reports (created_at);

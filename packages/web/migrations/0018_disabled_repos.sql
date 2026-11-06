-- Repositories whose checks are turned off, and the hide feature gone.
--
-- A person can turn Plumbline off for a repository that has deployments but
-- that they do not want checked. While a repository is in this table its
-- deployment and push webhooks are discarded, the scheduled re-check skips its
-- sites, its issue events are ignored, and its open issues were closed with an
-- explanation when the row was added. Turning checks on again removes the row.
--
-- disabled_repos: one row per repository (owner/name), with the person who
--   turned it off and when. The primary key (repo) is the only access path:
--   webhooks and the schedule ask whether one repository is disabled, the
--   dashboard reads the rows of the repositories it lists.
--
-- user_hidden_repos is dropped: hiding a repository from the dashboard only
-- changed what was listed, and turning checks off replaces it.

CREATE TABLE disabled_repos (
  repo        TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  disabled_at TEXT NOT NULL
);

DROP TABLE user_hidden_repos;

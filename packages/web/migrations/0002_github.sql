-- The GitHub App: which GitHub account belongs to which signed-in person, the
-- installations of the app they own, and the repositories found in them.
--
-- github_links: one row per person who connected GitHub. `github_id` is
--   GitHub's stable user id (a login can be renamed), unique so one GitHub
--   account cannot be linked to two people.
-- github_installations: an installation of the app, owned by the person who
--   linked it. `installation_id` is GitHub's.
-- github_repos: a repository of an installation, with the hosts it is deployed
--   on (a JSON array; empty when it is not a deployed web application).
-- domains.repo: `owner/name` of the repository a domain was found in, or NULL
--   for one the person added by hand.

CREATE TABLE github_links (
  user_id    INTEGER PRIMARY KEY,
  github_id  INTEGER NOT NULL UNIQUE,
  login      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE github_installations (
  installation_id INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  account_login   TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX idx_github_installations_user ON github_installations (user_id);

CREATE TABLE github_repos (
  installation_id INTEGER NOT NULL,
  full_name       TEXT NOT NULL,
  user_id         INTEGER NOT NULL,
  default_branch  TEXT NOT NULL,
  hosts           TEXT NOT NULL,
  analysed_at     TEXT NOT NULL,
  PRIMARY KEY (installation_id, full_name)
);

CREATE INDEX idx_github_repos_user ON github_repos (user_id, full_name);

ALTER TABLE domains ADD COLUMN repo TEXT;

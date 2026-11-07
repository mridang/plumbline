-- Repositories whose own plumbline.yaml turns checks off (`enabled: false`).
--
-- It works like disabled_repos (webhooks dropped, the schedule skips the
-- repository, its issues are closed), but the file is its source of truth: the
-- row is added when a deployment or a push of the file shows the flag, and
-- removed when a push of the file no longer says false. A repository is off
-- when it is in either table.
--
-- config_disabled_repos: one row per repository (owner/name) and when the flag
--   was seen. The primary key (repo) is the only access path.
--
-- idx_github_repos_name: who installed the app for a repository is found by the
--   repository's name alone (only the installer may switch its checks), and the
--   table's primary key starts with the installation.

CREATE TABLE config_disabled_repos (
  repo        TEXT PRIMARY KEY,
  disabled_at TEXT NOT NULL
);

CREATE INDEX idx_github_repos_name ON github_repos (full_name);

-- Repositories a person has hidden from their dashboard.
--
-- A person who can see every repository of the app (an admin, say) may not
-- want an accidental one on the dashboard. Hiding is only about the dashboard:
-- the repository is still checked by the webhooks and the schedule, and its
-- issues and check runs still go to GitHub.
--
-- user_hidden_repos: one row per person and repository, with when it was
--   hidden. The primary key (user_id, repo) is the only access path: the
--   dashboard reads a person's rows by user_id, and hiding or unhiding one
--   repository finds its row by both columns.

CREATE TABLE user_hidden_repos (
  user_id   INTEGER NOT NULL,
  repo      TEXT NOT NULL,
  hidden_at TEXT NOT NULL,
  PRIMARY KEY (user_id, repo)
);

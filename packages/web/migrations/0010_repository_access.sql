-- Who can see which repository.
--
-- A person who signs in with GitHub (or links their GitHub account) is shown
-- the repositories they can reach among the ones the app is installed on, as
-- GitHub says at that moment. They are kept here, one row each, with the time
-- GitHub said so: access older than twelve hours is not honoured until they
-- sign in again, so a person who loses access to a repository stops seeing it.
--
-- PRIMARY KEY (user_id, repo): the repositories of one person.
-- idx_user_repositories_repo: the people who can see one repository, for the
--   live updates and notifications of its sites.

CREATE TABLE user_repositories (
  user_id INTEGER NOT NULL,
  repo TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, repo)
) WITHOUT ROWID;
CREATE INDEX idx_user_repositories_repo ON user_repositories (repo, user_id);

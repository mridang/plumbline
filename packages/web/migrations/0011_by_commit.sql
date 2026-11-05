-- Reports are kept by commit, never by age.
--
-- fresh_until went with the idea of leaving a site alone for as long as its
-- Cache-Control said its page was fresh: a result is now reused only because
-- it is for the same commit, not because a clock says it is recent.
-- idx_preview_reports_commit: finds the report already made for a commit of a
--   preview, so the same commit is not checked again.

ALTER TABLE suite_runs DROP COLUMN fresh_until;
CREATE INDEX idx_preview_reports_commit ON preview_reports (repo, sha, url);

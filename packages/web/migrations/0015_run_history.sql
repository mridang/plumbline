-- One history of the runs of a site, whoever started them.
--
-- suite_runs holds the runs the server makes (a deployment, the daily
-- re-check, a change to plumbline.yaml); reports holds the ones a person
-- starts. Both now say how and when a run started, which commit it was for and
-- how its checks ended, so the two can be listed together.
--
-- suite_runs.kind: deployment, scheduled or config. Runs from before it was
--   kept were all made by a deployment or the re-check; they read as
--   deployment.
-- suite_runs.passed/warned/failed/skipped: how many checks ended each way. Null
--   for a run from before they were kept, except failed and warned, which are
--   worked out below from the findings the run stored (so under the rules the
--   run applied, not the raw outcome).
-- suite_runs.outcomes: every check's outcome as JSON, so the run can be opened
--   as a report; null when it was too large to keep or the run is older.
-- reports.sha: the commit the repository was last known to be at when the
--   report was made; null when unknown.
-- idx_suite_runs_history: a site's history, newest first, one page at a time.

ALTER TABLE suite_runs ADD COLUMN kind TEXT NOT NULL DEFAULT 'deployment';
ALTER TABLE suite_runs ADD COLUMN passed INTEGER;
ALTER TABLE suite_runs ADD COLUMN warned INTEGER;
ALTER TABLE suite_runs ADD COLUMN failed INTEGER;
ALTER TABLE suite_runs ADD COLUMN skipped INTEGER;
ALTER TABLE suite_runs ADD COLUMN outcomes TEXT;
ALTER TABLE reports ADD COLUMN sha TEXT;

UPDATE suite_runs
SET failed = (
      SELECT COUNT(DISTINCT json_extract(f.value, '$.id'))
      FROM json_each(suite_runs.findings) AS f
      WHERE json_extract(f.value, '$.severity') = 'error'
    ),
    warned = (
      SELECT COUNT(DISTINCT json_extract(f.value, '$.id'))
      FROM json_each(suite_runs.findings) AS f
      WHERE json_extract(f.value, '$.severity') = 'warning'
        AND json_extract(f.value, '$.id') NOT IN (
          SELECT json_extract(e.value, '$.id')
          FROM json_each(suite_runs.findings) AS e
          WHERE json_extract(e.value, '$.severity') = 'error'
        )
    );

CREATE INDEX idx_suite_runs_history ON suite_runs (user_id, host, ran_at DESC, id DESC);

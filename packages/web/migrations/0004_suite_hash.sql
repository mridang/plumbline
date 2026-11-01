-- suite_runs.hash: SHA-256 of the response (status and body) a run read, so a
-- later run can see the page has not changed and skip reading it again.

ALTER TABLE suite_runs ADD COLUMN hash TEXT;

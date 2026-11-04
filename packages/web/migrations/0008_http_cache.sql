-- Respecting what a site says about its own page. Each run keeps the page's
-- validators (ETag, Last-Modified) so the next run can ask "has it changed?"
-- and be told 304 without the page being sent again, and the time the page is
-- fresh until (from Cache-Control: max-age, Age or Expires) so a scheduled
-- re-check does not fetch a page its owner said cannot have changed yet.

ALTER TABLE suite_runs ADD COLUMN etag TEXT;
ALTER TABLE suite_runs ADD COLUMN last_modified TEXT;
ALTER TABLE suite_runs ADD COLUMN fresh_until TEXT;

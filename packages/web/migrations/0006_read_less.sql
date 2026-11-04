-- Reading fewer rows. Each of these turns a query that read a whole table, or
-- every row of a domain, into one that reads only what it uses.
--
-- idx_reports_domain_page: lists a domain's reports newest first, and finds
--   the report to prune from, without sorting or reading the table.
-- idx_domains_user_created: lists a person's domains in order without a sort.
-- domains.checked_at, idx_domains_due: when each domain was last checked
--   ('' when never), so the scheduled re-check reads only the sites that are
--   due instead of every domain and every stored run. Only domains found
--   through GitHub (repo is not null) are in the index.
-- idx_webhook_deliveries_received: the purge of old delivery ids that runs
--   with every webhook reads only the old ones.

DROP INDEX idx_reports_domain;
CREATE INDEX idx_reports_domain_page ON reports (domain_id, created_at DESC, id DESC);

DROP INDEX idx_domains_user;
CREATE INDEX idx_domains_user_created ON domains (user_id, created_at, id);

ALTER TABLE domains ADD COLUMN checked_at TEXT NOT NULL DEFAULT '';
UPDATE domains SET checked_at = COALESCE(
  (SELECT MAX(ran_at) FROM suite_runs
    WHERE suite_runs.user_id = domains.user_id AND suite_runs.host = domains.host),
  ''
);
CREATE INDEX idx_domains_due ON domains (checked_at) WHERE repo IS NOT NULL;

CREATE INDEX idx_webhook_deliveries_received ON webhook_deliveries (received_at);

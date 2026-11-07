-- Where each site of a repository came from, so a site that its source no
-- longer lists can be dropped, and a site a person added is never dropped.
--
-- domains.source: manual (added by a person), config (the sites: list of
--   plumbline.yaml), deployment (the environment_url of a successful
--   deployment) or fallback (the Wrangler routes or the Website field, used
--   only while nothing better is known). Sites that exist today and belong to
--   a repository were found by the old sync, which read exactly those two
--   places, so they are fallback; the rest were added by hand.
-- domains.environment: for a deployment site, the name of the environment that
--   reported it; a newer deployment of that environment with another address
--   replaces it. Null for every other source.
--
-- Pruning reads a repository's sites by (user_id, repo), which the existing
-- partial index idx_domains_repo narrows to the repository.
ALTER TABLE domains ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE domains ADD COLUMN environment TEXT;
UPDATE domains SET source = 'fallback' WHERE repo IS NOT NULL;

-- Environments whose latest successful deployment reported no usable address,
-- so the repository page can say how to fix it. One row per repository and
-- environment (the primary key is the only access path: the page reads a
-- repository's rows by its prefix); the row goes when the environment reports
-- an address.
CREATE TABLE deploy_url_gaps (
  repo        TEXT NOT NULL,
  environment TEXT NOT NULL,
  seen_at     TEXT NOT NULL,
  PRIMARY KEY (repo, environment)
);

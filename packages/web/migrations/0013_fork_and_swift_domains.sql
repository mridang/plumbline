-- Forks carry the upstream project's website, and swiftpackageindex.com is a
-- package registry; neither is a site this account deploys. Remove the domains
-- the GitHub syncs added from them (a domain added by hand has no repo).

DELETE FROM domains
WHERE repo IS NOT NULL
  AND host IN ('swiftpackageindex.com', 'analogjs.org', 'qwik.dev');

-- Package registries and app stores are not sites a repository deploys, but a
-- repository's website field often links to its page there, and the first
-- GitHub syncs added those hosts as domains. Remove the ones that were added
-- from a repository (a domain added by hand has no repo and stays).

DELETE FROM domains
WHERE repo IS NOT NULL
  AND (
    host IN (
  'addons.mozilla.org',
  'apps.apple.com',
  'central.sonatype.com',
  'chrome.google.com',
  'chromewebstore.google.com',
  'cocoapods.org',
  'crates.io',
  'docs.rs',
  'hex.pm',
  'hub.docker.com',
  'marketplace.visualstudio.com',
  'mvnrepository.com',
  'npmjs.com',
  'nuget.org',
  'packagist.org',
  'pkg.go.dev',
  'play.google.com',
  'plugins.gradle.org',
  'plugins.traefik.io',
  'pub.dev',
  'pypi.org',
  'pypi.python.org',
  'rubygems.org',
  'search.maven.org'
    )
    OR host LIKE '%.npmjs.com'
    OR host LIKE '%.pypi.org'
    OR host LIKE '%.packagist.org'
    OR host LIKE '%.rubygems.org'
  );

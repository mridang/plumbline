import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { repoPath } from '@/components/repos/repo-path';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { buttonClass } from '@/components/ui/button';
import { Container, Heading } from '@/components/ui/layout';
import { PageHeader } from '@/components/ui/page-header';
import { getDatabase } from '@/domain/db/client';
import { listDomains } from '@/domain/db/domains';
import { getLink, listInstallations, listRepos } from '@/domain/db/github';
import { githubConfig } from '@/domain/github/service';
import { getCurrentUser } from '@/lib/core/auth/current-user';

import { DisconnectButton } from './_components/github-actions';

export const dynamic = 'force-dynamic';

/** The tab title of the GitHub page. */
export const metadata: Metadata = { title: 'GitHub' };

/** What each flag the callback can leave in the address says. */
const ERRORS: Readonly<Record<string, string>> = {
  unavailable: 'GitHub is not set up on this site yet.',
  state: 'That sign-in attempt expired. Try connecting again.',
  code: 'GitHub did not send a sign-in code. Try connecting again.',
  taken: 'That GitHub account is already connected to someone else.',
  failed: 'GitHub could not be reached. Try connecting again.',
  read: 'You are connected, but the repositories could not be read. Try connecting again.',
};

/**
 * The signed-in person's GitHub: connect the account (which ties it to the
 * Google one they signed in with), install the app, and the repositories
 * found in its installations. A repository that is a deployed web application
 * is listed with the hosts it serves, each one a domain whose checks can be
 * run. Anyone not signed in is sent to sign in and brought straight back.
 */
export default async function GitHubPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ error?: string }>;
}>): Promise<ReactElement> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?returnTo=${encodeURIComponent('/github')}`);
  }
  const { error } = await searchParams;
  const configured = githubConfig() !== null;
  const db = getDatabase();
  const [link, installations, repos, domains] = await Promise.all([
    getLink(db, user.id),
    listInstallations(db, user.id),
    listRepos(db, user.id),
    listDomains(db, user.id),
  ]);
  const domainOf = new Map(domains.map((domain) => [domain.host, domain.id]));
  const deployed = repos.filter((repo) => repo.hosts.length > 0);
  const others = repos.filter((repo) => repo.hosts.length === 0);

  return (
    <>
      <PageHeader
        eyebrow="GitHub"
        title="Your repositories"
        intro="Install the GitHub app and Plumbline finds the repositories that are deployed web applications, adds the sites they serve to your domains, and keeps them up to date as the repositories change."
      />
      <Container className="space-y-12 pb-16">
        {error && ERRORS[error] ? (
          <Callout tone="error" shape="banner">
            {ERRORS[error]}
          </Callout>
        ) : null}
        {!configured ? (
          <Callout tone="plain" shape="banner">
            GitHub is not set up on this site. The app&apos;s settings
            (GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_CLIENT_ID,
            GITHUB_CLIENT_SECRET, GITHUB_PRIVATE_KEY and GITHUB_WEBHOOK_SECRET)
            are missing.
          </Callout>
        ) : (
          <section>
            <Heading variant="h3">Account</Heading>
            {link ? (
              <>
                <p className="mt-2 text-muted">
                  Connected as <strong>{link.login}</strong> to {user.email}.{' '}
                  {installations.length}{' '}
                  {installations.length === 1
                    ? 'installation'
                    : 'installations'}
                  {installations.length > 0
                    ? ` (${installations.map((i) => i.account_login).join(', ')})`
                    : ''}
                  .
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="/auth/github/link?install=1"
                    className={buttonClass({ variant: 'accent' })}
                  >
                    Install on another account
                  </a>
                  <DisconnectButton />
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 max-w-2xl text-muted">
                  Connecting proves the GitHub account is yours and ties it to{' '}
                  {user.email}. Plumbline asks only to read repository contents
                  and metadata, and keeps no GitHub sign-in token.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="/auth/github/link?install=1"
                    className={buttonClass({ variant: 'accent' })}
                  >
                    Install the GitHub app
                  </a>
                  <a
                    href="/auth/github/link"
                    className={buttonClass({ variant: 'outline' })}
                  >
                    Already installed? Connect
                  </a>
                </div>
              </>
            )}
          </section>
        )}

        {link ? (
          <section>
            <Heading variant="h3">Deployed web applications</Heading>
            {deployed.length === 0 ? (
              <p className="mt-3 text-muted">
                None found yet. A repository counts when its Wrangler
                configuration names the domains it is served on, or its website
                field names the live site. Repositories you add to the app later
                show up here by themselves.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {deployed.map((repo) => (
                  <li key={`${repo.installation_id}/${repo.full_name}`}>
                    <Card padding="lg" className="h-full">
                      <a
                        href={`https://github.com/${repo.full_name}`}
                        className="focus-ring font-semibold break-all underline-offset-4 hover:underline"
                      >
                        {repo.full_name}
                      </a>
                      <ul className="mt-3 space-y-1">
                        {repo.hosts.map((host) => {
                          const id = domainOf.get(host);
                          return (
                            <li key={host} className="text-sm">
                              {id ? (
                                <Link
                                  href={`${repoPath(repo.full_name)}#site-${id}`}
                                  className="focus-ring break-all underline"
                                >
                                  {host}
                                </Link>
                              ) : (
                                <span className="break-all">{host}</span>
                              )}
                              {id ? (
                                <span className="text-subtle">
                                  {' '}
                                  · run checks
                                </span>
                              ) : (
                                <span className="text-subtle">
                                  {' '}
                                  · not added (domain limit reached)
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            {others.length > 0 ? (
              <details className="mt-6">
                <summary className="focus-ring cursor-pointer text-muted">
                  {others.length} other{' '}
                  {others.length === 1 ? 'repository' : 'repositories'} with no
                  deployment found
                </summary>
                <ul className="mt-3 columns-1 gap-6 text-sm text-muted md:columns-2">
                  {others.map((repo) => (
                    <li key={`${repo.installation_id}/${repo.full_name}`}>
                      {repo.full_name}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        ) : null}
      </Container>
    </>
  );
}

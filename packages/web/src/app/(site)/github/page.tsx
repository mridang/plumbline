import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { RepoLabel } from '@/components/repos/repo-label';
import { siteHref } from '@/components/repos/site-href';
import { Badge } from '@/components/ui-app/badge';
import { EmptyState } from '@/components/ui-app/empty-state';
import { KeyValue } from '@/components/ui-app/key-value';
import { LinkButton } from '@/components/ui-app/link-button';
import { Section } from '@/components/ui-app/section';
import { Callout } from '@/components/ui/callout';
import { Container } from '@/components/ui/layout';
import { PageHeading } from '@/components/ui-app/page-heading';
import { getDatabase } from '@/domain/db/client';
import { listDomains } from '@/domain/db/domains';
import { getLink, listInstallations, listRepos } from '@/domain/db/github';
import { signedInWithGithub } from '@/domain/github/sign-in';
import { githubConfig } from '@/domain/github/service';
import { getCurrentUser } from '@/lib/core/auth/current-user';
import { countOf } from '@/lib/intl';

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
  const added = new Set(domains.map((domain) => domain.host));
  const githubOnly = signedInWithGithub(user);
  const deployed = repos.filter((repo) => repo.hosts.length > 0);
  const others = repos.filter((repo) => repo.hosts.length === 0);

  return (
    <>
      <PageHeading
        eyebrow="GitHub"
        title="Your repositories"
        description="Install the GitHub app and Plumbline finds the repositories that are deployed web applications, puts the sites they serve on your dashboard, and keeps them up to date as the repositories change."
      />
      <Container className="space-y-8 py-6 sm:py-8">
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
        ) : link ? (
          <Section
            id="account"
            title="Account"
            actions={
              <div className="flex flex-wrap gap-3">
                <LinkButton href="/auth/github/link?install=1" native>
                  Install on another account
                </LinkButton>
                {/* Their GitHub account is how they sign in: there is nothing to disconnect it from. */}
                {githubOnly ? null : <DisconnectButton />}
              </div>
            }
          >
            <KeyValue
              facts={[
                { label: 'GitHub', value: <strong>{link.login}</strong> },
                {
                  label: 'Signed in with',
                  value: githubOnly ? 'GitHub' : user.email,
                },
                {
                  label: 'Installed on',
                  value:
                    installations.length === 0 ? (
                      'No account yet'
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {installations.map((installation) => (
                          <Badge key={installation.installation_id} size="md">
                            {installation.account_login}
                          </Badge>
                        ))}
                      </span>
                    ),
                },
              ]}
            />
          </Section>
        ) : (
          <Section
            id="account"
            title="Connect GitHub"
            description={`Connecting proves the GitHub account is yours and ties it to ${user.email}. Plumbline asks only to read repository contents and metadata, and keeps no GitHub sign-in token.`}
          >
            <div className="flex flex-wrap gap-3">
              <LinkButton href="/auth/github/link?install=1" native>
                Install the GitHub app
              </LinkButton>
              <LinkButton href="/auth/github/link" native variant="outline">
                Already installed? Connect
              </LinkButton>
            </div>
          </Section>
        )}

        {link ? (
          <Section
            id="deployed"
            title="Deployed web applications"
            description={
              deployed.length > 0
                ? `${countOf(deployed.length, 'repository', 'repositories')} serving a site.`
                : undefined
            }
          >
            {deployed.length === 0 ? (
              <EmptyState title="None found yet">
                A repository counts when its Wrangler configuration names the
                addresses it is served on, or its website field names the live
                site. Repositories you add to the app later show up here by
                themselves.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line rounded-card border border-line bg-surface px-5">
                {deployed.map((repo) => (
                  <li
                    key={`${repo.installation_id}/${repo.full_name}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
                  >
                    <RepoLabel
                      repo={repo.full_name}
                      href={siteHref(repo.full_name, repo.hosts[0] ?? '')}
                    />
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                      {repo.hosts.map((host) => {
                        return (
                          <li key={host} className="break-all">
                            {added.has(host) ? (
                              <Link
                                href={siteHref(repo.full_name, host)}
                                className="focus-ring underline underline-offset-4 hover:text-ink"
                              >
                                {host}
                              </Link>
                            ) : (
                              <span title="Not added: the limit of sites was reached">
                                {host} · not added (site limit reached)
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
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
          </Section>
        ) : null}
      </Container>
    </>
  );
}

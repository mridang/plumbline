'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { LinkIcon } from '@/components/icons';
import { problemText } from '@/components/api/problem-message';
import { setRepoHidden } from '@/components/repos/hide-repo';
import { repoPath } from '@/components/repos/repo-path';
import { STATES, StatusDot, worstState } from '@/components/repos/site-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { RepoStatus, SiteStatus } from '@/domain/db/live';
import { countOf, relativeTime } from '@/lib/intl';

/** " · 2 errors, 1 warning": only the counts that are not zero, and nothing for a site with none. */
function findingsOf(site: SiteStatus): string {
  const parts = [
    site.errors > 0 ? countOf(site.errors, 'error') : '',
    site.warnings > 0 ? countOf(site.warnings, 'warning') : '',
  ].filter((part) => part !== '');
  return (site.state === 'failing' || site.state === 'warning') &&
    parts.length > 0
    ? ` · ${parts.join(', ')}`
    : '';
}

/** One site of a repository: its host as plain text, how it stands, and when it was last checked. */
export function SiteLine({
  site,
}: Readonly<{ site: SiteStatus }>): ReactElement {
  const { label, tone } = STATES[site.state];
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
      <span className="min-w-0 font-medium break-all">
        {site.host}
        <a
          href={`https://${site.host}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${site.host} (opens in a new tab)`}
          className="focus-ring ml-1.5 text-subtle hover:text-ink"
        >
          <LinkIcon size="sm" className="inline" />
        </a>
      </span>
      <span className="text-sm">
        <span className={`font-semibold ${tone}`}>
          {label}
          {findingsOf(site)}
        </span>
        {site.checked_at ? (
          <time
            dateTime={site.checked_at}
            suppressHydrationWarning
            className="ml-2 text-subtle"
          >
            {relativeTime(site.checked_at)}
          </time>
        ) : null}
      </span>
    </li>
  );
}

/**
 * One repository on the dashboard: its name (the link to its page), how its
 * sites stand overall, each site, and a control to hide it from the dashboard
 * or show it again. A hidden repository (shown only when asked for) is dimmed.
 * The group of sites added by hand (`repo` null) has no page and cannot be
 * hidden.
 */
export function RepoCard({
  repo,
  hidden,
}: Readonly<{ repo: RepoStatus; hidden: boolean }>): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const overall = worstState(repo.sites.map((site) => site.state));
  const name = repo.repo;

  const toggle = async (): Promise<void> => {
    if (name === null) {
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await setRepoHidden(name, !hidden);
      router.refresh();
    } catch (error) {
      setProblem(problemText(error, 'Could not change that. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      as="article"
      padding="lg"
      className={`flex h-full flex-col transition hover:border-ink/30 hover:shadow-sm ${hidden ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-lg font-semibold">
          <StatusDot state={overall} />
          {name === null ? (
            <span className="break-all">Added by hand</span>
          ) : (
            <Link
              href={repoPath(name)}
              className="focus-ring break-all underline-offset-4 hover:underline"
            >
              {name}
            </Link>
          )}
        </h2>
        {name === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void toggle()}
          >
            {hidden ? 'Unhide' : 'Hide'}
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        {countOf(repo.sites.length, 'site')}
        {hidden ? ' · hidden from your dashboard' : ''}
      </p>
      <ul className="mt-3 divide-y divide-field/60 border-t border-field/60">
        {repo.sites.map((site) => (
          <SiteLine key={site.id} site={site} />
        ))}
      </ul>
      {problem ? (
        <p role="alert" className="mt-3 text-sm text-failed">
          {problem}
        </p>
      ) : null}
    </Card>
  );
}

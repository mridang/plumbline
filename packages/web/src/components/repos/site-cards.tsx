'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

import { LinkIcon } from '@/components/icons';
import {
  controlOf,
  type ChecksControl,
} from '@/components/repos/checks-control';
import { RepoLabel } from '@/components/repos/repo-label';
import { commitUrl, issuesUrl } from '@/components/repos/site-rows';
import { SiteActions, sitePageOf } from '@/components/repos/site-actions';
import { worstResult } from '@/components/repos/site-filter';
import {
  ResultBadge,
  SiteStateMarker,
  SiteStanding,
} from '@/components/repos/site-status';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui-app/badge';
import { CountsBar } from '@/components/ui-app/counts-bar';
import { RelativeTime } from '@/components/ui-app/relative-time';
import type { RepoStatus, SiteStatus } from '@/domain/db/live';
import { countOf } from '@/lib/intl';

/** A label and its value, side by side, for a card's small facts. */
function Fact({
  label,
  children,
}: Readonly<{
  label: string;
  children: ReactElement | string;
}>): ReactElement {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-muted">{children}</dd>
    </div>
  );
}

/** One site on a card: host, state, what it has wrong as a bar and in words, and when it was checked. */
function SiteBlock({
  repo,
  site,
  now,
}: Readonly<{
  repo: string | null;
  site: SiteStatus;
  now: number;
}>): ReactElement {
  const checked = site.checked_at !== null;
  const problems = [
    site.errors > 0 ? countOf(site.errors, 'error') : '',
    site.warnings > 0 ? countOf(site.warnings, 'warning') : '',
  ].filter((part) => part !== '');
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <Link
            href={sitePageOf(repo, site)}
            title={site.host}
            className="focus-ring truncate rounded-sm underline-offset-4 hover:underline"
          >
            {site.host}
          </Link>
          <a
            href={`https://${site.host}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${site.host} (opens in a new tab)`}
            className="focus-ring shrink-0 rounded-sm text-subtle hover:text-ink"
          >
            <LinkIcon size="xs" />
          </a>
        </span>
        <SiteStanding state={site.state} paused={false} />
      </div>
      {checked ? (
        <CountsBar failed={site.errors} warned={site.warnings} />
      ) : null}
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {problems.length > 0 ? (
          <Fact label="Found">{problems.join(' · ')}</Fact>
        ) : null}
        <Fact label="Checked">
          {site.checked_at === null ? (
            '—'
          ) : (
            <RelativeTime at={site.checked_at} now={now} />
          )}
        </Fact>
        <Fact label="Deployed">
          {site.deployed_at === null ? (
            '—'
          ) : (
            <RelativeTime at={site.deployed_at} now={now} />
          )}
        </Fact>
        {site.sha === null || repo === null ? null : (
          <Fact label="Commit">
            <a
              href={commitUrl(repo, site.sha)}
              className="focus-ring rounded-sm font-mono hover:text-accent"
            >
              {site.sha.slice(0, 7)}
            </a>
          </Fact>
        )}
      </dl>
    </li>
  );
}

/**
 * A repository as a compact card: its name as the link to its page, how its
 * worst site stands, the issues open for it, a menu, and a block for each
 * site with its bar of what is wrong, when it was last checked and deployed
 * and the commit. A repository whose checks are paused is dimmed.
 */
export function SiteCard({
  repo,
  paused,
  control,
  now,
}: Readonly<{
  repo: RepoStatus;
  paused: boolean;
  control: Readonly<ChecksControl>;
  now: number;
}>): ReactElement {
  const overall = worstResult(repo.sites.map((site) => site.state));
  const first = repo.sites[0];
  return (
    <article
      className={cn(
        'flex flex-col rounded-card border border-line bg-surface p-4 shadow-xs hover:border-ink/25 hover:shadow-sm motion-safe:transition',
        paused && 'opacity-60',
      )}
      aria-label={repo.repo ?? 'Sites added by hand'}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          {repo.repo === null ? (
            <p className="text-sm font-semibold">Added by hand</p>
          ) : (
            <RepoLabel
              repo={repo.repo}
              href={first ? sitePageOf(repo.repo, first) : undefined}
            />
          )}
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>{countOf(repo.sites.length, 'site')}</span>
            {repo.sites.length > 1 && overall !== null ? (
              <ResultBadge result={overall} />
            ) : null}
            {paused ? (
              <SiteStateMarker state={first?.state ?? 'unchecked'} paused />
            ) : null}
            {repo.repo !== null && repo.open_issues > 0 ? (
              <a
                href={issuesUrl(repo.repo)}
                className="focus-ring rounded-full"
              >
                <Badge tone="bad">{repo.open_issues} open</Badge>
              </a>
            ) : null}
          </p>
        </div>
        {first ? (
          <SiteActions
            repo={repo.repo}
            site={first}
            paused={paused}
            control={control}
          />
        ) : null}
      </header>
      <ul className="mt-3 divide-y divide-line border-t border-line pt-3">
        {repo.sites.map((site) => (
          <SiteBlock key={site.id} repo={repo.repo} site={site} now={now} />
        ))}
      </ul>
    </article>
  );
}

/** The dashboard as a grid of compact cards, each as wide as it can be within a comfortable range. */
export function SiteCards({
  repos,
  paused,
  manageable,
  fileOff,
  now,
}: Readonly<{
  repos: readonly RepoStatus[];
  /** The repositories whose checks are turned off. */
  paused: ReadonlySet<string>;
  /** The repositories the viewer installed the app for: only they may flip the switch. */
  manageable: ReadonlySet<string>;
  /** The repositories whose `plumbline.yaml` turns checks off. */
  fileOff: ReadonlySet<string>;
  now: number;
}>): ReactElement {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-4">
      {repos.map((repo) => (
        <SiteCard
          key={repo.repo ?? 'by-hand'}
          repo={repo}
          paused={repo.repo !== null && paused.has(repo.repo)}
          control={controlOf(repo.repo, manageable, fileOff)}
          now={now}
        />
      ))}
    </div>
  );
}

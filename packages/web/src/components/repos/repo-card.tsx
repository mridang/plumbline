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
import { Chip } from '@/components/ui-app/chip';
import { RelativeTime } from '@/components/ui-app/relative-time';
import { StatusCard } from '@/components/ui-app/status-card';
import { TextList } from '@/components/ui-app/text-list';
import type { RepoStatus, SiteStatus } from '@/domain/db/live';
import { countOf } from '@/lib/intl';

/** What a failing or warning site has wrong, as a list of counts. */
function findingsOf(site: SiteStatus): string[] {
  return site.state === 'failing' || site.state === 'warning'
    ? [
        site.errors > 0 ? countOf(site.errors, 'error') : '',
        site.warnings > 0 ? countOf(site.warnings, 'warning') : '',
      ].filter((part) => part !== '')
    : [];
}

/**
 * One site of a repository: its address (with a link out to the live site), how
 * it stands, what it has wrong and when it was last checked. `now` is the
 * server's clock, so the time reads the same in both places.
 */
export function SiteLine({
  site,
  now,
}: Readonly<{ site: SiteStatus; now: number }>): ReactElement {
  const { label, kind } = STATES[site.state];
  const findings = findingsOf(site);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
      <span className="flex min-w-0 items-center gap-1.5 font-medium">
        <span className="break-all">{site.host}</span>
        <a
          href={`https://${site.host}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${site.host} (opens in a new tab)`}
          className="focus-ring shrink-0 text-subtle hover:text-ink"
        >
          <LinkIcon size="sm" />
        </a>
      </span>
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
        <Chip tone={kind}>{label}</Chip>
        {findings.length > 0 ? (
          <span className="text-muted">
            <TextList items={findings} />
          </span>
        ) : null}
        {site.checked_at ? (
          <RelativeTime
            at={site.checked_at}
            now={now}
            className="text-subtle"
          />
        ) : null}
      </span>
    </li>
  );
}

/**
 * A repository on the dashboard: a card with an edge in the colour of its worst
 * site, the repository's name as the link to its page, a Hide or Unhide button
 * and one line for each site. A hidden one is dimmed.
 */
export function RepoCard({
  repo,
  hidden,
  now,
}: Readonly<{
  repo: RepoStatus;
  hidden: boolean;
  now: number;
}>): ReactElement {
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
    <StatusCard tone={STATES[overall].kind} muted={hidden}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-lg font-semibold text-balance">
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
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {repo.sites.map((site) => (
          <SiteLine key={site.id} site={site} now={now} />
        ))}
      </ul>
      {problem ? (
        <p role="alert" className="mt-3 text-sm text-failed">
          {problem}
        </p>
      ) : null}
    </StatusCard>
  );
}

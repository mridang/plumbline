'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

import { LinkIcon } from '@/components/icons';
import {
  commitUrl,
  issuesUrl,
  type Sort,
  type SiteRow,
  type SortKey,
} from '@/components/repos/site-rows';
import { RepoLabel } from '@/components/repos/repo-label';
import { SiteActions, sitePageOf } from '@/components/repos/site-actions';
import { StatusBadge } from '@/components/repos/site-state';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui-app/badge';
import { RelativeTime } from '@/components/ui-app/relative-time';
import { CountCell } from '@/components/ui-app/stat';
import {
  SortHeadCell,
  type SortDirection,
} from '@/components/ui-app/sort-head-cell';
import { HeadCell, Cell } from '@/components/ui-app/table';

/** A time as words, or a dash when there is none. */
function When({
  at,
  now,
}: Readonly<{ at: string | null; now: number }>): ReactElement {
  return at === null ? (
    <span className="text-subtle" title="Not known yet">
      —
    </span>
  ) : (
    <RelativeTime at={at} now={now} className="text-muted" />
  );
}

/** A commit as a short monospace link to GitHub, or a dash. */
function Commit({
  repo,
  sha,
}: Readonly<{ repo: string | null; sha: string | null }>): ReactElement {
  if (sha === null) {
    return <span className="text-subtle">—</span>;
  }
  const short = sha.slice(0, 7);
  return repo === null ? (
    <span className="font-mono text-xs">{short}</span>
  ) : (
    <a
      href={commitUrl(repo, sha)}
      title={sha}
      className="focus-ring rounded-sm font-mono text-xs text-muted underline-offset-4 hover:text-accent hover:underline"
    >
      {short}
    </a>
  );
}

/** The open issues of a repository: a badge that opens them on GitHub, or a dash. */
function Issues({
  repo,
  count,
}: Readonly<{ repo: string | null; count: number }>): ReactElement {
  if (repo === null || count === 0) {
    return <span className="text-subtle">—</span>;
  }
  return (
    <a
      href={issuesUrl(repo)}
      title={`${count} open ${count === 1 ? 'issue' : 'issues'} on GitHub`}
      className="focus-ring rounded-full"
    >
      <Badge tone="bad">{count} open</Badge>
    </a>
  );
}

/** The host of a site, with a link out to the live site. */
function Host({ host }: Readonly<{ host: string }>): ReactElement {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-muted">
      <span className="truncate" title={host}>
        {host}
      </span>
      <a
        href={`https://${host}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${host} (opens in a new tab)`}
        className="focus-ring shrink-0 rounded-sm text-subtle hover:text-ink"
      >
        <LinkIcon size="xs" />
      </a>
    </span>
  );
}

/** How a row stands: a muted "Paused" when checks are off for its repository, else its state. */
function Status({ row }: Readonly<{ row: SiteRow }>): ReactElement {
  return row.paused ? (
    <Badge>Paused</Badge>
  ) : (
    <StatusBadge state={row.site.state} />
  );
}

/** What names a row: the repository as the link to its page, and the host under it. */
function Name({ row }: Readonly<{ row: SiteRow }>): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-2">
        {row.repo === null ? (
          <Link
            href={sitePageOf(null, row.site)}
            className="focus-ring truncate text-sm font-semibold underline-offset-4 hover:underline"
          >
            Added by hand
          </Link>
        ) : (
          <RepoLabel repo={row.repo} href={sitePageOf(row.repo, row.site)} />
        )}
        {row.paused ? <Badge>Paused</Badge> : null}
      </span>
      <Host host={row.site.host} />
    </div>
  );
}

/** The direction a column is sorted, or null when the table is sorted by another. */
function directionOf(sort: Sort, key: SortKey): SortDirection | null {
  return sort.key === key ? sort.direction : null;
}

/**
 * The dashboard as a table, one row for each site: how it stands, its repository
 * and host, when it was last deployed and checked, the commit, what it has
 * wrong, the issues open for it, and a menu. The headings of the columns that
 * mean something sort it. On a phone the same rows are a list.
 */
export function SitesTable({
  rows,
  sort,
  onSort,
  now,
}: Readonly<{
  rows: readonly SiteRow[];
  sort: Sort;
  onSort: (key: SortKey) => void;
  /** The server's clock when the page was made, in milliseconds. */
  now: number;
}>): ReactElement {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-xs sm:block">
        <table className="w-full min-w-208 text-left text-sm">
          <caption className="sr-only">Your sites and how each stands</caption>
          <thead className="border-b border-line bg-ink/3 text-xs">
            <tr>
              <SortHeadCell
                direction={directionOf(sort, 'status')}
                onSort={() => onSort('status')}
              >
                Status
              </SortHeadCell>
              <SortHeadCell
                direction={directionOf(sort, 'site')}
                onSort={() => onSort('site')}
              >
                Site
              </SortHeadCell>
              <SortHeadCell
                direction={directionOf(sort, 'deployed')}
                onSort={() => onSort('deployed')}
              >
                Last deployed
              </SortHeadCell>
              <SortHeadCell
                direction={directionOf(sort, 'checked')}
                onSort={() => onSort('checked')}
              >
                Last checked
              </SortHeadCell>
              <HeadCell>Commit</HeadCell>
              <HeadCell align="end">Failed</HeadCell>
              <HeadCell align="end">Warned</HeadCell>
              <SortHeadCell
                direction={directionOf(sort, 'issues')}
                onSort={() => onSort('issues')}
              >
                Issues
              </SortHeadCell>
              <HeadCell align="end" hidden>
                Actions
              </HeadCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const checked = row.site.checked_at !== null;
              return (
                <tr
                  key={row.key}
                  className={cn(
                    'hover:bg-ink/3 motion-safe:transition-colors',
                    row.paused && 'opacity-60',
                  )}
                >
                  <Cell>
                    <Status row={row} />
                  </Cell>
                  <Cell nowrap={false}>
                    <Name row={row} />
                  </Cell>
                  <Cell>
                    <When at={row.site.deployed_at} now={now} />
                  </Cell>
                  <Cell>
                    <When at={row.site.checked_at} now={now} />
                  </Cell>
                  <Cell>
                    <Commit repo={row.repo} sha={row.site.sha} />
                  </Cell>
                  <Cell align="end">
                    <CountCell
                      value={checked ? row.site.errors : null}
                      word="failed"
                      tone="bad"
                    />
                  </Cell>
                  <Cell align="end">
                    <CountCell
                      value={checked ? row.site.warnings : null}
                      word="warned"
                      tone="warn"
                    />
                  </Cell>
                  <Cell>
                    <Issues repo={row.repo} count={row.openIssues} />
                  </Cell>
                  <Cell align="end">
                    <SiteActions
                      repo={row.repo}
                      site={row.site}
                      paused={row.paused}
                    />
                  </Cell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-xs sm:hidden">
        {rows.map((row) => (
          <li
            key={row.key}
            className={cn('space-y-2 p-4', row.paused && 'opacity-60')}
          >
            <div className="flex items-start justify-between gap-3">
              <Name row={row} />
              <SiteActions
                repo={row.repo}
                site={row.site}
                paused={row.paused}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
              <Status row={row} />
              {row.site.checked_at === null ? null : (
                <span>
                  Checked <When at={row.site.checked_at} now={now} />
                </span>
              )}
              {row.site.deployed_at === null ? null : (
                <span>
                  Deployed <When at={row.site.deployed_at} now={now} />
                </span>
              )}
              <Commit repo={row.repo} sha={row.site.sha} />
              <Issues repo={row.repo} count={row.openIssues} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

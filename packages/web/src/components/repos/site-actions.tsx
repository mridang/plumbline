'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

import {
  ChecksMenuItem,
  useRepoChecks,
} from '@/components/repos/checks-switch';
import { repoPath } from '@/components/repos/repo-path';
import { POPOVER_ITEM, PopoverSeparator } from '@/components/ui/popover';
import { RowActions } from '@/components/ui-app/row-actions';

/** Where a site's page is: its repository's page on the site's tab, or the old page of a site added by hand. */
export function sitePageOf(
  repo: string | null,
  site: Readonly<{ id: string; host: string }>,
): string {
  return repo === null
    ? `/domains/${site.id}`
    : `${repoPath(repo)}?site=${encodeURIComponent(site.host)}`;
}

/**
 * What can be done with a site on the dashboard, in a menu at the end of its
 * row: open its page, run its checks (there), open the live site, open the
 * repository on GitHub, and turn checks for the repository off or on.
 */
export function SiteActions({
  repo,
  site,
  paused,
}: Readonly<{
  repo: string | null;
  site: Readonly<{ id: string; host: string }>;
  paused: boolean;
}>): ReactElement {
  const page = sitePageOf(repo, site);
  const checks = useRepoChecks(repo, paused);
  return (
    <>
      <RowActions label={repo ?? site.host}>
        <Link href={page} className={POPOVER_ITEM}>
          View results
        </Link>
        <Link href={page} className={POPOVER_ITEM}>
          Run checks
        </Link>
        <a
          href={`https://${site.host}`}
          target="_blank"
          rel="noopener noreferrer"
          className={POPOVER_ITEM}
        >
          Open {site.host}
        </a>
        {repo === null ? null : (
          <>
            <a
              href={`https://github.com/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className={POPOVER_ITEM}
            >
              Open on GitHub
            </a>
            <PopoverSeparator />
            <ChecksMenuItem paused={paused} onRequest={checks.request} />
            {checks.problem ? (
              <p role="alert" className="px-3 py-1 text-xs text-failed">
                {checks.problem}
              </p>
            ) : null}
          </>
        )}
      </RowActions>
      {checks.dialog}
    </>
  );
}

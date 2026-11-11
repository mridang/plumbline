'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';

import {
  applyFilter,
  countsOf,
  summaryOf,
  type Filter,
} from '@/components/repos/site-filter';
import {
  DEFAULT_SORT,
  dashboardHref,
  filterRows,
  groupRows,
  nextSort,
  rowsOf,
  sortRows,
  type Sort,
  type View,
} from '@/components/repos/site-rows';
import { SiteCards } from '@/components/repos/site-cards';
import { SitesTable } from '@/components/repos/sites-table';
import { StatusFilterBar } from '@/components/repos/status-filter-bar';
import {
  ConnectionIndicator,
  type Connection,
} from '@/components/ui-app/connection-indicator';
import { EmptyState } from '@/components/ui-app/empty-state';
import { LinkButton } from '@/components/ui-app/link-button';
import { SearchField } from '@/components/ui-app/search-field';
import { SegmentedLinks } from '@/components/ui-app/segmented-control';
import type { RepoStatus } from '@/domain/db/live';
import {
  browserEnvironment,
  keepStreamWhileVisible,
} from '@/domain/live/connection';
import { applyEvent, parseEvent } from '@/domain/live/events';

/** How long the page waits for a burst of events before it shows them, in milliseconds. */
const READ_AGAIN_MS = 250;

/**
 * The status of every repository, kept live: the page opens a stream of what
 * happens to the person's sites and shows each check beginning and ending as
 * it does. The browser reconnects a dropped stream by itself and the server
 * replays what was missed; when it cannot, the overview is read again.
 */
export function LiveOverview({
  initial,
  paused,
  manageable,
  fileOff,
  view,
  filter: initialFilter,
  now,
}: Readonly<{
  initial: readonly RepoStatus[];
  /** How the sites are shown: a table or cards. */
  view: View;
  /** What the address asked to narrow the list by. */
  filter: Filter;
  /** The server's clock when the page was made, in milliseconds. */
  now: number;
  /** The repositories whose checks are turned off. */
  paused: readonly string[];
  /** The repositories the viewer installed the app for. */
  manageable: readonly string[];
  /** The repositories whose `plumbline.yaml` turns checks off. */
  fileOff: readonly string[];
}>): ReactElement {
  const router = useRouter();
  const [repos, setRepos] = useState<readonly RepoStatus[]>(initial);

  const [connection, setConnection] = useState<Connection>('connecting');
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return undefined;
    }
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // What the page was drawn with is read again by the server, not by a call
    // of ours: the page is the one place that knows how to read it.
    const reread = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), READ_AGAIN_MS);
    };
    // The stream is open only while the tab is showing (and for a short while
    // after it is hidden): a tab nobody looks at must not hold a connection.
    const stopKeeping = keepStreamWhileVisible(
      {
        open: () => {
          const opened = new EventSource('/events');
          source = opened;
          // A fresh stream starts from now, so read once on every (re)connection to
          // pick up whatever happened while it was away.
          opened.addEventListener('open', () => {
            setConnection('live');
            reread();
          });
          opened.addEventListener('error', () => setConnection('offline'));
          opened.addEventListener('live', (message) => {
            const event = parseEvent((message as MessageEvent<string>).data);
            if (event) {
              setRepos((current) => applyEvent(current, event));
            }
          });
          opened.addEventListener('reset', reread);
        },
        close: () => {
          source?.close();
          source = undefined;
          setConnection('offline');
        },
      },
      browserEnvironment(),
    );
    return () => {
      clearTimeout(timer);
      stopKeeping();
    };
  }, [router]);

  const pausedSet = new Set(paused);
  const manageableSet = new Set(manageable);
  const fileOffSet = new Set(fileOff);
  const searched = filterRows(
    rowsOf(repos, pausedSet, manageableSet, fileOffSet),
    query,
  );
  // Counts are taken over the same rows the filter works on, so a chip's
  // number is the number of rows it shows.
  const counts = countsOf(searched);
  const rows = sortRows(applyFilter(searched, filter), sort);
  const change = (next: Filter): void => {
    setFilter(next);
    // Keep the address in step so the view can be shared and survives a refresh.
    globalThis.history.replaceState(null, '', dashboardHref(view, next));
  };
  if (repos.length === 0) {
    return (
      <EmptyState
        title="No sites yet"
        action={<LinkButton href="/github">Connect GitHub</LinkButton>}
      >
        Plumbline finds the repositories that are deployed web applications and
        puts the sites they serve here. Install the GitHub app to begin.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-sm font-medium text-ink" aria-live="polite">
          {summaryOf(counts)}
        </p>
        <ConnectionIndicator state={connection} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <StatusFilterBar counts={counts} filter={filter} onChange={change} />
        <div className="flex flex-wrap items-center gap-3">
          <SearchField
            label="Search sites"
            placeholder="Search sites"
            value={query}
            onChange={setQuery}
          />
          <SegmentedLinks
            label="View"
            value={view}
            options={[
              {
                value: 'table',
                label: 'Table',
                href: dashboardHref('table', filter),
              },
              {
                value: 'cards',
                label: 'Cards',
                href: dashboardHref('cards', filter),
              },
            ]}
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No site matches">
          {query.trim() === ''
            ? 'No site is shown with these filters.'
            : `Nothing here has “${query.trim()}” in its repository or address.`}
        </EmptyState>
      ) : (view === 'cards' ? (
        <SiteCards
          repos={groupRows(rows)}
          paused={pausedSet}
          manageable={manageableSet}
          fileOff={fileOffSet}
          now={now}
        />
      ) : (
        <SitesTable
          rows={rows}
          sort={sort}
          onSort={(key) => setSort((current) => nextSort(current, key))}
          now={now}
        />
      ))}
    </div>
  );
}

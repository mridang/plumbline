/**
 * @packageDocumentation
 *
 * The dashboard's table, as data: one row for each site, put in order, narrowed
 * by what was typed. A repository whose checks are paused keeps its rows, marked.
 * Pure, so the page in the browser and the tests use the same rules.
 */

import { WORST_FIRST } from '@/components/repos/site-state';
import type { RepoStatus, SiteStatus } from '@/domain/db/live';

/** How the dashboard can be shown: as a table or as cards. */
export type View = 'table' | 'cards';

/** The view in the address, or the table when it says nothing, or something else. */
export function viewOf(value: string | undefined): View {
  return value === 'cards' ? 'cards' : 'table';
}

/** The dashboard's address for a view. */
export function dashboardHref(view: View): string {
  return view === 'cards' ? '/dashboard?view=cards' : '/dashboard';
}

/** One site of the dashboard with what is known about its repository. */
export interface SiteRow {
  /** Unique across the table. */
  readonly key: string;
  /** The repository, or null for a site added by hand. */
  readonly repo: string | null;
  readonly site: SiteStatus;
  /** How many issues are open for the repository's checks. */
  readonly openIssues: number;
  /** Whether checks are turned off for the repository. */
  readonly paused: boolean;
}

/** What the table can be sorted by. */
export type SortKey = 'status' | 'site' | 'deployed' | 'checked' | 'issues';

/** Which way. */
export type SortDirection = 'ascending' | 'descending';

/** A sort: a column and a direction. */
export interface Sort {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

/** The order a table starts in: the sites that need attention first. */
export const DEFAULT_SORT: Sort = { key: 'status', direction: 'ascending' };

/** The rows of the overview, one for each site; those of a repository whose checks are paused are marked. */
export function rowsOf(
  repos: readonly RepoStatus[],
  paused: ReadonlySet<string>,
): SiteRow[] {
  return repos.flatMap((repo) => {
    const isPaused = repo.repo !== null && paused.has(repo.repo);
    return repo.sites.map((site) => ({
      key: `${repo.repo ?? 'by-hand'}/${site.id}`,
      repo: repo.repo,
      site,
      openIssues: repo.open_issues,
      paused: isPaused,
    }));
  });
}

/** The rows whose repository or host contains the text, ignoring case and spaces at its ends. */
export function filterRows(
  rows: readonly SiteRow[],
  query: string,
): readonly SiteRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return rows;
  }
  return rows.filter(
    (row) =>
      row.site.host.toLowerCase().includes(needle) ||
      (row.repo ?? '').toLowerCase().includes(needle),
  );
}

/** How a site's state ranks: 0 for the one that needs the most attention. */
function rank(row: SiteRow): number {
  return WORST_FIRST.indexOf(row.site.state);
}

/** The name a row is ordered by when the other column ties: its repository, then its host. */
function nameOf(row: SiteRow): string {
  return `${row.repo ?? '￿'}/${row.site.host}`;
}

/** Later times last; a site with no time counts as the oldest. */
function timeOf(value: string | null): number {
  return value === null ? 0 : Date.parse(value);
}

/** The rows in the order asked, with the same name order for ties so the table never shuffles. */
export function sortRows(
  rows: readonly SiteRow[],
  sort: Sort = DEFAULT_SORT,
): SiteRow[] {
  const sign = sort.direction === 'ascending' ? 1 : -1;
  const compare = (a: SiteRow, b: SiteRow): number => {
    switch (sort.key) {
      case 'status':
        return rank(a) - rank(b);
      case 'site':
        return nameOf(a).localeCompare(nameOf(b));
      case 'deployed':
        // Most recent first when ascending, as people read "latest".
        return timeOf(b.site.deployed_at) - timeOf(a.site.deployed_at);
      case 'checked':
        return timeOf(b.site.checked_at) - timeOf(a.site.checked_at);
      case 'issues':
        return b.openIssues - a.openIssues;
    }
  };
  return rows.toSorted(
    (a, b) => sign * compare(a, b) || nameOf(a).localeCompare(nameOf(b)),
  );
}

/** The sort after a column's heading is pressed: that column first, then the other way round. */
export function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key !== key) {
    return { key, direction: 'ascending' };
  }
  return {
    key,
    direction: current.direction === 'ascending' ? 'descending' : 'ascending',
  };
}

/** The address of a commit of a repository on GitHub. */
export function commitUrl(repo: string, sha: string): string {
  return `https://github.com/${repo}/commit/${encodeURIComponent(sha)}`;
}

/** The address of a repository's open issues made by Plumbline. */
export function issuesUrl(repo: string): string {
  return `https://github.com/${repo}/issues?q=${encodeURIComponent('is:issue is:open label:plumbline')}`;
}

/** The rows put back together as repositories, in the order their first row comes. */
export function groupRows(rows: readonly SiteRow[]): RepoStatus[] {
  const groups = new Map<
    string,
    { repo: string | null; sites: SiteStatus[]; openIssues: number }
  >();
  for (const row of rows) {
    const key = row.repo ?? '';
    const group = groups.get(key) ?? {
      repo: row.repo,
      sites: [],
      openIssues: row.openIssues,
    };
    group.sites.push(row.site);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    repo: group.repo,
    sites: group.sites,
    open_issues: group.openIssues,
  }));
}

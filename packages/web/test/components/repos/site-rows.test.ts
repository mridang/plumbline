import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_SORT,
  clusterRows,
  commitUrl,
  dashboardHref,
  filterRows,
  groupRows,
  issuesUrl,
  nextSort,
  rowsOf,
  sortRows,
  viewOf,
} from '@/components/repos/site-rows';
import type { RepoStatus, SiteState } from '@/domain/db/live';

const site = (
  host: string,
  state: SiteState,
  over: Partial<RepoStatus['sites'][number]> = {},
) => ({
  id: host,
  host,
  state,
  errors: 0,
  warnings: 0,
  hints: 0,
  checked_at: null,
  deployed_at: null,
  sha: null,
  mine: true,
  ...over,
});

const REPOS: RepoStatus[] = [
  {
    repo: 'acme/b',
    open_issues: 3,
    sites: [site('b.test', 'ok', { checked_at: '2026-01-02T00:00:00.000Z' })],
  },
  {
    repo: 'acme/a',
    open_issues: 0,
    sites: [
      site('a.test', 'failing', { deployed_at: '2026-01-03T00:00:00.000Z' }),
      site('www.a.test', 'warning'),
    ],
  },
  { repo: null, open_issues: 0, sites: [site('hand.test', 'unchecked')] },
];

describe('rowsOf', () => {
  it('makes one row for each site, with its repository and issues', () => {
    const rows = rowsOf(REPOS, new Set());
    expect(rows.map((r) => [r.repo, r.site.host, r.openIssues])).toEqual([
      ['acme/b', 'b.test', 3],
      ['acme/a', 'a.test', 0],
      ['acme/a', 'www.a.test', 0],
      [null, 'hand.test', 0],
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(4);
  });

  it('lists the sites of a repository whose checks are paused, marked', () => {
    const rows = rowsOf(REPOS, new Set(['acme/a']));
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.paused).map((r) => r.site.host)).toEqual([
      'a.test',
      'www.a.test',
    ]);
  });
});

describe('filterRows', () => {
  const rows = rowsOf(REPOS, new Set());

  it('keeps every row for an empty search', () => {
    expect(filterRows(rows, '   ')).toBe(rows);
  });

  it('matches the host or the repository, ignoring case', () => {
    expect(filterRows(rows, 'WWW').map((r) => r.site.host)).toEqual([
      'www.a.test',
    ]);
    expect(filterRows(rows, 'acme/a').map((r) => r.site.host)).toEqual([
      'a.test',
      'www.a.test',
    ]);
  });

  it('finds nothing for text that matches nothing', () => {
    expect(filterRows(rows, 'zzz')).toEqual([]);
  });
});

describe('sortRows', () => {
  const rows = rowsOf(REPOS, new Set());
  const hosts = (sorted: readonly { site: { host: string } }[]) =>
    sorted.map((r) => r.site.host);

  it('puts the sites that need attention first by default, then by name', () => {
    expect(hosts(sortRows(rows, DEFAULT_SORT))).toEqual([
      'a.test',
      'www.a.test',
      'hand.test',
      'b.test',
    ]);
  });

  it('turns the order round, keeping ties in name order', () => {
    expect(
      hosts(sortRows(rows, { key: 'status', direction: 'descending' })),
    ).toEqual(['b.test', 'hand.test', 'www.a.test', 'a.test']);
  });

  it('sorts by name with the sites added by hand last', () => {
    expect(
      hosts(sortRows(rows, { key: 'site', direction: 'ascending' })),
    ).toEqual(['a.test', 'www.a.test', 'b.test', 'hand.test']);
  });

  it('sorts the latest deployment and check first, and a site with none last', () => {
    expect(
      hosts(sortRows(rows, { key: 'deployed', direction: 'ascending' }))[0],
    ).toBe('a.test');
    expect(
      hosts(sortRows(rows, { key: 'checked', direction: 'ascending' }))[0],
    ).toBe('b.test');
  });

  it('sorts by open issues, most first', () => {
    expect(
      hosts(sortRows(rows, { key: 'issues', direction: 'ascending' }))[0],
    ).toBe('b.test');
  });

  it('does not change the rows it is given', () => {
    const before = hosts(rows);
    sortRows(rows, { key: 'site', direction: 'descending' });
    expect(hosts(rows)).toEqual(before);
  });
});

describe('nextSort', () => {
  it('starts a new column ascending and flips the one already in force', () => {
    expect(nextSort(DEFAULT_SORT, 'site')).toEqual({
      key: 'site',
      direction: 'ascending',
    });
    expect(nextSort(DEFAULT_SORT, 'status')).toEqual({
      key: 'status',
      direction: 'descending',
    });
    expect(
      nextSort({ key: 'status', direction: 'descending' }, 'status'),
    ).toEqual({ key: 'status', direction: 'ascending' });
  });
});

describe('addresses on GitHub', () => {
  it('links a commit and the open issues of a repository', () => {
    expect(commitUrl('acme/a', 'abc1234')).toBe(
      'https://github.com/acme/a/commit/abc1234',
    );
    expect(issuesUrl('acme/a')).toBe(
      'https://github.com/acme/a/issues?q=is%3Aissue%20is%3Aopen%20label%3Aplumbline',
    );
  });
});

describe('viewOf and dashboardHref', () => {
  it('shows the table unless the address asks for cards', () => {
    expect(viewOf(undefined)).toBe('table');
    expect(viewOf('cards')).toBe('cards');
    expect(viewOf('grid')).toBe('table');
  });

  it('builds the address of each view', () => {
    expect(dashboardHref('table')).toBe('/dashboard');
    expect(dashboardHref('cards')).toBe('/dashboard?view=cards');
  });
});

describe('groupRows', () => {
  it('puts the rows back into repositories in the order they come, with their issues', () => {
    const rows = sortRows(rowsOf(REPOS, new Set()));
    const groups = groupRows(rows);
    expect(groups.map((g) => [g.repo, g.sites.length, g.open_issues])).toEqual([
      ['acme/a', 2, 0],
      [null, 1, 0],
      ['acme/b', 1, 3],
    ]);
  });

  it('is empty for no rows', () => {
    expect(groupRows([])).toEqual([]);
  });
});

describe('clusterRows', () => {
  it('keeps the sites of a repository together, after the first one', () => {
    const rows = rowsOf(REPOS, new Set());
    const scattered = [rows[1]!, rows[0]!, rows[2]!, rows[3]!];
    expect(clusterRows(scattered).map((r) => r.site.host)).toEqual([
      'a.test',
      'www.a.test',
      'b.test',
      'hand.test',
    ]);
  });

  it('leaves sites added by hand where they are', () => {
    const hand = rowsOf(
      [
        { repo: null, open_issues: 0, sites: [site('x.test', 'ok')] },
        { repo: null, open_issues: 0, sites: [site('y.test', 'ok')] },
      ],
      new Set(),
    );
    expect(clusterRows(hand).map((r) => r.site.host)).toEqual([
      'x.test',
      'y.test',
    ]);
  });
});

import { describe, expect, it } from '@jest/globals';

import {
  CHIPS,
  NO_FILTER,
  applyFilter,
  availabilityOf,
  countsOf,
  filterOf,
  queryOf,
  resultOf,
  summaryOf,
  toggleStatus,
  togglePaused,
  worstResult,
  type Filter,
} from '@/components/repos/site-filter';
import { clusterRows, rowsOf, sortRows } from '@/components/repos/site-rows';
import type { RepoStatus, SiteState } from '@/domain/db/live';

const site = (host: string, state: SiteState) => ({
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
});

const REPOS: RepoStatus[] = [
  {
    repo: 'acme/a',
    open_issues: 0,
    sites: [site('a1.test', 'failing'), site('a2.test', 'ok')],
  },
  { repo: 'acme/b', open_issues: 0, sites: [site('b.test', 'warning')] },
  { repo: 'acme/c', open_issues: 0, sites: [site('c.test', 'unreachable')] },
  { repo: 'acme/d', open_issues: 0, sites: [site('d.test', 'running')] },
  { repo: null, open_issues: 0, sites: [site('hand.test', 'unchecked')] },
  // Paused: its failing site must not show up in any result count.
  { repo: 'acme/p', open_issues: 0, sites: [site('p.test', 'failing')] },
  { repo: 'acme/q', open_issues: 0, sites: [site('q.test', 'unreachable')] },
];
const ROWS = rowsOf(REPOS, new Set(['acme/p', 'acme/q']));

describe('resultOf and availabilityOf', () => {
  it('gives a site that does not answer no result', () => {
    expect(resultOf('unreachable')).toBeNull();
    expect(resultOf('failing')).toBe('failing');
  });

  it('keeps state apart from result: live, paused, unresponsive', () => {
    expect(availabilityOf('failing', false)).toBe('live');
    expect(availabilityOf('unreachable', false)).toBe('unresponsive');
    expect(availabilityOf('failing', true)).toBe('paused');
    expect(availabilityOf('unreachable', true)).toBe('paused');
  });
});

describe('countsOf', () => {
  const counts = countsOf(ROWS);

  it('counts paused sites only as paused, never in a result', () => {
    expect(counts.paused).toBe(2);
    expect(counts.failing).toBe(1);
    expect(counts.unresponsive).toBe(1);
    expect(counts.all).toBe(6);
  });

  it('counts every other result', () => {
    expect([
      counts.warning,
      counts.ok,
      counts.running,
      counts.unchecked,
    ]).toEqual([1, 1, 1, 1]);
  });

  it('gives every chip a number equal to the rows it shows', () => {
    for (const chip of CHIPS) {
      expect(
        applyFilter(ROWS, { status: chip.status, paused: false }),
      ).toHaveLength(counts[chip.status]);
    }
    expect(applyFilter(ROWS, NO_FILTER)).toHaveLength(counts.all);
  });

  it('is zero, not missing, for a result nothing has', () => {
    const none = countsOf([]);
    expect(CHIPS.map((chip) => none[chip.status])).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('has the same chips in the same order whatever the counts', () => {
    expect(CHIPS.map((chip) => chip.label)).toEqual([
      'Failing',
      'Warnings',
      'Passing',
      'Checking',
      'Unchecked',
      'Unresponsive',
    ]);
  });
});

describe('applyFilter', () => {
  it('hides paused sites by default', () => {
    expect(applyFilter(ROWS, NO_FILTER).some((row) => row.paused)).toBe(false);
  });

  it('lists paused sites when asked', () => {
    const shown = applyFilter(ROWS, { status: null, paused: true });
    expect(shown).toHaveLength(ROWS.length);
    expect(shown.filter((row) => row.paused)).toHaveLength(2);
  });

  it('composes: a status narrows the live sites and leaves paused ones out', () => {
    const shown = applyFilter(ROWS, { status: 'failing', paused: true });
    expect(shown.map((row) => row.site.host)).toEqual(['a1.test']);
  });

  it('shows a site that does not answer under unresponsive and not under any result', () => {
    expect(
      applyFilter(ROWS, { status: 'unresponsive', paused: false }).map(
        (row) => row.site.host,
      ),
    ).toEqual(['c.test']);
  });

  it('keeps a repository’s sites together and the sort when filtered', () => {
    const sorted = sortRows(applyFilter(ROWS, { status: null, paused: true }));
    const clustered = clusterRows(sorted);
    const repos = clustered.map((row) => row.repo);
    expect(repos.join()).toBe(
      [...new Set(repos)].flatMap((r) => repos.filter((x) => x === r)).join(),
    );
  });
});

describe('toggling', () => {
  it('sets a status, and clears it when pressed again', () => {
    const on = toggleStatus(NO_FILTER, 'failing');
    expect(on.status).toBe('failing');
    expect(toggleStatus(on, 'failing').status).toBeNull();
  });

  it('is single select: another status replaces the first', () => {
    expect(
      toggleStatus({ status: 'failing', paused: false }, 'ok').status,
    ).toBe('ok');
  });

  it('flips paused without touching the status', () => {
    const f: Filter = { status: 'ok', paused: false };
    expect(togglePaused(f)).toEqual({ status: 'ok', paused: true });
  });
});

describe('the address', () => {
  it('reads a status and the paused flag', () => {
    expect(filterOf({ status: 'warnings', paused: '1' })).toEqual({
      status: 'warning',
      paused: true,
    });
    expect(filterOf({ status: 'passing' }).status).toBe('ok');
  });

  it('treats anything unknown as no filter', () => {
    expect(filterOf({ status: 'nonsense', paused: 'yes' })).toEqual(NO_FILTER);
    expect(filterOf({})).toEqual(NO_FILTER);
  });

  it('builds a query that filterOf reads back, for every chip', () => {
    for (const chip of CHIPS) {
      const filter: Filter = { status: chip.status, paused: true };
      const params = new URLSearchParams(queryOf(filter));
      expect(
        filterOf({
          status: params.get('status') ?? undefined,
          paused: params.get('paused') ?? undefined,
        }),
      ).toEqual(filter);
    }
  });

  it('composes with the view and is empty with nothing set', () => {
    expect(queryOf(NO_FILTER)).toBe('');
    expect(queryOf(NO_FILTER, 'cards')).toBe('?view=cards');
    expect(queryOf({ status: 'ok', paused: false }, 'cards')).toBe(
      '?view=cards&status=passing',
    );
  });
});

describe('summaryOf', () => {
  it('names the paused sites when there are any', () => {
    expect(summaryOf({ ...countsOf(ROWS), all: 8, paused: 1 })).toBe(
      '9 sites · 1 paused',
    );
    expect(summaryOf(countsOf([]))).toBe('0 sites');
    expect(summaryOf(countsOf(rowsOf(REPOS.slice(1, 2), new Set())))).toBe(
      '1 site',
    );
  });
});

describe('worstResult', () => {
  it('picks the result that needs the most attention, ignoring sites that do not answer', () => {
    expect(worstResult(['ok', 'warning', 'failing'])).toBe('failing');
    expect(worstResult(['ok', 'unreachable'])).toBe('ok');
    expect(worstResult(['unreachable'])).toBeNull();
  });
});

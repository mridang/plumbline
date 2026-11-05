import { describe, expect, it } from '@jest/globals';

import { RunList, SiteRuns } from '@/components/runs/run-history';
import type { RunSummary } from '@/domain/db/runs';

import { htmlAt } from '../render';

const run = (extra: Partial<RunSummary>): RunSummary => ({
  id: 's1',
  kind: 'deployment',
  ran_at: '2026-11-01T10:00:00.000Z',
  sha: 'abcdef1234567890',
  passed: 200,
  warned: 3,
  failed: 2,
  skipped: 1,
  openable: true,
  ...extra,
});

const list = (runs: RunSummary[], shownId?: string) =>
  htmlAt(
    RunList({
      repo: 'acme/site',
      domainId: 'd1',
      host: 'site.example.com',
      runs,
      base: '/repos/acme/site',
      shownId,
    }),
    { pathname: '/repos/acme/site' },
  );

describe('RunList', () => {
  it('shows when, the short commit linked to GitHub, how the run started and how it ended', () => {
    const html = list([run({})]);
    expect(html).toContain('title="1 Nov 2026, 10:00 UTC"');
    expect(html).toContain('dateTime="2026-11-01T10:00:00.000Z"');
    expect(html).toContain('>abcdef1</a>');
    expect(html).toContain(
      'href="https://github.com/acme/site/commit/abcdef1234567890"',
    );
    expect(html).toContain('Deployment');
    expect(html).toContain('title="2 failed"');
    expect(html).toContain('title="3 warned"');
    expect(html).toContain('title="200 passed"');
  });

  it('says how long ago a run was, not only the date', () => {
    const html = list([
      run({ ran_at: new Date(Date.now() - 2 * 3600_000).toISOString() }),
    ]);
    expect(html).toContain('2 hours ago');
  });

  it('colours a count only when there is something to see', () => {
    const html = list([run({ failed: 0, warned: 0, passed: 5 })]);
    expect(html).toContain('text-subtle" title="0 failed"');
    expect(html).toContain('text-subtle" title="0 warned"');
    expect(html).toContain('font-semibold text-passed" title="5 passed"');
  });

  it('marks the report being shown, and offers the others to open', () => {
    const html = list([run({ id: 'a' }), run({ id: 'b' })], 'a');
    expect(html).toContain('Showing');
    expect(html).toContain('Open report');
    expect(html).toContain('aria-current="true"');
  });

  it.each([
    ['manual', 'Manual'],
    ['deployment', 'Deployment'],
    ['scheduled', 'Scheduled'],
    ['config', 'Config change'],
  ] as const)('names a %s run %s', (kind, label) => {
    expect(list([run({ kind })])).toContain(label);
  });

  it('links a run that kept its report to it, and not one that did not', () => {
    const html = list([
      run({ id: 'abc', openable: true }),
      run({ id: 's2', openable: false }),
    ]);
    expect(html).toContain('href="/repos/acme/site?report=abc#site-d1"');
    expect(html).not.toContain('report=s2');
  });

  it('shows a dash for an unknown commit and for a count an older run did not keep', () => {
    const html = list([run({ sha: null, passed: null, skipped: null })]);
    expect(html).not.toContain('github.com/acme/site/commit');
    expect(html).toContain('title="passed: not kept for this run"');
  });

  it('says so when a site has no runs yet', () => {
    expect(list([])).toContain(
      'No runs of site.example.com yet. Press Run checks',
    );
  });
});

describe('SiteRuns', () => {
  const site = { id: 'd1', host: 'site.example.com' };
  const draw = (runs: RunSummary[]) =>
    htmlAt(
      SiteRuns({ repo: 'acme/site', site, runs, base: '/repos/acme/site' }),
      { pathname: '/repos/acme/site' },
    );

  it('is headed Runs and explains what starts one', () => {
    const html = draw([run({ kind: 'scheduled' })]);
    expect(html).toContain('>Runs</h4>');
    expect(html).toContain('the daily');
    expect(html).toContain('Scheduled');
  });

  it('says so when the site has no runs yet', () => {
    expect(draw([])).toContain('No runs of site.example.com yet');
  });
});

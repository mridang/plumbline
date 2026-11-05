import { describe, expect, it } from '@jest/globals';

import { SiteView, sections } from '@/components/repos/site-view';
import { CHECKS } from '@/domain/checks/catalogue';
import type { Domain } from '@/domain/db/domains';
import type { Report } from '@/domain/db/reports';
import type { RunSummary } from '@/domain/db/runs';
import { htmlAt } from '../render';

const NOW = Date.parse('2026-01-02T00:00:00.000Z');

const DOMAIN = {
  id: 'd1',
  host: 'site.example.com',
  repo: 'acme/site',
  checks: null,
} as unknown as Domain;

const RUN: RunSummary = {
  id: 'r1',
  kind: 'manual',
  ran_at: '2026-01-01T22:00:00.000Z',
  sha: null,
  passed: 200,
  warned: 3,
  failed: 2,
  skipped: 1,
  openable: true,
};

const SHOWN = {
  id: 'r1',
  url: 'https://site.example.com/',
  passed: 1,
  warned: 0,
  failed: 1,
  skipped: 0,
  created_at: '2026-01-01T22:00:00.000Z',
  outcomes: [
    {
      id: 'csp',
      status: 'failed',
      findings: [
        {
          resource: 'https://site.example.com/',
          message: 'No CSP',
          level: 'error',
        },
      ],
    },
    { id: 'hsts', status: 'passed', findings: [] },
  ],
} as unknown as Report;

const draw = (over: Partial<Parameters<typeof SiteView>[0]> = {}): string =>
  htmlAt(
    <SiteView
      domain={DOMAIN}
      status={{
        id: 'd1',
        host: 'site.example.com',
        state: 'failing',
        errors: 2,
        warnings: 1,
        hints: 0,
        checked_at: '2026-01-01T23:00:00.000Z',
        deployed_at: '2026-01-01T00:00:00.000Z',
        sha: 'abcdef1234567890',
        mine: true,
      }}
      runs={[RUN]}
      issues={[]}
      shown={SHOWN}
      view="results"
      hrefFor={(id) => `/r?site=site.example.com&report=${id}`}
      settingsHref="/r?site=site.example.com&view=settings"
      resultsHref="/r?site=site.example.com"
      lastRunAt={undefined}
      now={NOW}
      {...over}
    />,
    { pathname: '/repos/acme/site' },
  );

describe('sections', () => {
  it('groups every check by report section', () => {
    const grouped = sections();
    expect(grouped.flatMap((section) => section.checks)).toHaveLength(
      CHECKS.length,
    );
    expect(grouped.length).toBeGreaterThan(1);
  });
});

describe('SiteView', () => {
  it('names the site first, as a link out, with its state, when it was checked and the commit', () => {
    const out = draw();
    expect(out).toContain('href="https://site.example.com"');
    expect(out).toContain('Failing');
    expect(out).toContain('Checked');
    expect(out).toContain('1 hour ago');
    expect(out).toContain('>abcdef1<');
  });

  it('puts Run checks on the right, with the choice of checks beside it', () => {
    const out = draw();
    expect(out).toMatch(/Run \d+ checks/);
    expect(out).toContain('Choose checks (');
    expect(out).toContain('href="/r?site=site.example.com&amp;view=settings"');
    expect(out.indexOf('Choose checks')).toBeLessThan(out.indexOf('Run '));
  });

  it('orders the tab: who it is, the totals, the choice of report, then the checks', () => {
    const out = draw();
    const order = [
      'site.example.com',
      'Failed',
      'aria-label="Choose a report of site.example.com"',
      'aria-label="Show"',
      'No CSP',
    ].map((text) => out.indexOf(text));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('keeps the whole history closed under the choice of report', () => {
    const out = draw();
    expect(out).toContain('Full history');
    // The history's disclosure has no `open`; only the failed check below it does.
    expect(out).toMatch(
      /<details class="group rounded-card border border-line bg-surface"><summary/,
    );
  });

  it('shows the choice of checks in place of the results for the settings view', () => {
    const out = draw({ view: 'settings' });
    expect(out).toContain('Checks that run for site.example.com');
    expect(out).toContain('Back to results');
    expect(out).toContain('href="/r?site=site.example.com"');
    expect(out).not.toContain('aria-label="Show"');
    expect(out).toContain('id="check-csp"');
  });

  it('says there is no report yet, and still offers to run', () => {
    const out = draw({ shown: undefined, runs: [] });
    expect(out).toContain('No report yet');
    expect(out).toMatch(/Run \d+ checks/);
  });

  it('draws the totals of the report shown, in the colours of the results', () => {
    const out = draw();
    expect(out).toContain('text-failed');
    expect(out).toContain('Skipped');
  });
});

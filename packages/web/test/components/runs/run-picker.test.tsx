import { describe, expect, it } from '@jest/globals';

import { RunPicker } from '@/components/runs/run-picker';
import type { RunSummary } from '@/domain/db/runs';

import { htmlAt } from '../render';

const NOW = Date.parse('2026-11-01T12:00:00.000Z');

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

const draw = (runs: RunSummary[], shownId?: string) =>
  htmlAt(
    <RunPicker
      repo="acme/site"
      host="site.example.com"
      runs={runs}
      shownId={shownId}
      hrefFor={(id) => `/r?report=${id}`}
      now={NOW}
    />,
    { pathname: '/repos/acme/site' },
  );

describe('RunPicker', () => {
  it('says which report is shown in one line: latest, when, how it started', () => {
    const out = draw([run({ id: 'a', kind: 'manual' }), run({ id: 'b' })], 'a');
    expect(out).toContain('Latest');
    expect(out).toContain('2 hours ago');
    expect(out).toContain('Manual');
    expect(out).toContain('aria-label="Choose a report of site.example.com"');
  });

  it('says earlier when the report shown is not the newest', () => {
    const out = draw([run({ id: 'a' }), run({ id: 'b' })], 'b');
    expect(out).toContain('Earlier');
    expect(out).not.toContain('>Latest<');
  });

  it('keeps the whole history in a closed disclosure, not on the page', () => {
    const out = draw([run({ id: 'a' }), run({ id: 'b' })], 'a');
    expect(out).toContain('Full history');
    expect(out).toContain('2 runs');
    expect(out).not.toMatch(/<details[^>]*\sopen/);
    expect(out).toContain('Runs of site.example.com, newest first');
  });

  it('does not list the runs until the menu is opened', () => {
    const out = draw([run({ id: 'a' })], 'a');
    expect(out).toContain('aria-expanded="false"');
    expect(out).not.toContain('max-h-96');
  });

  it('draws nothing for a site with no runs', () => {
    expect(draw([])).toBe('');
  });

  it('copes with runs that kept no report', () => {
    const out = draw([run({ id: 'a', openable: false })]);
    expect(out).toContain('No run kept a report yet.');
  });
});

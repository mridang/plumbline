import { describe, expect, it } from '@jest/globals';

import {
  progressLine,
  ScanResults,
  type Scan,
} from '@/components/scan/scan-results';
import type { HintOutcome } from '@/domain/scan/outcome';
import { html } from '../render';

/** A check with the given outcome. */
const hint = (
  id: string,
  status: HintOutcome['status'],
  extra: Partial<HintOutcome> = {},
): HintOutcome => ({
  id,
  name: `Check ${id}`,
  description: `About ${id}`,
  section: 'security',
  sectionTitle: 'Security',
  sectionOrder: 1,
  groups: [],
  origins: [],
  status,
  findings: [],
  ...extra,
});

/** A scan of example.com with these checks done. */
const scanOf = (
  hints: readonly HintOutcome[],
  extra: Partial<Scan> = {},
): Scan => ({
  finalUrl: 'https://example.com/',
  status: 200,
  total: hints.length,
  hints,
  startedAt: 1_000,
  finishedAt: 3_500,
  ...extra,
});

describe('progressLine', () => {
  it('counts the checks done while a scan runs', () => {
    expect(
      progressLine(
        scanOf([hint('a', 'passed')], { total: 5, finishedAt: undefined }),
      ),
    ).toBe('HTTP 200 · 1 of 5 checks done…');
  });

  it('says how long a finished scan took', () => {
    expect(progressLine(scanOf([hint('a', 'passed')]))).toBe(
      'HTTP 200 · 1 check in 2.5 s',
    );
  });

  it('leaves out the status when it is not known', () => {
    expect(
      progressLine(scanOf([hint('a', 'passed')], { status: undefined })),
    ).toBe('1 check in 2.5 s');
  });

  it('dates a saved report in UTC, to the minute', () => {
    expect(
      progressLine(
        scanOf([hint('a', 'passed')], { savedAt: '2026-10-01T08:15:42.000Z' }),
      ),
    ).toBe('1 check · scanned 2026-10-01 08:15 UTC');
  });
});

describe('ScanResults', () => {
  it('heads the results with the address scanned', () => {
    expect(html(<ScanResults scan={scanOf([])} />)).toContain(
      'Results for <a href="https://example.com/"',
    );
  });

  it('shows a progress bar while checks are still running', () => {
    expect(
      html(
        <ScanResults
          scan={scanOf([hint('a', 'passed')], {
            total: 3,
            finishedAt: undefined,
          })}
        />,
      ),
    ).toMatch(/<progress[^>]*max="3" value="1"/);
  });

  it('shows no progress bar once every check has run', () => {
    expect(html(<ScanResults scan={scanOf([])} />)).not.toContain('<progress');
  });

  it('opens on the problems when there are any', () => {
    const out = html(
      <ScanResults scan={scanOf([hint('a', 'failed'), hint('b', 'passed')])} />,
    );
    expect(out).toMatch(/aria-pressed="true"[^>]*>Problems/);
  });

  it('lists only the problems at first', () => {
    const out = html(
      <ScanResults scan={scanOf([hint('a', 'failed'), hint('b', 'passed')])} />,
    );
    expect(out).not.toContain('Check b');
  });

  it('opens on every check when nothing is wrong', () => {
    const out = html(<ScanResults scan={scanOf([hint('b', 'passed')])} />);
    expect(out).toMatch(/aria-pressed="true"[^>]*>All/);
  });

  it('says there is nothing to show for a scan with no checks', () => {
    expect(html(<ScanResults scan={scanOf([])} />)).toContain(
      'Nothing to show here.',
    );
  });

  it('counts the findings of a check', () => {
    const out = html(
      <ScanResults
        scan={scanOf([
          hint('a', 'failed', {
            findings: [
              {
                resource: 'https://example.com/',
                message: 'm1',
                level: 'error',
              },
              {
                resource: 'https://example.com/',
                message: 'm2',
                level: 'error',
              },
            ],
          }),
        ])}
      />,
    );
    expect(out).toContain('2 findings');
  });
});

describe('ScanResults, opening and closing the checks', () => {
  const OPEN = /<details[^>]* open=""/g;
  const opened = (out: string) => (out.match(OPEN) ?? []).length;

  it('starts the checks that failed open, and the warnings, passes and skips closed', () => {
    const out = html(
      <ScanResults
        scan={scanOf([
          hint('a', 'failed'),
          hint('b', 'warned'),
          hint('c', 'passed'),
          hint('d', 'skipped'),
        ])}
      />,
    );
    // The filter starts on the problems, so the pass and the skip are not drawn yet.
    expect(opened(out)).toBe(1);
    expect(out).toContain('Check b');
  });

  it('keeps them closed under the other filters too', () => {
    const out = html(
      <ScanResults
        scan={scanOf([hint('c', 'passed'), hint('d', 'skipped')])}
      />,
    );
    expect(opened(out)).toBe(0);
    expect(out).toContain('Check c');
    expect(out).toContain('Check d');
  });

  it('offers Expand all while some check is closed, and says what it controls', () => {
    const out = html(
      <ScanResults scan={scanOf([hint('a', 'failed'), hint('b', 'warned')])} />,
    );
    expect(out).toMatch(
      /<button[^>]*aria-controls="check-list"[^>]*>Expand all</,
    );
    expect(out).toContain('id="check-list"');
  });

  it('offers Collapse all when every check shown is open', () => {
    const out = html(<ScanResults scan={scanOf([hint('a', 'failed')])} />);
    expect(out).toContain('>Collapse all<');
  });

  it('offers neither when there is nothing to show', () => {
    const out = html(<ScanResults scan={scanOf([])} />);
    expect(out).not.toContain('Collapse all');
    expect(out).not.toContain('Expand all');
  });

  it('lists the issues that report a check, for a site of a repository', () => {
    const out = html(
      <ScanResults
        scan={scanOf([hint('a', 'failed')])}
        repository="acme/site"
        issuesByCheck={{
          a: [
            {
              number: 7,
              state: 'open',
              opened_at: '2026-01-01T00:00:00.000Z',
              checks: ['a'],
            },
          ],
        }}
      />,
    );
    expect(out).toContain('href="https://github.com/acme/site/issues/7"');
  });

  it('shows no issues on a scan with no repository', () => {
    const out = html(<ScanResults scan={scanOf([hint('a', 'failed')])} />);
    expect(out).not.toContain('GitHub issues');
  });
});

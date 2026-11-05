import { describe, expect, it } from '@jest/globals';

import { checksOf, skippedOf } from '@/domain/suite/checks';
import type { ScanOutcome } from '@/domain/suite/scanner';

const outcome = (
  id: string,
  status: ScanOutcome['status'],
  findings: ScanOutcome['findings'] = [],
): ScanOutcome => ({ id, status, findings });

describe('checksOf', () => {
  it('turns the outcome of each check that ran into a result named by the check', () => {
    expect(
      checksOf([
        outcome('seo-viewport', 'failed', [
          { level: 'error', message: 'No viewport.' },
        ]),
        outcome('seo-links', 'passed'),
        outcome('seo-http-status', 'warned', [
          { level: 'warning', message: 'Slow.' },
        ]),
      ]),
    ).toEqual([
      {
        id: 'seo-viewport',
        findings: [{ severity: 'error', message: 'No viewport.' }],
      },
      { id: 'seo-links', findings: [] },
      {
        id: 'seo-http-status',
        findings: [{ severity: 'warning', message: 'Slow.' }],
      },
    ]);
  });

  it('reads an informational note as a hint', () => {
    expect(
      checksOf([
        outcome('hsts', 'passed', [{ level: 'information', message: 'Note.' }]),
      ])[0]?.findings,
    ).toEqual([{ severity: 'hint', message: 'Note.' }]);
  });

  it('leaves out a check that was skipped: it found nothing and says nothing about the site', () => {
    expect(
      checksOf([
        outcome('agent-webmcp', 'skipped'),
        outcome('seo-links', 'passed'),
      ]).map((check) => check.id),
    ).toEqual(['seo-links']);
  });
});

describe('skippedOf', () => {
  it('lists the checks that could not run', () => {
    expect(
      skippedOf([
        outcome('agent-webmcp', 'skipped'),
        outcome('seo-links', 'passed'),
        outcome('mail-ns-rpki-valid', 'skipped'),
      ]),
    ).toEqual(['agent-webmcp', 'mail-ns-rpki-valid']);
  });
});

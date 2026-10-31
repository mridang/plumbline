import { describe, expect, it } from '@jest/globals';

import {
  isRunning,
  Scanner,
  ScanStatus,
  type ScanState,
} from '@/components/scan/scanner';
import type { Scan } from '@/components/scan/scan-results';
import { html } from '../render';

/** A scan of one page, under way unless `finishedAt` is given. */
const scan = (finishedAt?: number): Scan => ({
  finalUrl: 'https://example.com/',
  status: 200,
  total: 2,
  hints: [],
  startedAt: 0,
  ...(finishedAt === undefined ? {} : { finishedAt }),
});

describe('Scanner', () => {
  it('starts with a labelled box for the domain and a scan button', () => {
    const out = html(<Scanner />);
    expect(out).toContain('role="search"');
    expect(out).toContain('<label for="domain"');
    expect(out).toContain('placeholder="example.com"');
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*>Scan<\/button>/);
  });

  it('shows no results before a scan', () => {
    expect(html(<Scanner />)).not.toContain('Results for');
  });
});

describe('isRunning', () => {
  it.each<[string, ScanState, boolean]>([
    ['idle', { kind: 'idle' }, false],
    ['starting', { kind: 'starting', domain: 'example.com' }, true],
    ['scanning with checks left', { kind: 'scanning', scan: scan() }, true],
    ['scanning and finished', { kind: 'scanning', scan: scan(5) }, false],
    ['refused', { kind: 'error', message: 'no' }, false],
  ])('is %s → %s', (_, state, expected) => {
    expect(isRunning(state)).toBe(expected);
  });
});

describe('ScanStatus', () => {
  it('says nothing while idle', () => {
    expect(html(<ScanStatus state={{ kind: 'idle' }} />)).toBe(
      '<div aria-live="polite" class="mt-8"></div>',
    );
  });

  it('names the domain being fetched while a scan starts', () => {
    expect(
      html(<ScanStatus state={{ kind: 'starting', domain: 'example.com' }} />),
    ).toContain(
      'Fetching <span class="font-semibold text-ink">example.com</span>…',
    );
  });

  it('says why a scan could not run, as an alert', () => {
    expect(
      html(<ScanStatus state={{ kind: 'error', message: 'Too many scans' }} />),
    ).toMatch(/<p role="alert"[^>]*>Too many scans<\/p>/);
  });
});

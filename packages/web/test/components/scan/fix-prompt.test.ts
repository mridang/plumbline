import { describe, expect, it } from '@jest/globals';

import {
  fixPrompt,
  hasProblems,
  MAX_FINDINGS,
  MAX_SNIPPET,
} from '@/components/scan/fix-prompt';
import type { Finding, HintOutcome } from '@/domain/scan/engine';

/** A finding with the given message. */
const finding = (message: string, extra: Partial<Finding> = {}): Finding => ({
  resource: 'https://example.com/',
  message,
  level: 'error',
  ...extra,
});

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
  sectionTitle: 'Site protection',
  sectionOrder: 1,
  groups: [],
  origins: [],
  status,
  findings: [],
  ...extra,
});

const scan = (...hints: HintOutcome[]) => ({
  finalUrl: 'https://example.com/',
  hints,
});

describe('hasProblems', () => {
  it('is true for a failed or warned check and false otherwise', () => {
    expect(hasProblems([hint('a', 'failed')])).toBe(true);
    expect(hasProblems([hint('a', 'warned')])).toBe(true);
    expect(hasProblems([hint('a', 'passed'), hint('b', 'skipped')])).toBe(
      false,
    );
    expect(hasProblems([])).toBe(false);
  });
});

describe('fixPrompt', () => {
  it('is empty when nothing failed or warned', () => {
    expect(fixPrompt(scan(hint('a', 'passed')))).toBe('');
  });

  it('names the site, the problems and the instruction to fix them', () => {
    const prompt = fixPrompt(
      scan(hint('a', 'failed', { findings: [finding('No HSTS header')] })),
    );
    expect(prompt).toContain(
      '# Fix the problems Plumbline found on https://example.com/',
    );
    expect(prompt).toContain('found 1 checks that need attention');
    expect(prompt).toContain('## Site protection');
    expect(prompt).toContain('### 1. Check a (failed)');
    expect(prompt).toContain('- No HSTS header (https://example.com/)');
    expect(prompt.trimEnd().endsWith('Fix it.')).toBe(true);
  });

  it('names the repository when it is known', () => {
    const prompt = fixPrompt(scan(hint('a', 'failed')), 'mridang/site');
    expect(prompt).toContain('the project in this repository (mridang/site)');
  });

  it('leaves passed and skipped checks out, and counts the skipped ones', () => {
    const prompt = fixPrompt(
      scan(hint('a', 'failed'), hint('b', 'passed'), hint('c', 'skipped')),
    );
    expect(prompt).not.toContain('Check b');
    expect(prompt).not.toContain('Check c');
    expect(prompt).toContain('1 further checks');
  });

  it('puts failed checks before warnings inside a section and numbers them in order', () => {
    const prompt = fixPrompt(scan(hint('w', 'warned'), hint('f', 'failed')));
    expect(prompt.indexOf('1. Check f (failed)')).toBeGreaterThan(-1);
    expect(prompt.indexOf('1. Check f (failed)')).toBeLessThan(
      prompt.indexOf('2. Check w (warning)'),
    );
  });

  it('groups by section in the report order', () => {
    const prompt = fixPrompt(
      scan(
        hint('b', 'failed', {
          section: 'two',
          sectionTitle: 'Second',
          sectionOrder: 2,
        }),
        hint('a', 'failed', {
          section: 'one',
          sectionTitle: 'First',
          sectionOrder: 1,
        }),
      ),
    );
    expect(prompt.indexOf('## First')).toBeLessThan(
      prompt.indexOf('## Second'),
    );
  });

  it('writes the snippet fenced in its language, the line and the reference', () => {
    const prompt = fixPrompt(
      scan(
        hint('a', 'failed', {
          reference: 'https://example.org/rule',
          findings: [
            finding('Bad header', {
              snippet: 'X-Frame-Options: ALLOW',
              language: 'http',
              line: 3,
              column: 1,
            }),
          ],
        }),
      ),
    );
    expect(prompt).toContain('(https://example.com/:3:1)');
    expect(prompt).toContain('  ```http\n  X-Frame-Options: ALLOW\n  ```');
    expect(prompt).toContain('Reference: https://example.org/rule');
  });

  it('shortens a long snippet and counts the findings it leaves out', () => {
    const findings = Array.from({ length: MAX_FINDINGS + 2 }, (_, i) =>
      finding(`Problem ${i}`),
    );
    const prompt = fixPrompt(
      scan(
        hint('a', 'failed', {
          findings: [
            ...findings,
            finding('Long', { snippet: 'x'.repeat(MAX_SNIPPET + 50) }),
          ],
        }),
      ),
    );
    expect(prompt).toContain('…and 3 more of the same kind.');
    expect(prompt).not.toContain('Problem 8');

    const long = fixPrompt(
      scan(
        hint('a', 'failed', {
          findings: [
            finding('Long', { snippet: 'x'.repeat(MAX_SNIPPET + 50) }),
          ],
        }),
      ),
    );
    expect(long).toContain(`${'x'.repeat(MAX_SNIPPET)}…`);
    expect(long).not.toContain('x'.repeat(MAX_SNIPPET + 1));
  });
});

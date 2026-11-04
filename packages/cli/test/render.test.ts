import { describe, expect, it } from '@jest/globals';
import {
  formatChecks,
  formatFindings,
  summaryLine,
  toJsonChecks,
  toJsonFindings,
} from '../src/render.js';
import type { Finding, Report } from '../src/report.js';
import type { HintMeta } from '../src/scan.js';

const URL = 'https://example.com/';

const HINTS: HintMeta[] = [
  {
    id: 'csp',
    name: 'Content Security Policy',
    description: 'Checks the CSP header.',
    category: 'security',
    groups: ['owasp', 'security-headers'],
  },
  {
    id: 'og-title',
    name: 'og-title',
    description: '',
    category: 'social',
    groups: [],
  },
];

function finding(over: Partial<Finding>): Finding {
  return {
    hintId: 'extra/csp',
    category: 'security',
    groups: [],
    severity: 'error',
    message: 'a message',
    resource: URL,
    ...over,
  };
}

function report(findings: Finding[]): Report {
  const count = (s: string) => findings.filter((f) => f.severity === s).length;
  return {
    url: URL,
    scannedAt: '2026-10-31T00:00:00.000Z',
    scannerVersion: '1.0.0',
    summary: {
      error: count('error'),
      warning: count('warning'),
      hint: count('hint'),
      information: count('information'),
      total: findings.length,
    },
    findings,
  };
}

describe('toJsonFindings', () => {
  it('uses bare ids and leaves out a missing snippet', () => {
    expect(toJsonFindings(report([finding({})]))).toEqual([
      { hint: 'csp', severity: 'error', message: 'a message', resource: URL },
    ]);
  });

  it('carries a code snippet', () => {
    const [entry] = toJsonFindings(
      report([finding({ codeSnippet: 'Content-Security-Policy: x' })]),
    );
    expect(entry.codeSnippet).toBe('Content-Security-Policy: x');
  });

  it('puts the most serious findings first', () => {
    const list = toJsonFindings(
      report([
        finding({ severity: 'hint', hintId: 'extra/a' }),
        finding({ severity: 'error', hintId: 'extra/b' }),
        finding({ severity: 'warning', hintId: 'extra/c' }),
      ]),
    );
    expect(list.map((f) => f.severity)).toEqual(['error', 'warning', 'hint']);
  });
});

describe('summaryLine', () => {
  it('says when there are no findings', () => {
    expect(summaryLine(report([]), 1)).toBe(
      `No findings from 1 check on ${URL}`,
    );
  });

  it('counts each severity', () => {
    expect(
      summaryLine(report([finding({}), finding({ severity: 'warning' })]), 2),
    ).toBe(
      `2 findings from 2 checks on ${URL}: 1 error, 1 warning, 0 hints, 0 information`,
    );
  });
});

describe('formatFindings', () => {
  it('groups findings under their hint, worst hint first', () => {
    const text = formatFindings(
      report([
        finding({
          hintId: 'extra/og-title',
          severity: 'warning',
          message: 'no title',
        }),
        finding({ message: 'no CSP' }),
      ]),
      HINTS,
    );
    expect(text.indexOf('csp (Content Security Policy)')).toBeLessThan(
      text.indexOf('og-title'),
    );
    expect(text).toContain('  error       no CSP');
    expect(text).toContain('  warning     no title');
  });

  it('shows a hint whose name is its id once', () => {
    const text = formatFindings(
      report([finding({ hintId: 'extra/og-title' })]),
      HINTS,
    );
    expect(text.startsWith('og-title\n')).toBe(true);
  });

  it('names a resource other than the page', () => {
    const text = formatFindings(
      report([finding({ resource: 'https://example.com/robots.txt' })]),
      HINTS,
    );
    expect(text).toContain('at https://example.com/robots.txt');
  });

  it('leaves out the resource when it is the page', () => {
    expect(formatFindings(report([finding({})]), HINTS)).not.toContain(' at ');
  });

  it('indents every line of a snippet', () => {
    const text = formatFindings(
      report([finding({ codeSnippet: 'TLS 1.1\nTLS 1.0' })]),
      HINTS,
    );
    expect(text).toContain('| TLS 1.1\n');
    expect(text).toContain('| TLS 1.0\n');
  });

  it('ends with the summary line', () => {
    expect(formatFindings(report([]), HINTS)).toBe(
      `No findings from 2 checks on ${URL}\n`,
    );
  });
});

describe('formatChecks', () => {
  it('lists each check with its groups and description', () => {
    const text = formatChecks(HINTS);
    expect(text).toContain(
      'csp  Content Security Policy\n  groups: owasp, security-headers\n  Checks the CSP header.',
    );
    expect(text).toContain('og-title  og-title\n  groups: (none)\n\n');
    expect(text.endsWith('2 checks\n')).toBe(true);
  });
});

describe('toJsonChecks', () => {
  it('keeps the id, name, groups and description', () => {
    expect(toJsonChecks(HINTS.slice(0, 1))).toEqual([
      {
        id: 'csp',
        name: 'Content Security Policy',
        groups: ['owasp', 'security-headers'],
        description: 'Checks the CSP header.',
      },
    ]);
  });
});

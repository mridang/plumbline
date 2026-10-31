import { describe, expect, it } from '@jest/globals';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Severity, type Problem } from '@hint/utils-types';
import { buildReport, saveReport } from '../src/report.js';
import type { HintMeta, ScanResult } from '../src/scan.js';

const HINT: HintMeta = {
  id: 'csp-present',
  name: 'CSP present',
  description: 'The response sets a Content-Security-Policy.',
  category: 'security',
  groups: ['owasp', 'security-headers'],
};

/** Builds a Problem with sane defaults, overriding only what a test cares. */
function problem(over: Partial<Problem> = {}): Problem {
  return {
    location: { line: -1, column: -1 },
    message: 'a message',
    sourceCode: '',
    resource: 'https://example.com/',
    hintId: 'extra/csp-present',
    category: 'security' as unknown as Problem['category'],
    severity: Severity.error,
    ...over,
  };
}

function resultOf(problems: Problem[]): ScanResult {
  return { problems, hints: [HINT] };
}

describe('buildReport', () => {
  it('summarises findings by severity', () => {
    const report = buildReport(
      'https://example.com/',
      resultOf([
        problem({ severity: Severity.error }),
        problem({ severity: Severity.warning }),
        problem({ severity: Severity.warning }),
        problem({ severity: Severity.hint }),
        problem({ severity: Severity.information }),
      ]),
    );
    expect(report.summary).toEqual({
      error: 1,
      warning: 2,
      hint: 1,
      information: 1,
      total: 5,
    });
  });

  it('maps severity numbers to names', () => {
    const [finding] = buildReport(
      'https://example.com/',
      resultOf([problem({ severity: Severity.warning })]),
    ).findings;
    expect(finding.severity).toBe('warning');
  });

  it('carries the hint category and groups onto the finding', () => {
    const [finding] = buildReport(
      'https://example.com/',
      resultOf([problem()]),
    ).findings;
    expect(finding.category).toBe('security');
    expect(finding.groups).toEqual(['owasp', 'security-headers']);
  });

  it('defaults category and groups for an unknown hint', () => {
    const [finding] = buildReport(
      'https://example.com/',
      resultOf([problem({ hintId: 'extra/unknown' })]),
    ).findings;
    expect(finding.category).toBe('other');
    expect(finding.groups).toEqual([]);
  });

  it('keeps a real location and drops a synthetic one', () => {
    const report = buildReport(
      'https://example.com/',
      resultOf([
        problem({ location: { line: 12, column: 3 } }),
        problem({ location: { line: -1, column: -1 } }),
      ]),
    );
    expect(report.findings[0].location).toEqual({ line: 12, column: 3 });
    expect(report.findings[1].location).toBeUndefined();
  });

  it('passes documentation and a code snippet through', () => {
    const [finding] = buildReport(
      'https://example.com/',
      resultOf([
        problem({
          sourceCode: 'Content-Security-Policy: default-src',
          documentation: [{ link: 'https://mdn', text: 'MDN' }],
        }),
      ]),
    ).findings;
    expect(finding.codeSnippet).toBe('Content-Security-Policy: default-src');
    expect(finding.documentation).toEqual([
      { link: 'https://mdn', text: 'MDN' },
    ]);
  });

  it('stamps the scanner version it is given', () => {
    const report = buildReport('https://example.com/', resultOf([]), '1.2.3');
    expect(report.scannerVersion).toBe('1.2.3');
  });

  it('stamps dev when no version is given', () => {
    const report = buildReport('https://example.com/', resultOf([]));
    expect(report.scannerVersion).toBe('dev');
  });
});

describe('saveReport', () => {
  it('writes a .json and a matching .html side by side', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'plumbline-report-'));
    try {
      const result = resultOf([problem()]);
      const report = buildReport('https://example.com/', result);
      const saved = await saveReport(
        'https://example.com/',
        report,
        result,
        dir,
      );
      expect(path.dirname(saved.json)).toBe(dir);
      expect(path.basename(saved.json)).toBe(
        path.basename(saved.html, '.html') + '.json',
      );
      const written = JSON.parse(await readFile(saved.json, 'utf8'));
      expect(written.summary.total).toBe(1);
      const html = await readFile(saved.html, 'utf8');
      expect(html).toContain('<html');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

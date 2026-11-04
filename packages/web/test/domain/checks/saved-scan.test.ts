import { describe, expect, it } from '@jest/globals';

import type { ReportResource } from '@/domain/api/report-resource';
import { CHECKS, findCheck } from '@/domain/checks/catalogue';
import { savedScan } from '@/domain/checks/saved-scan';

const REPORT: ReportResource = {
  id: 'r1',
  domain_id: 'd1',
  url: 'https://example.com/',
  created_at: '2026-10-01T08:15:42.000Z',
  passed: 1,
  warned: 0,
  failed: 1,
  skipped: 0,
  outcomes: [
    {
      id: 'csp',
      name: 'Content Security Policy',
      status: 'failed',
      findings: [
        { resource: 'https://example.com/', message: 'No CSP', level: 'error' },
      ],
    },
    {
      id: 'gone-check',
      name: 'gone-check',
      status: 'skipped',
      reason: 'Needs a server',
      findings: [],
    },
  ],
};

describe('savedScan', () => {
  const scan = savedScan(REPORT);

  it('ends at the address the report was made for', () => {
    expect(scan.finalUrl).toBe('https://example.com/');
  });

  it('counts every saved outcome', () => {
    expect(scan.total).toBe(2);
  });

  it('is dated when the report was made', () => {
    expect(scan.savedAt).toBe('2026-10-01T08:15:42.000Z');
  });

  it('starts and finishes when the report was made', () => {
    expect([scan.startedAt, scan.finishedAt]).toEqual([
      Date.parse(REPORT.created_at),
      Date.parse(REPORT.created_at),
    ]);
  });

  it('describes a known check from the list of checks', () => {
    const check = findCheck('csp');
    expect(scan.hints[0]).toEqual({
      id: 'csp',
      name: check?.name,
      description: check?.description,
      reference: check?.reference,
      section: check?.section,
      sectionTitle: check?.section_title,
      sectionOrder: check?.section_order,
      groups: check?.groups,
      fixer: check?.fixer,
      origins: expect.any(Array),
      status: 'failed',
      findings: REPORT.outcomes[0]?.findings,
    });
  });

  it('carries where a check came from, with its docs in the page’s spelling', () => {
    const check = CHECKS.find((c) => c.origins.some((o) => o.docs_url));
    const origin = check?.origins.find((o) => o.docs_url);
    const shown = savedScan({
      ...REPORT,
      outcomes: [
        { id: check?.id ?? '', name: '', status: 'passed', findings: [] },
      ],
    }).hints[0];
    expect(shown?.origins).toContainEqual({
      source: origin?.source,
      title: origin?.title,
      url: origin?.url,
      docsUrl: origin?.docs_url,
      summary: origin?.summary,
    });
  });

  it('shows a check that has since been removed under its id, last', () => {
    expect(scan.hints[1]).toEqual({
      id: 'gone-check',
      name: 'gone-check',
      description: '',
      section: 'other',
      sectionTitle: 'Other',
      sectionOrder: Number.MAX_SAFE_INTEGER,
      groups: [],
      origins: [],
      status: 'skipped',
      reason: 'Needs a server',
      findings: [],
    });
  });
});

import { describe, expect, it } from '@jest/globals';

import { findCheck } from '@/domain/checks/catalogue';

import type { Domain } from '@/domain/db/domains';
import type { Report, ReportSummary } from '@/domain/db/reports';
import {
  DOMAINS_LINK,
  checkName,
  domainLink,
  domainListResult,
  errorResult,
  reportData,
  reportResult,
  reportText,
  tallyLine,
  textResult,
} from '@/domain/mcp/tool-results';
import type { DomainListData } from '@/domain/mcp/ui-types';

const DOMAIN: Domain = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: 1,
  host: 'example.com',
  checks: null,
  repo: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};

/** A stored finding at the error level. */
function finding(message: string, snippet?: string) {
  return {
    message,
    resource: 'https://example.com/',
    level: 'error',
    ...(snippet === undefined ? {} : { snippet }),
  };
}

const REPORT: Report = {
  id: '00000000-0000-4000-8000-0000000000aa',
  domain_id: DOMAIN.id,
  url: 'https://example.com/',
  passed: 10,
  warned: 1,
  failed: 1,
  skipped: 2,
  created_at: '2026-10-01T00:00:00.000Z',
  outcomes: [
    {
      id: 'accept-ch',
      status: 'warned',
      findings: [finding('Accept-CH adds hints.')],
    },
    {
      id: 'csp',
      status: 'failed',
      findings: [finding('No CSP.', 'Content-Security-Policy:\n  none')],
    },
    { id: 'ads-txt', status: 'passed', findings: [] },
    { id: 'age', status: 'skipped', findings: [] },
  ],
};

describe('textResult', () => {
  it('wraps text as the one content block', () => {
    expect(textResult('hi')).toEqual({
      content: [{ type: 'text', text: 'hi' }],
    });
  });
});

describe('errorResult', () => {
  it('marks the text as an error the assistant should relay', () => {
    expect(errorResult('no')).toEqual({
      content: [{ type: 'text', text: 'no' }],
      isError: true,
    });
  });
});

describe('domainLink', () => {
  it('links the domain’s page on Plumbline', () => {
    expect(domainLink(DOMAIN)).toBe(
      `https://plumbline.apps.mrida.ng/domains/${DOMAIN.id}`,
    );
  });
});

describe('DOMAINS_LINK', () => {
  it('links the list of domains on Plumbline', () => {
    expect(DOMAINS_LINK).toBe('https://plumbline.apps.mrida.ng/domains');
  });
});

describe('tallyLine', () => {
  it('puts failures first', () => {
    expect(tallyLine(REPORT)).toBe('1 failed, 1 warned, 10 passed, 2 skipped');
  });
});

describe('reportData', () => {
  it('carries the domain, the scan and the counts', () => {
    expect(reportData(DOMAIN, REPORT)).toMatchObject({
      host: 'example.com',
      url: 'https://example.com/',
      created_at: '2026-10-01T00:00:00.000Z',
      link: domainLink(DOMAIN),
      passed: 10,
      warned: 1,
      failed: 1,
      skipped: 2,
    });
  });

  it('lists only the checks that failed or warned, failures first', () => {
    expect(reportData(DOMAIN, REPORT).problems.map((p) => p.id)).toEqual([
      'csp',
      'accept-ch',
    ]);
  });

  it('names each check from the catalogue', () => {
    expect(reportData(DOMAIN, REPORT).problems[1]?.name).toBe(
      'Accept-CH is a valid client-hint list',
    );
  });

  it('keeps only what the view draws of a finding', () => {
    expect(reportData(DOMAIN, REPORT).problems[1]?.findings).toEqual([
      { message: 'Accept-CH adds hints.', resource: 'https://example.com/' },
    ]);
  });

  it('keeps the evidence of a finding that has some', () => {
    expect(reportData(DOMAIN, REPORT).problems[0]?.findings[0]?.snippet).toBe(
      'Content-Security-Policy:\n  none',
    );
  });

  it('passes on at most five findings of one check', () => {
    const many: Report = {
      ...REPORT,
      outcomes: [
        {
          id: 'csp',
          status: 'failed',
          findings: Array.from({ length: 9 }, (_, i) => finding(`n${i}`)),
        },
      ],
    };
    expect(reportData(DOMAIN, many).problems[0]?.findings).toHaveLength(5);
  });

  it('cuts long evidence short', () => {
    const long: Report = {
      ...REPORT,
      outcomes: [
        {
          id: 'csp',
          status: 'failed',
          findings: [finding('x', 'y'.repeat(900))],
        },
      ],
    };
    expect(
      reportData(DOMAIN, long).problems[0]?.findings[0]?.snippet,
    ).toHaveLength(400);
  });

  it('says who usually fixes each problem and where its rule comes from', () => {
    const csp = findCheck('csp');
    const problem = reportData(DOMAIN, REPORT).problems[0];
    expect(problem?.fixer).toBe(csp?.fixer);
    expect(problem?.reference).toBe(csp?.reference);
  });

  it('leaves out an outcome it cannot read, or of a check that no longer exists', () => {
    const odd: Report = {
      ...REPORT,
      outcomes: [
        'garbage',
        { id: 'no-such-check', status: 'failed', findings: [] },
      ],
    };
    expect(reportData(DOMAIN, odd).problems).toEqual([]);
  });
});

describe('reportText', () => {
  const text = reportText(reportData(DOMAIN, REPORT));

  it('opens with the domain, the address, the date and the counts', () => {
    expect(text.split('\n')[0]).toBe(
      'Report for example.com (https://example.com/), scanned 2026-10-01T00:00:00.000Z: 1 failed, 1 warned, 10 passed, 2 skipped.',
    );
  });

  it('heads each problem with its status, id and name', () => {
    expect(text).toContain('FAILED csp:');
    expect(text).toContain(
      'WARNED accept-ch: Accept-CH is a valid client-hint list',
    );
  });

  it('lists each finding with where it was found', () => {
    expect(text).toContain('- No CSP. (https://example.com/)');
  });

  it('writes evidence on one line', () => {
    expect(text).toContain('  Content-Security-Policy: none');
  });

  it('says who usually fixes each problem, and links its rule', () => {
    const csp = findCheck('csp');
    expect(text).toContain(`Usually fixed in: ${csp?.fixer ?? ''}.`);
    expect(text).toContain(`Rule: ${csp?.reference ?? ''}`);
  });

  it('leaves out the fix lines of a problem without them', () => {
    const data = reportData(DOMAIN, REPORT);
    const bare = reportText({
      ...data,
      problems: data.problems.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        findings: p.findings,
      })),
    });
    expect(bare).not.toContain('Usually fixed in');
    expect(bare).not.toContain('Rule:');
  });

  it('ends with the link to the domain on Plumbline', () => {
    expect(text.endsWith(`Open it on Plumbline: ${domainLink(DOMAIN)}`)).toBe(
      true,
    );
  });

  it('says so when nothing failed or warned', () => {
    expect(
      reportText({ ...reportData(DOMAIN, REPORT), problems: [] }),
    ).toContain('Nothing failed or warned.');
  });
});

describe('reportResult', () => {
  it('gives the model the text and the view the data', () => {
    const data = reportData(DOMAIN, REPORT);
    expect(reportResult(DOMAIN, REPORT)).toEqual({
      content: [{ type: 'text', text: reportText(data) }],
      structuredContent: data,
    });
  });
});

describe('domainListResult', () => {
  const LATEST: ReportSummary = {
    id: REPORT.id,
    domain_id: DOMAIN.id,
    url: REPORT.url,
    passed: 10,
    warned: 1,
    failed: 1,
    skipped: 2,
    created_at: REPORT.created_at,
  };
  const other: Domain = {
    ...DOMAIN,
    id: '00000000-0000-4000-8000-000000000002',
    host: 'example.org',
  };

  it('says when there are no domains', () => {
    expect(domainListResult([], 267).content[0]?.text).toBe(
      'The user has no domains yet.',
    );
  });

  it('gives the view an empty list, the total and the link when there are none', () => {
    expect(domainListResult([], 267).structuredContent).toEqual({
      total_checks: 267,
      link: DOMAINS_LINK,
      domains: [],
    });
  });

  it('writes one line per domain, with its checks and its newest scan', () => {
    const result = domainListResult(
      [
        { domain: DOMAIN, checks: 200, latest: LATEST },
        { domain: other, checks: 267 },
      ],
      267,
    );
    expect(result.content[0]?.text).toBe(
      [
        '- example.com: 200 of 267 checks; newest scan 2026-10-01T00:00:00.000Z: 1 failed, 1 warned, 10 passed, 2 skipped',
        '- example.org: 267 of 267 checks; not scanned yet',
      ].join('\n'),
    );
  });

  it('gives the view the tally of the newest scan, and nothing else of it', () => {
    const result = domainListResult(
      [{ domain: DOMAIN, checks: 200, latest: LATEST }],
      267,
    );
    expect(result.structuredContent).toEqual({
      total_checks: 267,
      link: DOMAINS_LINK,
      domains: [
        {
          id: DOMAIN.id,
          host: 'example.com',
          checks: 200,
          latest: {
            passed: 10,
            warned: 1,
            failed: 1,
            skipped: 2,
            created_at: REPORT.created_at,
          },
        },
      ],
    });
  });

  it('leaves out the newest scan of a domain that has none', () => {
    const result = domainListResult([{ domain: other, checks: 3 }], 267);
    expect(result.structuredContent).toMatchObject({
      domains: [{ id: other.id, host: 'example.org', checks: 3 }],
    });
    expect(
      (result.structuredContent as DomainListData).domains[0],
    ).not.toHaveProperty('latest');
  });
});

describe('checkName', () => {
  it('names a check by its catalogue name', () => {
    expect(checkName('ads-txt')).toBe('Valid ads.txt');
  });

  it('falls back to the id of a check that no longer exists', () => {
    expect(checkName('gone')).toBe('gone');
  });
});

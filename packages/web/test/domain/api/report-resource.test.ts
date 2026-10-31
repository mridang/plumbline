import { describe, expect, it } from '@jest/globals';

import {
  MAX_FINDINGS,
  isReportId,
  parseReportInput,
  reportResource,
} from '@/domain/api/report-resource';
import { findCheck } from '@/domain/checks/catalogue';
import type { Report } from '@/domain/db/reports';

const HOST = 'example.com';

/** A finding as a browser sends it. */
const finding = {
  resource: 'https://example.com/',
  message: 'Missing header',
  level: 'error',
};

/** A well-formed body with the given changes. */
const body = (extra: Record<string, unknown> = {}) => ({
  url: 'https://example.com/',
  outcomes: [
    { id: 'accept-ch', status: 'passed', findings: [] },
    { id: 'accept-patch', status: 'failed', findings: [finding] },
  ],
  ...extra,
});

/** The errors of a parse that should fail. */
function errorsOf(raw: Record<string, unknown>): readonly string[] {
  const parsed = parseReportInput(raw, HOST);
  return parsed.ok ? [] : parsed.errors;
}

describe('parseReportInput', () => {
  it('takes a well-formed report and counts the statuses itself', () => {
    expect(parseReportInput(body(), HOST)).toEqual({
      ok: true,
      value: {
        url: 'https://example.com/',
        outcomes: [
          { id: 'accept-ch', status: 'passed', findings: [] },
          { id: 'accept-patch', status: 'failed', findings: [finding] },
        ],
        passed: 1,
        warned: 0,
        failed: 1,
        skipped: 0,
      },
    });
  });

  it('ignores counts the client sent', () => {
    const parsed = parseReportInput(body({ passed: 99 }), HOST);
    expect(parsed.ok && parsed.value.passed).toBe(1);
  });

  it('takes an address on a subdomain', () => {
    expect(
      parseReportInput(body({ url: 'http://www.example.com/x' }), HOST).ok,
    ).toBe(true);
  });

  it('requires an address', () => {
    expect(errorsOf(body({ url: undefined }))).toEqual(['url: required.']);
  });

  it('refuses text that is not an address', () => {
    expect(errorsOf(body({ url: 'not a url' }))).toEqual([
      'url: not a valid address.',
    ]);
  });

  it('refuses an address on another site', () => {
    expect(errorsOf(body({ url: 'https://notexample.com/' }))).toEqual([
      'url: must be an http or https address on example.com.',
    ]);
  });

  it('refuses an address that is not http or https', () => {
    expect(errorsOf(body({ url: 'ftp://example.com/' }))).toEqual([
      'url: must be an http or https address on example.com.',
    ]);
  });

  it('requires at least one outcome', () => {
    expect(errorsOf(body({ outcomes: [] }))).toEqual([
      'outcomes: must be a list of at least one outcome.',
    ]);
  });

  it('requires the outcomes to be a list', () => {
    expect(errorsOf(body({ outcomes: {} }))).toEqual([
      'outcomes: must be a list of at least one outcome.',
    ]);
  });

  it('refuses an outcome that is not an object', () => {
    expect(errorsOf(body({ outcomes: ['x'] }))).toEqual([
      'outcomes[0]: must be an object.',
    ]);
  });

  it('refuses an outcome for a check that does not exist', () => {
    expect(
      errorsOf(body({ outcomes: [{ id: 'nope', status: 'passed' }] })),
    ).toEqual(['outcomes[0].id: not a check.']);
  });

  it('refuses a status it does not know', () => {
    expect(
      errorsOf(body({ outcomes: [{ id: 'accept-ch', status: 'great' }] })),
    ).toEqual([
      'outcomes[0].status: must be one of failed, warned, passed, skipped.',
    ]);
  });

  it('refuses findings that are not a list', () => {
    expect(
      errorsOf(
        body({
          outcomes: [{ id: 'accept-ch', status: 'passed', findings: 'x' }],
        }),
      ),
    ).toEqual(['outcomes[0].findings: must be a list.']);
  });

  it('refuses the same check twice', () => {
    const twice = { id: 'accept-ch', status: 'passed' };
    expect(errorsOf(body({ outcomes: [twice, twice] }))).toEqual([
      'outcomes[1].id: accept-ch is listed twice.',
    ]);
  });

  it('reports at most twenty problems', () => {
    const outcomes = Array.from({ length: 30 }, () => 'x');
    expect(errorsOf(body({ outcomes }))).toHaveLength(20);
  });

  it('takes an outcome with no findings as one with none', () => {
    const parsed = parseReportInput(
      body({ outcomes: [{ id: 'accept-ch', status: 'skipped' }] }),
      HOST,
    );
    expect(parsed.ok && parsed.value.outcomes[0]?.findings).toEqual([]);
  });

  it('keeps the reason a check was skipped', () => {
    const parsed = parseReportInput(
      body({
        outcomes: [{ id: 'accept-ch', status: 'skipped', reason: 'No DNS' }],
      }),
      HOST,
    );
    expect(parsed.ok && parsed.value.outcomes[0]?.reason).toBe('No DNS');
  });

  it(`keeps at most ${MAX_FINDINGS} findings of a check`, () => {
    const findings = Array.from({ length: MAX_FINDINGS + 5 }, () => finding);
    const parsed = parseReportInput(
      body({ outcomes: [{ id: 'accept-ch', status: 'failed', findings }] }),
      HOST,
    );
    expect(parsed.ok && parsed.value.outcomes[0]?.findings).toHaveLength(
      MAX_FINDINGS,
    );
  });

  it('drops findings that are not well formed', () => {
    const findings = [
      null,
      { ...finding, level: 'fatal' },
      { ...finding, message: 1 },
      { level: 'error', message: 'no resource' },
      finding,
    ];
    const parsed = parseReportInput(
      body({ outcomes: [{ id: 'accept-ch', status: 'failed', findings }] }),
      HOST,
    );
    expect(parsed.ok && parsed.value.outcomes[0]?.findings).toEqual([finding]);
  });

  it('keeps the detail of a finding and drops a position that is not a whole number', () => {
    const detailed = {
      ...finding,
      snippet: 'Strict-Transport-Security: max-age=0',
      language: 'http',
      line: 3,
      column: 1.5,
    };
    const parsed = parseReportInput(
      body({
        outcomes: [{ id: 'accept-ch', status: 'failed', findings: [detailed] }],
      }),
      HOST,
    );
    expect(parsed.ok && parsed.value.outcomes[0]?.findings).toEqual([
      {
        ...finding,
        snippet: 'Strict-Transport-Security: max-age=0',
        language: 'http',
        line: 3,
      },
    ]);
  });

  it('keeps the further reading of a finding, as plain http(s) links only', () => {
    const linked = {
      ...finding,
      links: [
        { url: 'https://fix.test/', text: 'How to fix it' },
        { url: 'https://bare.test/' },
        { url: 'javascript:alert(1)', text: 'x' },
        'not a link',
      ],
    };
    const parsed = parseReportInput(
      body({
        outcomes: [{ id: 'accept-ch', status: 'failed', findings: [linked] }],
      }),
      HOST,
    );
    expect(parsed.ok && parsed.value.outcomes[0]?.findings[0]?.links).toEqual([
      { url: 'https://fix.test/', text: 'How to fix it' },
      { url: 'https://bare.test/', text: 'https://bare.test/' },
    ]);
  });

  it('keeps at most five links of a finding, and none when there are none', () => {
    const many = {
      ...finding,
      links: Array.from({ length: 8 }, (_, i) => ({
        url: `https://a.test/${i}`,
        text: `${i}`,
      })),
    };
    const parsed = parseReportInput(
      body({
        outcomes: [
          { id: 'accept-ch', status: 'failed', findings: [many, finding] },
        ],
      }),
      HOST,
    );
    const findings = parsed.ok ? parsed.value.outcomes[0]?.findings : [];
    expect(findings?.[0]?.links).toHaveLength(5);
    expect(findings?.[1]).not.toHaveProperty('links');
  });

  it('cuts a long message short', () => {
    const long = { ...finding, message: 'x'.repeat(3000) };
    const parsed = parseReportInput(
      body({
        outcomes: [{ id: 'accept-ch', status: 'failed', findings: [long] }],
      }),
      HOST,
    );
    expect(
      parsed.ok && parsed.value.outcomes[0]?.findings[0]?.message,
    ).toHaveLength(2000);
  });
});

describe('reportResource', () => {
  const report: Report = {
    id: '00000000-0000-4000-8000-000000000002',
    domain_id: '00000000-0000-4000-8000-000000000001',
    url: 'https://example.com/',
    passed: 1,
    warned: 0,
    failed: 0,
    skipped: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    outcomes: [
      { id: 'accept-ch', status: 'passed', findings: [] },
      { id: 'gone-check', status: 'passed', findings: [] },
      'garbage',
    ],
  };

  it('names each outcome after its check and drops what cannot be read', () => {
    expect(reportResource(report).outcomes).toEqual([
      {
        id: 'accept-ch',
        status: 'passed',
        findings: [],
        name: findCheck('accept-ch')?.name,
      },
    ]);
  });

  it('keeps the summary as it is', () => {
    expect(reportResource(report)).toMatchObject({
      id: report.id,
      domain_id: report.domain_id,
      url: report.url,
      passed: 1,
      warned: 0,
      failed: 0,
      skipped: 0,
      created_at: report.created_at,
    });
  });
});

describe('isReportId', () => {
  it('takes a UUID', () => {
    expect(isReportId('00000000-0000-4000-8000-000000000002')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isReportId('latest')).toBe(false);
  });
});

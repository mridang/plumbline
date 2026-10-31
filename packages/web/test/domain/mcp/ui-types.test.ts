import { describe, expect, it } from '@jest/globals';
import Ajv2020 from 'ajv/dist/2020.js';

import type { Domain } from '@/domain/db/domains';
import type { Report } from '@/domain/db/reports';
import { toolNamed } from '@/domain/mcp/tool-definitions';
import { domainListResult, reportData } from '@/domain/mcp/tool-results';
import type { DomainListData, ReportData } from '@/domain/mcp/ui-types';
import { isDomainListData, isReportData } from '@/views/guards';

const DOMAIN: Domain = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: 1,
  host: 'example.com',
  checks: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};

const REPORT: Report = {
  id: '00000000-0000-4000-8000-0000000000aa',
  domain_id: DOMAIN.id,
  url: 'https://example.com/',
  passed: 1,
  warned: 0,
  failed: 1,
  skipped: 0,
  created_at: '2026-10-01T00:00:00.000Z',
  outcomes: [
    {
      id: 'csp',
      status: 'failed',
      findings: [
        {
          message: 'No CSP.',
          resource: 'https://example.com/',
          level: 'error',
          snippet: 'Content-Security-Policy: none',
        },
      ],
    },
  ],
};

/** What the server sends the report View. */
const REPORT_DATA: ReportData = reportData(DOMAIN, REPORT);

/** What the server sends the domain-list View. */
const LIST_DATA = domainListResult(
  [
    { domain: DOMAIN, checks: 10, latest: REPORT },
    { domain: { ...DOMAIN, id: 'd2', host: 'example.org' }, checks: 3 },
  ],
  267,
).structuredContent as DomainListData;

/** The output schema a tool advertises. */
function outputSchemaOf(name: string): object {
  const tool = toolNamed(name);
  return tool && 'outputSchema' in tool ? tool.outputSchema : {};
}

describe('ReportData', () => {
  it('fits the output schema get_report advertises', () => {
    const ajv = new Ajv2020({ strict: true });
    expect(ajv.validate(outputSchemaOf('get_report'), REPORT_DATA)).toBe(true);
  });

  it('is what the report View accepts', () => {
    expect(isReportData(REPORT_DATA)).toBe(true);
  });
});

describe('DomainListData', () => {
  it('fits the output schema list_domains advertises', () => {
    const ajv = new Ajv2020({ strict: true });
    expect(ajv.validate(outputSchemaOf('list_domains'), LIST_DATA)).toBe(true);
  });

  it('is what the domain-list View accepts', () => {
    expect(isDomainListData(LIST_DATA)).toBe(true);
  });
});

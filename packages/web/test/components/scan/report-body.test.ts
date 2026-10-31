import { describe, expect, it, jest } from '@jest/globals';

import { reportBody, saveReport } from '@/components/scan/report-body';
import type { Scan } from '@/components/scan/scan-results';
import { ProblemError } from '@/components/api/problem-message';
import type { HintOutcome } from '@/domain/scan/engine';

/** A finished check with the given outcome. */
const hint = (
  id: string,
  status: HintOutcome['status'],
  extra: Partial<HintOutcome> = {},
): HintOutcome => ({
  id,
  name: `Name of ${id}`,
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

const SCAN: Scan = {
  finalUrl: 'https://example.com/',
  status: 200,
  total: 2,
  startedAt: 0,
  finishedAt: 10,
  hints: [
    hint('hsts', 'failed', {
      findings: [
        {
          resource: 'https://example.com/',
          message: 'No HSTS',
          level: 'error',
        },
      ],
    }),
    hint('dnssec', 'skipped', { reason: 'Needs a server' }),
  ],
};

describe('reportBody', () => {
  it('sends the address the scan ended at', () => {
    expect(reportBody(SCAN).url).toBe('https://example.com/');
  });

  it('keeps each check’s id, outcome and findings, and drops its names', () => {
    expect(reportBody(SCAN).outcomes[0]).toEqual({
      id: 'hsts',
      status: 'failed',
      findings: [
        {
          resource: 'https://example.com/',
          message: 'No HSTS',
          level: 'error',
        },
      ],
    });
  });

  it('keeps why a check was skipped', () => {
    expect(reportBody(SCAN).outcomes[1]).toEqual({
      id: 'dnssec',
      status: 'skipped',
      reason: 'Needs a server',
      findings: [],
    });
  });
});

describe('saveReport', () => {
  it('posts the body as JSON to the domain’s reports', async () => {
    const transport = jest.fn<typeof fetch>(
      async () => new Response(null, { status: 201 }),
    );
    await saveReport('d1', SCAN, transport);
    expect(transport).toHaveBeenCalledWith('/api/domains/d1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportBody(SCAN)),
    });
  });

  it('rejects with the problem the server answered', async () => {
    const transport = jest.fn<typeof fetch>(async () =>
      Response.json(
        { title: 'Not Found', status: 404, detail: 'No such domain' },
        {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    );
    await expect(saveReport('d1', SCAN, transport)).rejects.toBeInstanceOf(
      ProblemError,
    );
  });
});

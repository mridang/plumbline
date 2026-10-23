import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Severity, type Problem } from '@hint/utils-types';
import { createScanServer, type ScanFn } from '../src/server.js';
import type { HintMeta } from '../src/scan.js';

const HINT: HintMeta = {
  id: 'csp-present',
  name: 'CSP present',
  description: '',
  category: 'security',
  groups: ['owasp'],
};

function problem(): Problem {
  return {
    location: { line: 1, column: 1 },
    message: 'missing CSP',
    sourceCode: '',
    resource: 'https://example.com/',
    hintId: 'extra/csp-present',
    category: 'security' as unknown as Problem['category'],
    severity: Severity.error,
  };
}

/** A scan that never touches the network, for the server under test. */
const fakeScan: ScanFn = async () => ({ problems: [problem()], hints: [HINT] });

let server: Server;
let base: string;

function listen(scan: ScanFn): Promise<void> {
  server = createScanServer({ scan });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      base = `http://127.0.0.1:${port}`;
      resolve();
    }),
  );
}

afterEach(
  () => new Promise((resolve) => server.close(() => resolve(undefined))),
);

describe('the scan server', () => {
  beforeEach(() => listen(fakeScan));

  it('answers the health check', async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('lists the hint catalogue', async () => {
    const res = await fetch(`${base}/hints`);
    const body = (await res.json()) as { hints: unknown[] };
    expect(res.status).toBe(200);
    expect(body.hints.length).toBeGreaterThan(0);
  });

  it('scans a url and returns the report', async () => {
    const res = await fetch(`${base}/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    const body = (await res.json()) as {
      summary: { total: number };
      findings: { severity: string }[];
    };
    expect(res.status).toBe(200);
    expect(body.summary.total).toBe(1);
    expect(body.findings[0].severity).toBe('error');
  });

  it('rejects a body that is not valid JSON', async () => {
    const res = await fetch(`${base}/scan`, {
      method: 'POST',
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a request with no url', async () => {
    const res = await fetch(`${base}/scan`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a non-http url', async () => {
    const res = await fetch(`${base}/scan`, {
      method: 'POST',
      body: JSON.stringify({ url: 'ftp://example.com/' }),
    });
    expect(res.status).toBe(400);
  });

  it('answers 404 for an unknown route', async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
  });
});

describe('when a scan throws', () => {
  beforeEach(() =>
    listen(async () => {
      throw new Error('browser crashed');
    }),
  );

  it('answers 500 with the error detail', async () => {
    const res = await fetch(`${base}/scan`, {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    const body = (await res.json()) as { error: string; detail: string };
    expect(res.status).toBe(500);
    expect(body.detail).toContain('browser crashed');
  });
});

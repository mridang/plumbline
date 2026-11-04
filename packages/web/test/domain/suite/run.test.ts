import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { resolve } from 'node:path';

import { runSuite, type SuiteRun } from '@/domain/suite/run';

import { inWorkerd } from '../../helpers/workerd';

describe('runSuite', () => {
  let worker: Awaited<ReturnType<typeof inWorkerd<SuiteRun>>>;

  beforeAll(async () => {
    worker = await inWorkerd<SuiteRun>(
      resolve('test/helpers/suite-entry.ts'),
      'runOnHtml',
    );
  });

  afterAll(async () => {
    await worker.dispose();
  });

  it('fetches the page once and returns every check', async () => {
    const run = await worker.run(
      '<html><head><title>Hi</title></head><body><p>short</p></body></html>',
    );
    expect(run.status).toBe(200);
    expect(run.checks).toHaveLength(16);
    expect(run.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not read a page again when it hashes to the previous run', async () => {
    const twice = await inWorkerd<{ first: SuiteRun; second: SuiteRun }>(
      resolve('test/helpers/suite-entry.ts'),
      'runTwice',
    );
    try {
      const { first, second } = await twice.run(
        '<html><body>same</body></html>',
      );
      expect(first.checks).toHaveLength(16);
      expect(second.checks).toBeNull();
      expect(second.hash).toBe(first.hash);
    } finally {
      await twice.dispose();
    }
  });

  it('reports what the page lacks', async () => {
    const run = await worker.run('<html><body><p>short</p></body></html>');
    const missing = (id: string) =>
      run.checks?.find((check) => check.id === id)?.findings.length;
    expect(missing('seo-viewport')).toBe(1);
    expect(missing('seo-content-length')).toBe(1);
  });
});

describe('runSuite, where it will go', () => {
  /** A response that says it ended up at `address`. */
  const endingAt = (address: string): Response => {
    const response = new Response('<html></html>');
    Object.defineProperty(response, 'url', { value: address });
    return response;
  };

  it('refuses a page whose redirects ended on a plain http address', async () => {
    await expect(
      runSuite('https://x.test/', null, async () => endingAt('http://x.test/')),
    ).rejects.toThrow('redirected to http://x.test/, which is not https');
  });

  describe('asking the site whether the page changed', () => {
    it('sends the validators back with the request', async () => {
      const seen: Record<string, string>[] = [];
      await runSuite(
        'https://a.test/',
        'h',
        async (_url, init) => {
          seen.push(init.headers as Record<string, string>);
          return new Response(null, { status: 304 });
        },
        { etag: '"v1"', lastModified: 'Mon, 01 Jan 2026 00:00:00 GMT' },
      );
      expect(seen[0]).toMatchObject({
        'if-none-match': '"v1"',
        'if-modified-since': 'Mon, 01 Jan 2026 00:00:00 GMT',
      });
    });

    it('reads nothing when the site answers 304, and keeps the hash', async () => {
      const run = await runSuite(
        'https://a.test/',
        'previous-hash',
        async () =>
          new Response(null, {
            status: 304,
            headers: { etag: '"v2"', 'cache-control': 'max-age=60' },
          }),
        { etag: '"v1"', lastModified: null },
      );
      expect(run).toMatchObject({
        status: 304,
        hash: 'previous-hash',
        checks: null,
        validators: { etag: '"v2"' },
      });
      expect(run.freshUntil).not.toBeNull();
    });

    it('keeps the old validators when a 304 gives none', async () => {
      const run = await runSuite(
        'https://a.test/',
        'h',
        async () => new Response(null, { status: 304 }),
        { etag: '"v1"', lastModified: null },
      );
      expect(run.validators).toEqual({ etag: '"v1"', lastModified: null });
      expect(run.freshUntil).toBeNull();
    });
  });
});

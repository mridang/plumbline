import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { resolve } from 'node:path';

import type { SuiteRun } from '@/domain/suite/run';

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
  });

  it('reports what the page lacks', async () => {
    const run = await worker.run('<html><body><p>short</p></body></html>');
    const missing = (id: string) =>
      run.checks.find((check) => check.id === id)?.findings.length;
    expect(missing('seo-viewport')).toBe(1);
    expect(missing('seo-content-length')).toBe(1);
  });
});

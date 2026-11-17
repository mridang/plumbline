import { describe, expect, it, jest } from '@jest/globals';

import { handleScanQueue } from '@/domain/suite/queue';
import { scheduled } from '@/domain/suite/scheduled';

import { cloudflareWorkersStub } from '../../helpers/cloudflare-workers-stub';

// eslint-disable-next-line tslop/no-module-mocking -- cloudflare:workers exists only in the Workers runtime and cannot be injected into code that imports it
jest.unstable_mockModule('cloudflare:workers', cloudflareWorkersStub, {
  virtual: true,
});

const {
  default: extraHandlers,
  ProbeScanner,
  UserHub,
} = await import('@/lib/core/worker-extras');

describe('extraHandlers', () => {
  it('adds the cron handler and the scan queue consumer to the Worker, and nothing else', () => {
    expect(extraHandlers).toEqual({ scheduled, queue: handleScanQueue });
  });

  it('exports the Durable Object classes the Worker must name', () => {
    expect(typeof ProbeScanner).toBe('function');
    expect(typeof UserHub).toBe('function');
  });
});

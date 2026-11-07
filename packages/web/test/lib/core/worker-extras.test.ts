import { describe, expect, it, jest } from '@jest/globals';

import { handleScanQueue } from '@/domain/suite/queue';
import { scheduled } from '@/domain/suite/scheduled';

import { cloudflareWorkersStub } from '../../helpers/cloudflare-workers-stub';

jest.unstable_mockModule('cloudflare:workers', cloudflareWorkersStub, {
  virtual: true,
} as never);

const {
  default: extraHandlers,
  ScannerContainer,
  UserHub,
} = await import('@/lib/core/worker-extras');

describe('extraHandlers', () => {
  it('adds the cron handler and the scan queue's consumer to the Worker, and nothing else', () => {
    expect(extraHandlers).toEqual({ scheduled, queue: handleScanQueue });
  });

  it('exports the Durable Object classes the Worker must name', () => {
    expect(typeof ScannerContainer).toBe('function');
    expect(typeof UserHub).toBe('function');
  });
});

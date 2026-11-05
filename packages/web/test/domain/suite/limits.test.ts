import { describe, expect, it } from '@jest/globals';

import {
  FREE_LIMITS,
  PAID_LIMITS,
  SCAN_CONCURRENCY,
  inBatches,
  readLimits,
  scanLimits,
} from '@/domain/suite/limits';

describe('readLimits', () => {
  it('uses the Free plan when nothing is set', () => {
    expect(readLimits({})).toBe(FREE_LIMITS);
  });

  it('uses the Paid plan when asked, in any case', () => {
    expect(readLimits({ WORKERS_PLAN: 'paid' })).toBe(PAID_LIMITS);
    expect(readLimits({ WORKERS_PLAN: ' Paid ' })).toBe(PAID_LIMITS);
  });

  it('uses the Free plan for a name it does not know', () => {
    expect(readLimits({ WORKERS_PLAN: 'enterprise' })).toBe(FREE_LIMITS);
  });

  it('allows the Paid plan more than the Free plan in every way', () => {
    expect(PAID_LIMITS.maxSites).toBeGreaterThan(FREE_LIMITS.maxSites);
    expect(PAID_LIMITS.scheduledBatch).toBeGreaterThan(
      FREE_LIMITS.scheduledBatch,
    );
  });
});

describe('inBatches', () => {
  it('returns the results in order and runs no more than the size at once', async () => {
    let running = 0;
    let most = 0;
    const out = await inBatches([1, 2, 3, 4, 5], 2, async (n) => {
      running += 1;
      most = Math.max(most, running);
      await Promise.resolve();
      running -= 1;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(most).toBe(2);
  });

  it('treats a size below one as one', async () => {
    expect(await inBatches([1, 2], 0, (n) => Promise.resolve(n))).toEqual([
      1, 2,
    ]);
  });
});

describe('scanLimits', () => {
  it('lets no more scans run at once than the container takes, on any plan', () => {
    expect(scanLimits(PAID_LIMITS).concurrency).toBe(SCAN_CONCURRENCY);
    expect(scanLimits(FREE_LIMITS).concurrency).toBe(SCAN_CONCURRENCY);
  });

  it('keeps a lower concurrency and every other limit as it is', () => {
    const low = { ...FREE_LIMITS, concurrency: 1 };
    expect(scanLimits(low)).toEqual(low);
    expect(scanLimits(PAID_LIMITS).maxSites).toBe(PAID_LIMITS.maxSites);
  });
});

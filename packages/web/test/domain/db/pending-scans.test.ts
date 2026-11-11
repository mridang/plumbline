import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import {
  claimPending,
  finishPending,
  putPending,
  releasePending,
  revivePending,
} from '@/domain/db/pending-scans';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const made = () => {
  const { d1, raw } = sqliteD1(...APP_MIGRATIONS);
  return { db: createDatabase(d1), raw };
};

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-01T01:00:00.000Z';
const T2 = '2026-01-01T02:00:00.000Z';
const ALWAYS = { force: true, staleBefore: T0 };
const ONCE = { force: false, staleBefore: T0 };

describe('putPending', () => {
  it('stores a new job as the first of its key', async () => {
    const { db } = made();
    expect(await putPending(db, 'k', '{"a":1}', T0, ONCE)).toBe(1);
  });

  it('replaces the job waiting under the key and counts it, when forced', async () => {
    const { db } = made();
    await putPending(db, 'k', 'old', T0, ALWAYS);
    expect(await putPending(db, 'k', 'new', T1, ALWAYS)).toBe(2);
    const claim = await claimPending(db, 'k', T1, T0);
    expect(claim).toEqual({
      state: 'claimed',
      claim: { seq: 2, job: 'new' },
    });
  });

  it('leaves a waiting job alone when not forced, until it is stale', async () => {
    const { db } = made();
    await putPending(db, 'k', 'old', T1, ONCE);
    expect(await putPending(db, 'k', 'new', T2, ONCE)).toBeNull();
    expect(
      await putPending(db, 'k', 'new', T2, { force: false, staleBefore: T2 }),
    ).toBe(2);
  });

  it('keeps jobs of different keys apart', async () => {
    const { db } = made();
    await putPending(db, 'a', 'one', T0, ALWAYS);
    expect(await putPending(db, 'b', 'two', T0, ALWAYS)).toBe(1);
  });
});

describe('claimPending', () => {
  it('gives a job to one consumer only while its lease is fresh', async () => {
    const { db } = made();
    await putPending(db, 'k', 'job', T0, ALWAYS);
    const first = await claimPending(db, 'k', T1, T0);
    expect(first.state).toBe('claimed');
    const second = await claimPending(db, 'k', T1, T0);
    expect(second.state).toBe('busy');
  });

  it('takes a job whose holder has gone quiet', async () => {
    const { db } = made();
    await putPending(db, 'k', 'job', T0, ALWAYS);
    await claimPending(db, 'k', T0, T0);
    const taken = await claimPending(db, 'k', T2, T1);
    expect(taken.state).toBe('claimed');
  });

  it('says gone for a key with no job', async () => {
    const { db } = made();
    expect(await claimPending(db, 'nothing', T0, T0)).toEqual({
      state: 'gone',
    });
  });

  it('is given back by a release, so a retry may take it at once', async () => {
    const { db } = made();
    await putPending(db, 'k', 'job', T0, ALWAYS);
    await claimPending(db, 'k', T1, T0);
    await releasePending(db, 'k', 1);
    const claim = await claimPending(db, 'k', T1, T0);
    expect(claim.state).toBe('claimed');
  });

  it('is not released for a job that was replaced meanwhile', async () => {
    const { db } = made();
    await putPending(db, 'k', 'job', T0, ALWAYS);
    await claimPending(db, 'k', T1, T0);
    await putPending(db, 'k', 'newer', T1, ALWAYS);
    await releasePending(db, 'k', 1);
    expect(await claimPending(db, 'k', T1, T0)).toEqual({
      state: 'claimed',
      claim: { seq: 2, job: 'newer' },
    });
  });
});

describe('finishPending', () => {
  it('forgets the job it finished', async () => {
    const { db } = made();
    await putPending(db, 'k', 'job', T0, ALWAYS);
    await finishPending(db, 'k', 1);
    const gone = await claimPending(db, 'k', T1, T0);
    expect(gone.state).toBe('gone');
  });

  it('does not forget a newer job that replaced it while it ran', async () => {
    const { db } = made();
    await putPending(db, 'k', 'job', T0, ALWAYS);
    await putPending(db, 'k', 'newer', T1, ALWAYS);
    await finishPending(db, 'k', 1);
    const claim = await claimPending(db, 'k', T1, T0);
    expect(claim.state).toBe('claimed');
  });
});

describe('revivePending', () => {
  it('returns the jobs that waited too long and marks them as sent', async () => {
    const { db } = made();
    await putPending(db, 'old', 'x', T0, ALWAYS);
    await putPending(db, 'older', 'x', '2025-12-31T00:00:00.000Z', ALWAYS);
    await putPending(db, 'fresh', 'x', T2, ALWAYS);
    const revived = await revivePending(db, T1, T2, 10);
    expect(
      revived
        .map((job) => job.key)
        .toSorted((a, b) => Number(a > b) - Number(a < b)),
    ).toEqual(['old', 'older']);
    expect(await revivePending(db, T1, T2, 10)).toEqual([]);
  });

  it('takes no more than the limit', async () => {
    const { db } = made();
    await putPending(db, 'a', 'x', T0, ALWAYS);
    await putPending(db, 'b', 'x', T0, ALWAYS);
    expect(await revivePending(db, T1, T2, 1)).toHaveLength(1);
  });
});

describe('query plans', () => {
  it('go by the key, or by the index on the time: never a scan of the table', async () => {
    const { raw } = made();
    const plan = (sql: string, ...params: string[]) =>
      raw
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...params)
        .map((row) => String(row['detail']))
        .join(' | ');
    expect(
      plan(
        'update pending_scans set claimed_at = ? where key = ? and (claimed_at is null or claimed_at < ?) returning seq, job',
        T0,
        'k',
        T0,
      ),
    ).not.toMatch(/SCAN pending_scans/);
    expect(
      plan('delete from pending_scans where key = ? and seq = 1', 'k'),
    ).not.toMatch(/SCAN pending_scans/);
    expect(
      plan(
        'select key from pending_scans where enqueued_at < ? order by enqueued_at limit 5',
        T0,
      ),
    ).toMatch(/idx_pending_scans_enqueued/);
  });
});

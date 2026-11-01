import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import {
  RUNS_KEPT,
  claimDelivery,
  latestRuns,
  recordRun,
} from '@/domain/db/suite';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const database = () => createDatabase(sqliteD1(...APP_MIGRATIONS).d1);

const run = (host: string, message = 'x', userId = 1) => ({
  userId,
  host,
  repo: 'acme/site',
  sha: 'abc',
  status: 200,
  findings: [{ id: 'a', severity: 'warning' as const, message }],
});

describe('recordRun and latestRuns', () => {
  it('returns the newest runs first with their findings', async () => {
    const db = database();
    await recordRun(db, run('a.test', 'first'));
    await recordRun(db, run('a.test', 'second'));
    const runs = await latestRuns(db, 1, 'a.test');
    expect(runs.map((r) => r.findings[0]?.message)).toEqual([
      'second',
      'first',
    ]);
    expect(runs[0]).toMatchObject({
      repo: 'acme/site',
      sha: 'abc',
      status: 200,
    });
  });

  it("never returns another person's or another host's runs", async () => {
    const db = database();
    await recordRun(db, run('a.test', 'mine'));
    await recordRun(db, run('b.test', 'other host'));
    await recordRun(db, run('a.test', 'other person', 2));
    const runs = await latestRuns(db, 1, 'a.test', 10);
    expect(runs.map((r) => r.findings[0]?.message)).toEqual(['mine']);
  });

  it('keeps only the newest runs of a host', async () => {
    const db = database();
    for (let i = 0; i < RUNS_KEPT + 3; i += 1) {
      await recordRun(db, run('a.test', `run ${i}`));
    }
    await recordRun(db, run('b.test', 'untouched'));
    const runs = await latestRuns(db, 1, 'a.test', 100);
    expect(runs).toHaveLength(RUNS_KEPT);
    expect(runs[0]?.findings[0]?.message).toBe(`run ${RUNS_KEPT + 2}`);
    expect(await latestRuns(db, 1, 'b.test')).toHaveLength(1);
  });
});

describe('claimDelivery', () => {
  it('accepts a delivery once', async () => {
    const db = database();
    expect(await claimDelivery(db, 'd1')).toBe(true);
    expect(await claimDelivery(db, 'd1')).toBe(false);
    expect(await claimDelivery(db, 'd2')).toBe(true);
  });

  it('forgets a delivery after a week', async () => {
    const db = database();
    const then = new Date('2026-01-01T00:00:00Z');
    await claimDelivery(db, 'old', then);
    expect(
      await claimDelivery(db, 'old', new Date('2026-01-09T00:00:00Z')),
    ).toBe(true);
  });
});

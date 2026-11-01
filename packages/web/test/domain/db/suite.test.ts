import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import {
  RUNS_KEPT,
  claimDelivery,
  dueSites,
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
  hash: 'h1',
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

describe('dueSites', () => {
  const cutoff = '2026-01-02T00:00:00.000Z';

  it('lists sites found through GitHub that were never checked or checked before the cutoff', async () => {
    const db = database();
    await addDomain(db, 1, 'never.test', 'acme/a');
    await addDomain(db, 1, 'old.test', 'acme/b');
    await addDomain(db, 1, 'fresh.test', 'acme/c');
    await recordRun(db, run('old.test'), '2026-01-01T00:00:00.000Z');
    await recordRun(db, run('fresh.test'), '2026-01-03T00:00:00.000Z');
    const due = await dueSites(db, cutoff, 10);
    expect(due.map((site) => site.host)).toEqual(['never.test', 'old.test']);
  });

  it('judges a site by its latest run, not an older one', async () => {
    const db = database();
    await addDomain(db, 1, 'a.test', 'acme/a');
    await recordRun(db, run('a.test'), '2026-01-01T00:00:00.000Z');
    await recordRun(db, run('a.test'), '2026-01-03T00:00:00.000Z');
    expect(await dueSites(db, cutoff, 10)).toEqual([]);
  });

  it('leaves out sites added by hand', async () => {
    const db = database();
    await addDomain(db, 1, 'by-hand.test');
    expect(await dueSites(db, cutoff, 10)).toEqual([]);
  });

  it('keeps one site of two people apart and stops at the limit', async () => {
    const db = database();
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 2, 'a.test', 'beta/a');
    await addDomain(db, 1, 'b.test', 'acme/b');
    await recordRun(db, run('a.test', 'x', 1), '2026-01-03T00:00:00.000Z');
    const due = await dueSites(db, cutoff, 2);
    expect(due.map((site) => `${site.user_id}:${site.host}`)).toEqual([
      '2:a.test',
      '1:b.test',
    ]);
  });
});

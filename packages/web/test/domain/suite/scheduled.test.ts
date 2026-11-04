import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { latestRuns } from '@/domain/db/suite';
import {
  RECHECK_AFTER_MS,
  SCHEDULED_BATCH,
  checkDueSites,
} from '@/domain/suite/scheduled';
import type { SuiteRun } from '@/domain/suite/run';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const page = async (): Promise<SuiteRun> => ({
  url: 'https://x.test/',
  status: 200,
  hash: 'h',
  checks: [],
});

const start = new Date('2026-01-01T00:00:00.000Z');

describe('checkDueSites', () => {
  it('checks the sites found through GitHub that were never checked', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 1, 'by-hand.test');
    const outcomes = await checkDueSites(db, { run: page, now: () => start });
    expect(outcomes.map((o) => o.host)).toEqual(['a.test']);
    expect(await latestRuns(db, 1, 'a.test')).toHaveLength(1);
  });

  it('leaves a site alone until a day has passed', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    await checkDueSites(db, { run: page, now: () => start });
    const soon = new Date(start.getTime() + RECHECK_AFTER_MS - 1);
    expect(await checkDueSites(db, { run: page, now: () => soon })).toEqual([]);
    const later = new Date(start.getTime() + RECHECK_AFTER_MS + 1);
    expect(
      await checkDueSites(db, { run: page, now: () => later }),
    ).toHaveLength(1);
  });

  it('leaves a site alone whose page its owner said is still fresh', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    await checkDueSites(db, {
      run: async () => ({
        ...(await page()),
        freshUntil: '2999-01-01T00:00:00.000Z',
      }),
      now: () => start,
    });
    const later = new Date(start.getTime() + RECHECK_AFTER_MS + 1);
    let fetched = 0;
    const outcomes = await checkDueSites(db, {
      run: async () => {
        fetched += 1;
        return page();
      },
      now: () => later,
    });
    expect(outcomes).toEqual([{ host: 'a.test', skipped: 'fresh' }]);
    expect(fetched).toBe(0);
  });

  it('takes only a few sites at a time', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    for (let i = 0; i < SCHEDULED_BATCH + 2; i += 1) {
      await addDomain(db, 1, `h${i}.test`, 'acme/a');
    }
    const first = await checkDueSites(db, { run: page, now: () => start });
    expect(first).toHaveLength(SCHEDULED_BATCH);
    const second = await checkDueSites(db, { run: page, now: () => start });
    expect(second).toHaveLength(2);
  });
});

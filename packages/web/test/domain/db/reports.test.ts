import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  KEEP_REPORTS,
  deleteReportsOf,
  getReport,
  latestReport,
  listReports,
  saveReport,
} from '@/domain/db/reports';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

afterEach(() => {
  jest.useRealTimers();
});

/** Make the clock read `iso`, so reports get the times a test needs. */
const at = (iso: string) => {
  jest.useFakeTimers({ now: new Date(iso), doNotFake: ['queueMicrotask'] });
};

/** The time `n` minutes into 2026. */
const minute = (n: number) =>
  new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString();

/** A database with every migration applied and nothing in it. */
const empty = () => sqliteDatabase(...APP_MIGRATIONS);

/** What a browser posts for one scan. */
const input = {
  url: 'https://example.com/',
  passed: 3,
  warned: 1,
  failed: 2,
  skipped: 0,
  outcomes: [{ id: 'hsts', status: 'passed', findings: [] }],
};

describe('saveReport', () => {
  it('answers the report it saved, with its outcomes', async () => {
    const { db } = empty();
    const report = await saveReport(db, 1, 'd1', input);
    expect(report).toMatchObject({ ...input, domain_id: 'd1' });
  });

  it('saves the report so it can be read back', async () => {
    const { db } = empty();
    const report = await saveReport(db, 1, 'd1', input);
    expect(await getReport(db, 1, 'd1', report.id)).toEqual(report);
  });

  it(`keeps only the newest ${KEEP_REPORTS} reports of a domain`, async () => {
    const { db } = empty();
    for (let n = 0; n <= KEEP_REPORTS; n += 1) {
      at(minute(n));
      await saveReport(db, 1, 'd1', input);
    }
    const kept = await listReports(db, 1, 'd1', 100);
    expect(kept.map((r) => r.created_at).at(-1)).toBe(minute(1));
  });

  it('never drops the reports of another domain', async () => {
    const { db } = empty();
    at(minute(0));
    const other = await saveReport(db, 1, 'd2', input);
    for (let n = 1; n <= KEEP_REPORTS + 1; n += 1) {
      at(minute(n));
      await saveReport(db, 1, 'd1', input);
    }
    expect(await getReport(db, 1, 'd2', other.id)).toBeDefined();
  });
});

describe('listReports', () => {
  /** Three reports of d1 a minute apart, and one of someone else's. */
  async function three() {
    const made = empty();
    for (const n of [1, 2, 3]) {
      at(minute(n));
      await saveReport(made.db, 1, 'd1', input);
    }
    await saveReport(made.db, 2, 'd1', input);
    return made;
  }

  it('lists the newest first, without outcomes', async () => {
    const { db } = await three();
    const found = await listReports(db, 1, 'd1', 10);
    expect(found.map((r) => r.created_at)).toEqual([
      minute(3),
      minute(2),
      minute(1),
    ]);
  });

  it('leaves the outcomes out of a list', async () => {
    const { db } = await three();
    const [first] = await listReports(db, 1, 'd1', 1);
    expect(first).not.toHaveProperty('outcomes');
  });

  it('stops at the limit', async () => {
    const { db } = await three();
    expect(await listReports(db, 1, 'd1', 2)).toHaveLength(2);
  });

  it('carries on after a cursor', async () => {
    const { db } = await three();
    const [, second] = await listReports(db, 1, 'd1', 2);
    const rest = await listReports(db, 1, 'd1', 10, {
      created_at: second!.created_at,
      id: second!.id,
    });
    expect(rest.map((r) => r.created_at)).toEqual([minute(1)]);
  });

  it('orders reports made at the same time by id', async () => {
    const { db } = empty();
    at(minute(1));
    await saveReport(db, 1, 'd1', input);
    await saveReport(db, 1, 'd1', input);
    const [first, second] = await listReports(db, 1, 'd1', 10);
    const after = await listReports(db, 1, 'd1', 10, {
      created_at: first!.created_at,
      id: first!.id,
    });
    expect(after.map((r) => r.id)).toEqual([second!.id]);
  });

  it('shows nobody else’s reports', async () => {
    const { db } = await three();
    expect(await listReports(db, 3, 'd1', 10)).toEqual([]);
  });
});

describe('latestReport', () => {
  it('answers the newest report with its outcomes', async () => {
    const { db } = empty();
    at(minute(1));
    await saveReport(db, 1, 'd1', input);
    at(minute(2));
    const newest = await saveReport(db, 1, 'd1', input);
    expect(await latestReport(db, 1, 'd1')).toEqual(newest);
  });

  it('answers nothing for a domain with no reports', async () => {
    const { db } = empty();
    expect(await latestReport(db, 1, 'd1')).toBeUndefined();
  });

  it('reads outcomes that are not a JSON list as none', async () => {
    const { db, raw } = empty();
    await saveReport(db, 1, 'd1', input);
    raw.prepare("UPDATE reports SET outcomes = '{}'").run();
    expect((await latestReport(db, 1, 'd1'))?.outcomes).toEqual([]);
  });

  it('reads outcomes that are not JSON at all as none', async () => {
    const { db, raw } = empty();
    await saveReport(db, 1, 'd1', input);
    raw.prepare("UPDATE reports SET outcomes = 'nope'").run();
    expect((await latestReport(db, 1, 'd1'))?.outcomes).toEqual([]);
  });
});

describe('getReport', () => {
  it('answers nothing for another person’s report', async () => {
    const { db } = empty();
    const report = await saveReport(db, 1, 'd1', input);
    expect(await getReport(db, 2, 'd1', report.id)).toBeUndefined();
  });

  it('answers nothing for a report of another domain', async () => {
    const { db } = empty();
    const report = await saveReport(db, 1, 'd1', input);
    expect(await getReport(db, 1, 'd2', report.id)).toBeUndefined();
  });
});

describe('deleteReportsOf', () => {
  it('removes every report of the domain', async () => {
    const { db } = empty();
    await saveReport(db, 1, 'd1', input);
    await deleteReportsOf(db, 1, 'd1');
    expect(await listReports(db, 1, 'd1', 10)).toEqual([]);
  });

  it('leaves the reports of other domains', async () => {
    const { db } = empty();
    await saveReport(db, 1, 'd2', input);
    await deleteReportsOf(db, 1, 'd1');
    expect(await listReports(db, 1, 'd2', 10)).toHaveLength(1);
  });

  it('leaves other people’s reports of the same domain id', async () => {
    const { db } = empty();
    await saveReport(db, 2, 'd1', input);
    await deleteReportsOf(db, 1, 'd1');
    expect(await listReports(db, 2, 'd1', 10)).toHaveLength(1);
  });
});

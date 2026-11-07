import { describe, expect, it, jest } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { disableRepo } from '@/domain/db/disabled';
import { saveInstallation, touchInstallation } from '@/domain/db/github';
import { addDomain } from '@/domain/db/domains';
import { listRuns } from '@/domain/db/runs';
import { latestRuns } from '@/domain/db/suite';
import {
  RECHECK_AFTER_MS,
  SCHEDULED_BATCH,
  checkDueSites,
  resyncStaleInstallation,
  scheduled,
} from '@/domain/suite/scheduled';
import type { SuiteRun } from '@/domain/suite/run';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const page = async (): Promise<SuiteRun> => ({
  url: 'https://x.test/',
  status: 200,
  hash: 'h',
  checks: [],
  skipped: [],
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

  it('records its runs as scheduled', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    const { domain } = await addDomain(db, 1, 'a.test', 'acme/a');
    await checkDueSites(db, { run: page, now: () => start });
    expect(
      await listRuns(db, 1, { domainId: domain.id, host: 'a.test' }, 10),
    ).toEqual([expect.objectContaining({ kind: 'scheduled', sha: null })]);
  });

  it('leaves a site alone until six hours have passed', async () => {
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

  it('is due again after six hours', () => {
    expect(RECHECK_AFTER_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('never re-checks a repository whose checks are off', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 1, 'b.test', 'acme/b');
    await disableRepo(db, 1, 'acme/a');
    const outcomes = await checkDueSites(db, { run: page, now: () => start });
    expect(outcomes.map((o) => o.host)).toEqual(['b.test']);
  });

  it('keeps a site due when the scanner failed, so the next trigger tries again', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    const broken = async (): Promise<SuiteRun> => {
      throw new Error('scanner restarting');
    };
    await checkDueSites(db, { run: broken, now: () => start });
    const next = new Date(start.getTime() + 60_000);
    expect(
      await checkDueSites(db, { run: page, now: () => next }),
    ).toHaveLength(1);
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

describe('scheduled', () => {
  it('scans the due sites in the scanner container, and returns once they are checked', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(made.d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    const asked: string[] = [];
    const stream = [
      { type: 'ready', finalUrl: 'https://a.test/', status: 200 },
      {
        type: 'done',
        outcome: {
          id: 'seo-viewport',
          status: 'failed',
          findings: [{ level: 'error', message: 'no viewport' }],
        },
      },
      { type: 'end' },
    ]
      .map((line) => `${JSON.stringify(line)}\n`)
      .join('');
    const env = {
      DB: made.d1,
      SCANNER: {
        idFromName: (name: string) => name,
        get: () => ({
          fetch: async (request: Request) => {
            asked.push(await request.text());
            return new Response(stream);
          },
        }),
      },
    };
    await scheduled({} as ScheduledController, env as never, {} as never);
    expect(asked).toEqual(['{"url":"https://a.test/"}']);
    const [run] = await latestRuns(db, 1, 'a.test', 1);
    expect(run?.findings.map((f) => f.message)).toEqual(['no viewport']);
  });

  it('records nothing for a site when the scanner is not there', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(made.d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await scheduled(
      {} as ScheduledController,
      { DB: made.d1 } as never,
      {} as never,
    );
    expect(await latestRuns(db, 1, 'a.test', 1)).toEqual([]);
  });
});

describe('resyncStaleInstallation', () => {
  const later = new Date(start.getTime() + RECHECK_AFTER_MS + 1000);

  it('reads an installation not read for six hours', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await saveInstallation(db, 7, 99, 'acme');
    await touchInstallation(db, 99, start.toISOString());
    const sync =
      jest.fn<(user: number, installation: number) => Promise<void>>();
    await resyncStaleInstallation(db, sync, () => later);
    expect(sync).toHaveBeenCalledWith(7, 99);
  });

  it('leaves a recently read installation alone', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await saveInstallation(db, 7, 99, 'acme');
    await touchInstallation(db, 99, start.toISOString());
    const sync =
      jest.fn<(user: number, installation: number) => Promise<void>>();
    await resyncStaleInstallation(db, sync, () => start);
    expect(sync).not.toHaveBeenCalled();
  });

  it('does not fail the trigger when GitHub cannot be read', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await saveInstallation(db, 7, 99, 'acme');
    await touchInstallation(db, 99, start.toISOString());
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      resyncStaleInstallation(
        db,
        async () => {
          throw new Error('down');
        },
        () => later,
      ),
    ).resolves.toBeUndefined();
  });

  it('does not try the same failing installation at every trigger', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await saveInstallation(db, 7, 99, 'acme');
    await saveInstallation(db, 7, 100, 'beta');
    await touchInstallation(db, 99, start.toISOString());
    await touchInstallation(
      db,
      100,
      new Date(start.getTime() + 1).toISOString(),
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const sync = jest
      .fn<(user: number, installation: number) => Promise<void>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(undefined);
    await resyncStaleInstallation(db, sync, () => later);
    await resyncStaleInstallation(db, sync, () => later);
    expect(sync.mock.calls).toEqual([
      [7, 99],
      [7, 100],
    ]);
  });
});

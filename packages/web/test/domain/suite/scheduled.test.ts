import { describe, expect, it, jest } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { disableRepo } from '@/domain/db/disabled';
import { saveInstallation, touchInstallation } from '@/domain/db/github';
import { addDomain } from '@/domain/db/domains';
import { putPending } from '@/domain/db/pending-scans';
import { latestRuns, markTried } from '@/domain/db/suite';
import {
  RECHECK_AFTER_MS,
  SCHEDULED_BATCH,
  enqueueDueSites,
  resyncStaleInstallation,
  scheduled,
} from '@/domain/suite/scheduled';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

/** A queue that keeps what it is sent. */
const queue = () => {
  const sent: { key: string; seq: number }[] = [];
  return {
    sent,
    send: async (message: { key: string; seq: number }) => {
      sent.push(message);
    },
  };
};

const start = new Date('2026-01-01T00:00:00.000Z');

describe('enqueueDueSites', () => {
  it('leaves a re-check of each site found through GitHub that was never checked', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 1, 'by-hand.test');
    const q = queue();
    expect(await enqueueDueSites(db, q, { now: () => start })).toBe(1);
    expect(q.sent).toEqual([{ key: 'site:1:a.test', seq: 1 }]);
  });

  it('does not send a site that is already waiting again', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    const q = queue();
    await enqueueDueSites(db, q, { now: () => start });
    const soon = new Date(start.getTime() + 600_000);
    expect(await enqueueDueSites(db, q, { now: () => soon })).toBe(0);
    expect(q.sent).toHaveLength(1);
  });

  it('leaves a site alone while it was checked less than six hours ago', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    await markTried(db, 1, 'a.test', start.toISOString());
    const q = queue();
    const soon = new Date(start.getTime() + RECHECK_AFTER_MS - 1);
    expect(await enqueueDueSites(db, q, { now: () => soon })).toBe(0);
    const later = new Date(start.getTime() + RECHECK_AFTER_MS + 1);
    expect(await enqueueDueSites(db, q, { now: () => later })).toBe(1);
  });

  it('is due again after six hours', () => {
    expect(RECHECK_AFTER_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('never re-checks a repository whose checks are off', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 1, 'b.test', 'acme/b');
    await disableRepo(db, 1, 'acme/a');
    const q = queue();
    await enqueueDueSites(db, q, { now: () => start });
    expect(q.sent.map((m) => m.key)).toEqual(['site:1:b.test']);
  });

  it('takes only a batch of sites at a time', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    for (let i = 0; i < SCHEDULED_BATCH + 2; i += 1) {
      await addDomain(db, 1, `h${i}.test`, 'acme/a');
    }
    const q = queue();
    expect(await enqueueDueSites(db, q, { now: () => start })).toBe(
      SCHEDULED_BATCH,
    );
    expect(await enqueueDueSites(db, q, { now: () => start, batch: 2 })).toBe(
      0,
    );
  });

  it('logs and goes on when a site cannot be queued', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    expect(await enqueueDueSites(db, undefined, { now: () => start })).toBe(0);
    expect(spy).toHaveBeenCalledWith(
      're-check not queued',
      'a.test',
      expect.anything(),
    );
  });
});

describe('scheduled', () => {
  it('queues the due sites and returns without scanning', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(made.d1);
    await addDomain(db, 1, 'a.test', 'acme/a');
    const q = queue();
    await scheduled(
      {} as ScheduledController,
      { DB: made.d1, SCAN_QUEUE: q } as never,
      {} as never,
    );
    expect(q.sent).toEqual([{ key: 'site:1:a.test', seq: 1 }]);
    expect(await latestRuns(db, 1, 'a.test', 1)).toEqual([]);
  });

  it('sends a job again that has waited for hours', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(made.d1);
    await putPending(db, 'deploy:acme/a', '{}', '2020-01-01T00:00:00.000Z', {
      force: true,
      staleBefore: '2019-01-01T00:00:00.000Z',
    });
    const q = queue();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await scheduled(
      {} as ScheduledController,
      { DB: made.d1, SCAN_QUEUE: q } as never,
      {} as never,
    );
    expect(q.sent).toEqual([{ key: 'deploy:acme/a', seq: 1 }]);
  });

  it('does not fail when no queue is bound', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    await addDomain(createDatabase(made.d1), 1, 'a.test', 'acme/a');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      scheduled(
        {} as ScheduledController,
        { DB: made.d1 } as never,
        {} as never,
      ),
    ).resolves.toBeUndefined();
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

import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { saveReport } from '@/domain/db/reports';
import {
  getRun,
  lastManualRunAt,
  listRuns,
  suiteRunId,
  suiteRunNumber,
} from '@/domain/db/runs';
import { recordRun } from '@/domain/db/suite';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const setup = async () => {
  const made = sqliteD1(...APP_MIGRATIONS);
  const db = createDatabase(made.d1);
  const { domain } = await addDomain(db, 1, 'site.example.com', 'acme/site');
  return { db, domain, site: { domainId: domain.id, host: domain.host } };
};

const counts = { passed: 200, warned: 3, failed: 2, skipped: 1 };
const outcomes = JSON.stringify([
  { id: 'hsts', status: 'passed', findings: [] },
]);

const server = (
  at: string,
  extra: Partial<Parameters<typeof recordRun>[1]> = {},
) => ({
  userId: 1,
  host: 'site.example.com',
  repo: 'acme/site',
  sha: 'a'.repeat(40),
  status: 200,
  hash: 'h',
  findings: [],
  counts,
  outcomes,
  ...extra,
  at,
});

/** Record a server run made at `at`. */
const record = async (
  db: ReturnType<typeof createDatabase>,
  at: string,
  extra?: Partial<Parameters<typeof recordRun>[1]>,
) => {
  const { at: when, ...run } = server(at, extra);
  await recordRun(db, run, when);
};

/** Save a manual report and move its time to `at`. */
const manual = async (
  made: Awaited<ReturnType<typeof setup>>,
  at: string,
  sha: string | null = null,
) => {
  const report = await saveReport(
    made.db,
    1,
    made.domain.id,
    { url: 'https://site.example.com/', outcomes: [], ...counts },
    sha,
  );
  await made.db.$client
    .prepare('UPDATE reports SET created_at = ? WHERE id = ?')
    .bind(at, report.id)
    .run();
  return report.id;
};

describe('suiteRunId and suiteRunNumber', () => {
  it('write a server run as s and its number and read it back', () => {
    expect(suiteRunId(12)).toBe('s12');
    expect(suiteRunNumber('s12')).toBe(12);
  });

  it('read nothing from an id that is not one', () => {
    for (const id of ['', 's', 's0', 's01', 's1x', '12', 'S1', 's-1']) {
      expect(suiteRunNumber(id)).toBeUndefined();
    }
  });
});

describe('listRuns', () => {
  it('lists manual and server runs together, newest first, with how each started', async () => {
    const made = await setup();
    await record(made.db, '2026-01-01T10:00:00.000Z', { kind: 'deployment' });
    const reportId = await manual(
      made,
      '2026-01-01T11:00:00.000Z',
      'b'.repeat(40),
    );
    await record(made.db, '2026-01-01T12:00:00.000Z', { kind: 'scheduled' });
    await record(made.db, '2026-01-01T13:00:00.000Z', { kind: 'config' });
    const runs = await listRuns(made.db, 1, made.site, 10);
    expect(runs.map((r) => [r.kind, r.ran_at.slice(11, 13)])).toEqual([
      ['config', '13'],
      ['scheduled', '12'],
      ['manual', '11'],
      ['deployment', '10'],
    ]);
    expect(runs[2]).toEqual({
      id: reportId,
      kind: 'manual',
      ran_at: '2026-01-01T11:00:00.000Z',
      sha: 'b'.repeat(40),
      ...counts,
      openable: true,
    });
    expect(runs[3]?.id).toMatch(/^s\d+$/);
    expect(runs[3]).toMatchObject({ sha: 'a'.repeat(40), ...counts });
  });

  it('pages: each page starts after the last run of the one before, nothing twice or missed', async () => {
    const made = await setup();
    for (let hour = 10; hour < 15; hour += 1) {
      await record(made.db, `2026-01-01T${hour}:00:00.000Z`);
      await manual(made, `2026-01-01T${hour}:30:00.000Z`);
    }
    const seen: string[] = [];
    let after: { ran_at: string; id: string } | undefined;
    for (let pages = 0; pages < 10; pages += 1) {
      const items = await listRuns(made.db, 1, made.site, 3, after);
      seen.push(...items.map((r) => r.id));
      const last = items.at(-1);
      if (items.length < 3 || !last) {
        break;
      }
      after = { ran_at: last.ran_at, id: last.id };
    }
    const all = await listRuns(made.db, 1, made.site, 50);
    expect(all).toHaveLength(10);
    expect(seen).toEqual(all.map((r) => r.id));
    expect(new Set(seen).size).toBe(10);
  });

  it('says a run is not openable when it kept no outcomes, and null for a count it did not keep', async () => {
    const made = await setup();
    await record(made.db, '2026-01-01T10:00:00.000Z', {
      counts: null,
      outcomes: null,
    });
    const [run] = await listRuns(made.db, 1, made.site, 10);
    expect(run).toMatchObject({
      openable: false,
      passed: null,
      warned: null,
      failed: null,
      skipped: null,
    });
  });

  it('keeps one person’s runs, and another site’s, out of the list', async () => {
    const made = await setup();
    await record(made.db, '2026-01-01T10:00:00.000Z');
    await record(made.db, '2026-01-01T10:00:00.000Z', { userId: 2 });
    await record(made.db, '2026-01-01T10:00:00.000Z', { host: 'other.test' });
    expect(await listRuns(made.db, 1, made.site, 10)).toHaveLength(1);
    expect(await listRuns(made.db, 3, made.site, 10)).toEqual([]);
  });
});

describe('getRun', () => {
  it('reads a manual run and a server run with their outcomes', async () => {
    const made = await setup();
    const reportId = await manual(made, '2026-01-01T11:00:00.000Z');
    await record(made.db, '2026-01-01T12:00:00.000Z', { kind: 'scheduled' });
    const [newest] = await listRuns(made.db, 1, made.site, 1);
    const server = await getRun(made.db, 1, made.site, newest?.id ?? '');
    expect(server).toMatchObject({
      kind: 'scheduled',
      url: 'https://site.example.com/',
      outcomes: [{ id: 'hsts', status: 'passed', findings: [] }],
    });
    const saved = await getRun(made.db, 1, made.site, reportId);
    expect(saved).toMatchObject({ kind: 'manual', outcomes: [] });
  });

  it('finds nothing for a run of someone else, of another site, one without outcomes or one that is not there', async () => {
    const made = await setup();
    await record(made.db, '2026-01-01T10:00:00.000Z', { outcomes: null });
    const [run] = await listRuns(made.db, 1, made.site, 1);
    expect(await getRun(made.db, 1, made.site, run?.id ?? '')).toBeUndefined();
    await record(made.db, '2026-01-01T11:00:00.000Z');
    const [kept] = await listRuns(made.db, 1, made.site, 1);
    expect(await getRun(made.db, 2, made.site, kept?.id ?? '')).toBeUndefined();
    expect(
      await getRun(
        made.db,
        1,
        { ...made.site, host: 'other.test' },
        kept?.id ?? '',
      ),
    ).toBeUndefined();
    expect(await getRun(made.db, 1, made.site, 's999')).toBeUndefined();
    expect(await getRun(made.db, 1, made.site, 'nope')).toBeUndefined();
  });
});

describe('lastManualRunAt', () => {
  it('is the time of the newest manual run, or nothing', async () => {
    const made = await setup();
    expect(await lastManualRunAt(made.db, 1, made.domain.id)).toBeUndefined();
    await manual(made, '2026-01-01T11:00:00.000Z');
    await manual(made, '2026-01-01T13:00:00.000Z');
    await record(made.db, '2026-01-01T15:00:00.000Z');
    expect(await lastManualRunAt(made.db, 1, made.domain.id)).toBe(
      '2026-01-01T13:00:00.000Z',
    );
    expect(await lastManualRunAt(made.db, 2, made.domain.id)).toBeUndefined();
  });
});

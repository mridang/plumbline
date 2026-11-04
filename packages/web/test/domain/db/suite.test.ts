import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import {
  RUNS_KEPT,
  claimDelivery,
  CLAIM_MS,
  claimNewIssue,
  dueSites,
  forgetIssue,
  issueNumbered,
  issueOf,
  latestRuns,
  recordRun,
  releaseIssueClaim,
  saveIssue,
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

describe('the fingerprint of the rules of a run', () => {
  it('is stored with the run, and is null for a run that gave none', async () => {
    const db = database();
    await recordRun(db, { ...run('a.test'), rules: 'abc123' });
    await recordRun(db, run('b.test'));
    expect((await latestRuns(db, 1, 'a.test'))[0]?.rules).toBe('abc123');
    expect((await latestRuns(db, 1, 'b.test'))[0]?.rules).toBeNull();
  });
});

describe('issueOf, saveIssue, issueNumbered and forgetIssue', () => {
  const issue = (
    number: number,
    state: 'open' | 'fixed' | 'dismissed',
    signature = 's',
  ) => ({
    number,
    state,
    signature,
  });

  it('know nothing of a host that has no issue', async () => {
    expect(await issueOf(database(), 'acme/site', 'a.test')).toBeUndefined();
  });

  it('remember the issue of a host of a repository, with its state and signature', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'a.test', issue(7, 'open', 'abc'));
    expect(await issueOf(db, 'acme/site', 'a.test')).toEqual(
      issue(7, 'open', 'abc'),
    );
  });

  it('replace the issue when the host gets another, and record how it ended', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'a.test', issue(7, 'open'));
    await saveIssue(db, 'acme/site', 'a.test', issue(7, 'fixed'));
    expect((await issueOf(db, 'acme/site', 'a.test'))?.state).toBe('fixed');
    await saveIssue(db, 'acme/site', 'a.test', issue(9, 'dismissed'));
    expect(await issueOf(db, 'acme/site', 'a.test')).toEqual(
      issue(9, 'dismissed'),
    );
  });

  it('keep the issues of other hosts and repositories apart', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'a.test', issue(1, 'open'));
    await saveIssue(db, 'acme/site', 'b.test', issue(2, 'open'));
    await saveIssue(db, 'acme/other', 'a.test', issue(3, 'fixed'));
    expect((await issueOf(db, 'acme/site', 'b.test'))?.number).toBe(2);
    expect((await issueOf(db, 'acme/other', 'a.test'))?.number).toBe(3);
    expect((await issueOf(db, 'acme/site', 'a.test'))?.number).toBe(1);
  });

  it('find an issue by its number in a repository, with the host it is about', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'a.test', issue(1, 'open'));
    await saveIssue(db, 'acme/other', 'b.test', issue(1, 'open'));
    expect(await issueNumbered(db, 'acme/site', 1)).toMatchObject({
      host: 'a.test',
    });
    expect(await issueNumbered(db, 'acme/other', 1)).toMatchObject({
      host: 'b.test',
    });
    expect(await issueNumbered(db, 'acme/site', 2)).toBeUndefined();
  });

  it('forget one issue and keep the rest', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'a.test', issue(1, 'open'));
    await saveIssue(db, 'acme/site', 'b.test', issue(2, 'open'));
    await forgetIssue(db, 'acme/site', 1);
    expect(await issueOf(db, 'acme/site', 'a.test')).toBeUndefined();
    expect(await issueOf(db, 'acme/site', 'b.test')).toBeDefined();
  });
});

describe('claimNewIssue and releaseIssueClaim', () => {
  const then = new Date('2026-01-01T00:00:00.000Z');

  it('gives the right to open an issue to one claimant only', async () => {
    const db = database();
    expect(await claimNewIssue(db, 'acme/site', 'a.test', then)).toBe(true);
    expect(await claimNewIssue(db, 'acme/site', 'a.test', then)).toBe(false);
    expect((await issueOf(db, 'acme/site', 'a.test'))?.state).toBe('opening');
  });

  it('does not claim for a host that already has an issue', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'a.test', {
      number: 1,
      state: 'open',
      signature: 's',
    });
    expect(await claimNewIssue(db, 'acme/site', 'a.test', then)).toBe(false);
    expect((await issueOf(db, 'acme/site', 'a.test'))?.number).toBe(1);
  });

  it('keeps hosts and repositories apart', async () => {
    const db = database();
    expect(await claimNewIssue(db, 'acme/site', 'a.test', then)).toBe(true);
    expect(await claimNewIssue(db, 'acme/site', 'b.test', then)).toBe(true);
    expect(await claimNewIssue(db, 'acme/other', 'a.test', then)).toBe(true);
  });

  it('holds until CLAIM_MS has passed and is taken over from then on', async () => {
    const db = database();
    await claimNewIssue(db, 'acme/site', 'a.test', then);
    expect(
      await claimNewIssue(
        db,
        'acme/site',
        'a.test',
        new Date(then.getTime() + CLAIM_MS - 1),
      ),
    ).toBe(false);
    expect(
      await claimNewIssue(
        db,
        'acme/site',
        'a.test',
        new Date(then.getTime() + CLAIM_MS),
      ),
    ).toBe(true);
  });

  it('can be given up, and then it can be claimed again', async () => {
    const db = database();
    await claimNewIssue(db, 'acme/site', 'a.test', then);
    await releaseIssueClaim(db, 'acme/site', 'a.test');
    expect(await issueOf(db, 'acme/site', 'a.test')).toBeUndefined();
    expect(await claimNewIssue(db, 'acme/site', 'a.test', then)).toBe(true);
  });

  it('never gives up a real issue', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'a.test', {
      number: 3,
      state: 'open',
      signature: 's',
    });
    await releaseIssueClaim(db, 'acme/site', 'a.test');
    expect((await issueOf(db, 'acme/site', 'a.test'))?.number).toBe(3);
  });
});

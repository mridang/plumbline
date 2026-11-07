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
  issuesOfHost,
  latestRuns,
  legacyIssueOf,
  legacyIssuesOf,
  openIssuesOf,
  recordRun,
  releaseIssueClaim,
  retireLegacyIssue,
  saveIssue,
} from '@/domain/db/suite';
import {
  disableRepo,
  disableRepoByFile,
  enableRepo,
  enableRepoByFile,
} from '@/domain/db/disabled';
import { issuesOf as historyOf } from '@/domain/db/issue-history';

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

describe('recordRun, the history columns and latestRuns', () => {
  it('stores how a run started, its counts and its outcomes, and does not read the outcomes back with the runs', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(made.d1);
    await recordRun(db, {
      ...run('a.test'),
      kind: 'scheduled',
      counts: { passed: 1, warned: 2, failed: 3, skipped: 4 },
      outcomes: '[{"id":"x"}]',
    });
    expect(
      made.raw
        .prepare(
          'SELECT kind, passed, warned, failed, skipped, outcomes FROM suite_runs',
        )
        .get(),
    ).toEqual({
      kind: 'scheduled',
      passed: 1,
      warned: 2,
      failed: 3,
      skipped: 4,
      outcomes: '[{"id":"x"}]',
    });
    expect((await latestRuns(db, 1, 'a.test'))[0]).not.toHaveProperty(
      'outcomes',
    );
  });

  it('stores a deployment with no counts or outcomes when none are given', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    await recordRun(createDatabase(made.d1), run('a.test'));
    expect(
      made.raw.prepare('SELECT kind, passed, outcomes FROM suite_runs').get(),
    ).toEqual({ kind: 'deployment', passed: null, outcomes: null });
  });

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

  it('leaves out the sites of a repository whose checks are off', async () => {
    const db = database();
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 1, 'b.test', 'acme/b');
    await disableRepo(db, 1, 'acme/a');
    expect((await dueSites(db, cutoff, 10)).map((s) => s.host)).toEqual([
      'b.test',
    ]);
    await enableRepo(db, 'acme/a');
    expect(await dueSites(db, cutoff, 10)).toHaveLength(2);
  });

  it('leaves out the sites of a repository whose file turns checks off, until it does not', async () => {
    const db = database();
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 1, 'b.test', 'acme/b');
    await disableRepoByFile(db, 'acme/a');
    expect((await dueSites(db, cutoff, 10)).map((s) => s.host)).toEqual([
      'b.test',
    ]);
    await enableRepoByFile(db, 'acme/a');
    expect(await dueSites(db, cutoff, 10)).toHaveLength(2);
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

const SITE = 'acme/site';
const A = 'a.test';

describe('the issue of a check: issueOf, saveIssue, issueNumbered and forgetIssue', () => {
  const issue = (
    number: number,
    state: 'open' | 'fixed' | 'dismissed',
    signature = 's',
    reopens = 0,
  ) => ({ number, state, signature, reopens });

  it('know nothing of a check that has no issue', async () => {
    expect(await issueOf(database(), SITE, A, 'seo-viewport')).toBeUndefined();
  });

  it('remember the issue of a check of a host, with its state, signature and reopens', async () => {
    const db = database();
    await saveIssue(db, SITE, A, 'seo-viewport', issue(7, 'open', 'abc', 2));
    expect(await issueOf(db, SITE, A, 'seo-viewport')).toEqual(
      issue(7, 'open', 'abc', 2),
    );
  });

  it('keep an issue for each check of a host, and the same check of two hosts apart (a monorepo)', async () => {
    const db = database();
    await saveIssue(db, SITE, A, 'seo-viewport', issue(1, 'open'));
    await saveIssue(db, SITE, A, 'seo-links', issue(2, 'open'));
    await saveIssue(db, SITE, 'b.test', 'seo-viewport', issue(3, 'open'));
    await saveIssue(db, 'acme/other', A, 'seo-viewport', issue(4, 'fixed'));
    expect((await issueOf(db, SITE, A, 'seo-viewport'))?.number).toBe(1);
    expect((await issueOf(db, SITE, A, 'seo-links'))?.number).toBe(2);
    expect((await issueOf(db, SITE, 'b.test', 'seo-viewport'))?.number).toBe(3);
    expect((await issueOf(db, 'acme/other', A, 'seo-viewport'))?.number).toBe(
      4,
    );
    const ofHost = await issuesOfHost(db, SITE, A);
    expect([...ofHost.keys()].toSorted()).toEqual([
      'seo-links',
      'seo-viewport',
    ]);
  });

  it('replace the issue of a check when it gets another, and record each in the history', async () => {
    const db = database();
    await saveIssue(db, SITE, A, 'seo-viewport', issue(7, 'open'));
    await saveIssue(db, SITE, A, 'seo-viewport', issue(7, 'fixed'));
    expect((await issueOf(db, SITE, A, 'seo-viewport'))?.state).toBe('fixed');
    await saveIssue(db, SITE, A, 'seo-viewport', issue(9, 'dismissed'));
    expect(await issueOf(db, SITE, A, 'seo-viewport')).toEqual(
      issue(9, 'dismissed'),
    );
    expect(
      (await historyOf(db, SITE, A)).map((i) => [i.number, i.state, i.checks]),
    ).toEqual(
      expect.arrayContaining([
        [7, 'fixed', ['seo-viewport']],
        [9, 'dismissed', ['seo-viewport']],
      ]),
    );
  });

  it('list the open issues of a repository with the host and check of each', async () => {
    const db = database();
    await saveIssue(db, SITE, 'b.test', 'seo-links', issue(2, 'open'));
    await saveIssue(db, SITE, A, 'seo-viewport', issue(1, 'open'));
    await saveIssue(db, SITE, A, 'seo-links', issue(3, 'fixed'));
    await saveIssue(db, 'acme/other', A, 'seo-links', issue(4, 'open'));
    expect(
      (await openIssuesOf(db, SITE)).map((i) => [i.host, i.check, i.number]),
    ).toEqual([
      [A, 'seo-viewport', 1],
      ['b.test', 'seo-links', 2],
    ]);
  });

  it('find an issue by its number in a repository, with the host and check it is about', async () => {
    const db = database();
    await saveIssue(db, SITE, A, 'seo-viewport', issue(1, 'open'));
    await saveIssue(db, 'acme/other', 'b.test', 'seo-links', issue(1, 'open'));
    expect(await issueNumbered(db, SITE, 1)).toMatchObject({
      host: A,
      check: 'seo-viewport',
    });
    expect(await issueNumbered(db, 'acme/other', 1)).toMatchObject({
      host: 'b.test',
      check: 'seo-links',
    });
    expect(await issueNumbered(db, SITE, 2)).toBeUndefined();
  });

  it('forget one issue and keep the rest', async () => {
    const db = database();
    await saveIssue(db, SITE, A, 'seo-viewport', issue(1, 'open'));
    await saveIssue(db, SITE, A, 'seo-links', issue(2, 'open'));
    await forgetIssue(db, SITE, 1);
    expect(await issueOf(db, SITE, A, 'seo-viewport')).toBeUndefined();
    expect(await issueOf(db, SITE, A, 'seo-links')).toBeDefined();
  });

  it('read a state it does not know as open', async () => {
    const made = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(made.d1);
    made.raw
      .prepare(
        "INSERT INTO suite_check_issues (repo, host, check_id, number, state, signature) VALUES ('acme/site', 'a.test', 'x', 5, 'weird', '')",
      )
      .run();
    expect((await issueOf(db, SITE, A, 'x'))?.state).toBe('open');
  });
});

describe('claimNewIssue and releaseIssueClaim', () => {
  const then = new Date('2026-01-01T00:00:00.000Z');
  const CHECK = 'seo-viewport';

  it('gives the right to open an issue to one claimant only', async () => {
    const db = database();
    expect(await claimNewIssue(db, SITE, A, CHECK, then)).toBe(true);
    expect(await claimNewIssue(db, SITE, A, CHECK, then)).toBe(false);
    expect((await issueOf(db, SITE, A, CHECK))?.state).toBe('opening');
  });

  it('does not claim for a check that already has an issue', async () => {
    const db = database();
    await saveIssue(db, SITE, A, CHECK, {
      number: 1,
      state: 'open',
      signature: 's',
      reopens: 0,
    });
    expect(await claimNewIssue(db, SITE, A, CHECK, then)).toBe(false);
    expect((await issueOf(db, SITE, A, CHECK))?.number).toBe(1);
  });

  it('keeps checks, hosts and repositories apart', async () => {
    const db = database();
    expect(await claimNewIssue(db, SITE, A, CHECK, then)).toBe(true);
    expect(await claimNewIssue(db, SITE, A, 'seo-links', then)).toBe(true);
    expect(await claimNewIssue(db, SITE, 'b.test', CHECK, then)).toBe(true);
    expect(await claimNewIssue(db, 'acme/other', A, CHECK, then)).toBe(true);
  });

  it('holds until CLAIM_MS has passed and is taken over from then on', async () => {
    const db = database();
    await claimNewIssue(db, SITE, A, CHECK, then);
    expect(
      await claimNewIssue(
        db,
        SITE,
        A,
        CHECK,
        new Date(then.getTime() + CLAIM_MS - 1),
      ),
    ).toBe(false);
    expect(
      await claimNewIssue(
        db,
        SITE,
        A,
        CHECK,
        new Date(then.getTime() + CLAIM_MS),
      ),
    ).toBe(true);
  });

  it('can be given up, and then it can be claimed again', async () => {
    const db = database();
    await claimNewIssue(db, SITE, A, CHECK, then);
    await releaseIssueClaim(db, SITE, A, CHECK);
    expect(await issueOf(db, SITE, A, CHECK)).toBeUndefined();
    expect(await claimNewIssue(db, SITE, A, CHECK, then)).toBe(true);
  });

  it('never gives up a real issue', async () => {
    const db = database();
    await saveIssue(db, SITE, A, CHECK, {
      number: 3,
      state: 'open',
      signature: 's',
      reopens: 0,
    });
    await releaseIssueClaim(db, SITE, A, CHECK);
    expect((await issueOf(db, SITE, A, CHECK))?.number).toBe(3);
  });
});

describe('the issues of the old kind, one for each host', () => {
  /** A database holding an issue of the old kind, as migration 0016 left it. */
  function withLegacy() {
    const made = sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(made.d1);
    made.raw
      .prepare(
        "INSERT INTO suite_issues (repo, host, number, state, signature) VALUES ('acme/site', 'a.test', 12, 'open', 'sig'), ('acme/site', 'b.test', 13, 'dismissed', 'sig'), ('acme/other', 'a.test', 14, 'open', 'sig')",
      )
      .run();
    made.raw
      .prepare(
        "INSERT INTO suite_issue_history (repo, host, number, state, opened_at, checks) VALUES ('acme/site', 'a.test', 12, 'open', '2026-01-01T00:00:00.000Z', '[\"x\",\"y\"]')",
      )
      .run();
    return { made, db };
  }

  it('are found by host and by repository', async () => {
    const { db } = withLegacy();
    expect(await legacyIssueOf(db, SITE, A)).toEqual({
      number: 12,
      state: 'open',
    });
    expect(await legacyIssueOf(db, SITE, 'c.test')).toBeUndefined();
    expect(
      (await legacyIssuesOf(db, SITE)).map((i) => [i.host, i.number]),
    ).toEqual([
      [A, 12],
      ['b.test', 13],
    ]);
  });

  it('are retired: forgotten, and left out of the history list', async () => {
    const { db } = withLegacy();
    expect(await historyOf(db, SITE, A)).toHaveLength(1);
    await retireLegacyIssue(db, SITE, A, 12);
    expect(await legacyIssueOf(db, SITE, A)).toBeUndefined();
    expect(await legacyIssueOf(db, 'acme/other', A)).toBeDefined();
    expect(await historyOf(db, SITE, A)).toEqual([]);
  });

  it('are forgotten when GitHub says the issue was deleted', async () => {
    const { db } = withLegacy();
    await forgetIssue(db, SITE, 12);
    expect(await legacyIssueOf(db, SITE, A)).toBeUndefined();
  });
});

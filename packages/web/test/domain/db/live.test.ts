import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { ACCESS_TTL_MS, replaceAccess } from '@/domain/db/access';
import { addDomain } from '@/domain/db/domains';
import { recordRun, saveIssue } from '@/domain/db/suite';
import {
  KEEP_EVENTS,
  STALE_CHECK_MS,
  appendEvent,
  markChecked,
  markChecking,
  overviewOf,
  stateOf,
} from '@/domain/db/live';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const made = () => {
  const { d1, raw } = sqliteD1(...APP_MIGRATIONS);
  return { db: createDatabase(d1), raw };
};

const NOW = Date.parse('2026-01-01T00:10:00.000Z');

describe('appendEvent', () => {
  it('numbers events in order and keeps their text', async () => {
    const { db, raw } = made();
    const first = await appendEvent(db, 1, { type: 'a' });
    const second = await appendEvent(db, 1, { type: 'b' });
    expect(second).toBeGreaterThan(first);
    expect(
      raw.prepare('SELECT payload FROM live_events ORDER BY id').all(),
    ).toEqual([{ payload: '{"type":"a"}' }, { payload: '{"type":"b"}' }]);
  });

  it('keeps only the newest events of a person and leaves other people alone', async () => {
    const { db, raw } = made();
    await appendEvent(db, 2, { other: true });
    for (let n = 0; n < KEEP_EVENTS + 20; n += 1) {
      await appendEvent(db, 1, { n });
    }
    const mine = raw
      .prepare('SELECT COUNT(*) AS n FROM live_events WHERE user_id = 1')
      .get();
    expect(Number(mine?.['n'])).toBeLessThanOrEqual(KEEP_EVENTS + 1);
    expect(Number(mine?.['n'])).toBeGreaterThan(KEEP_EVENTS - 1);
    expect(
      raw
        .prepare('SELECT COUNT(*) AS n FROM live_events WHERE user_id = 2')
        .get(),
    ).toEqual({ n: 1 });
  });
});

describe('stateOf', () => {
  const row = (over: Partial<Parameters<typeof stateOf>[0]> = {}) => ({
    checking_since: null,
    errors: 0,
    warnings: 0,
    reachable: 1,
    ...over,
  });

  it('is running while a recent check is under way', () => {
    expect(
      stateOf(row({ checking_since: new Date(NOW - 1000).toISOString() }), NOW),
    ).toBe('running');
  });

  it('does not wait for a check that began long ago and never ended', () => {
    expect(
      stateOf(
        row({
          checking_since: new Date(NOW - STALE_CHECK_MS - 1).toISOString(),
        }),
        NOW,
      ),
    ).toBe('ok');
  });

  it('tells apart every other state', () => {
    expect(stateOf(row({ errors: null }), NOW)).toBe('unchecked');
    expect(stateOf(row({ errors: null, reachable: 0 }), NOW)).toBe(
      'unreachable',
    );
    expect(stateOf(row({ reachable: 0 }), NOW)).toBe('unreachable');
    expect(stateOf(row({ errors: 1 }), NOW)).toBe('failing');
    expect(stateOf(row({ warnings: 1 }), NOW)).toBe('warning');
    expect(stateOf(row(), NOW)).toBe('ok');
  });
});

describe('markChecking, markChecked and overviewOf', () => {
  it('follows a check from unchecked, to running, to what it found', async () => {
    const { db } = made();
    await addDomain(db, 1, 'a.test', 'acme/site');
    const before = await overviewOf(db, 1, NOW);
    expect(before[0]?.sites[0]?.state).toBe('unchecked');

    await markChecking(db, 1, 'a.test', new Date(NOW).toISOString());
    const during = await overviewOf(db, 1, NOW);
    expect(during[0]?.sites[0]?.state).toBe('running');

    await markChecked(db, 1, 'a.test', {
      counts: { errors: 2, warnings: 1, hints: 5 },
      at: 't',
    });
    const after = await overviewOf(db, 1, NOW);
    expect(after[0]?.sites[0]).toMatchObject({
      state: 'failing',
      errors: 2,
      warnings: 1,
      hints: 5,
    });
  });

  it('records a site that did not answer without losing the last counts', async () => {
    const { db } = made();
    await addDomain(db, 1, 'a.test');
    await markChecked(db, 1, 'a.test', {
      counts: { errors: 0, warnings: 0, hints: 0 },
      at: 't',
    });
    await markChecked(db, 1, 'a.test', { counts: null, at: 't2' });
    const overview = await overviewOf(db, 1, NOW);
    expect(overview[0]?.sites[0]?.state).toBe('unreachable');
  });

  it('groups sites by repository, with the ones added by hand last', async () => {
    const { db } = made();
    await addDomain(db, 1, 'hand.test');
    await addDomain(db, 1, 'b.test', 'acme/b');
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 2, 'theirs.test', 'acme/c');
    const overview = await overviewOf(db, 1, NOW);
    expect(overview.map((r) => r.repo)).toEqual(['acme/a', 'acme/b', null]);
  });
});

describe('overviewOf, for people who can see a repository on GitHub', () => {
  const granted = (offset = 0) => new Date(NOW + offset).toISOString();

  it('shows the sites of the repositories they can see, not only their own', async () => {
    const { db } = made();
    await addDomain(db, 1, 'owner.test', 'acme/site');
    await addDomain(db, 1, 'other.test', 'acme/private');
    await addDomain(db, 2, 'mine.test');
    await replaceAccess(db, 2, ['acme/site'], granted());
    const overview = await overviewOf(db, 2, NOW);
    expect(overview.map((r) => r.repo)).toEqual(['acme/site', null]);
    expect(overview[0]?.sites.map((s) => [s.host, s.mine])).toEqual([
      ['owner.test', false],
    ]);
    expect(overview[1]?.sites.map((s) => [s.host, s.mine])).toEqual([
      ['mine.test', true],
    ]);
  });

  it('shows the person who added a site their own site, with or without access', async () => {
    const { db } = made();
    await addDomain(db, 1, 'owner.test', 'acme/site');
    const [repo] = await overviewOf(db, 1, NOW);
    expect(repo?.sites[0]?.mine).toBe(true);
  });

  it('shows nothing of a repository they cannot see', async () => {
    const { db } = made();
    await addDomain(db, 1, 'owner.test', 'acme/site');
    await replaceAccess(db, 2, ['acme/other'], granted());
    expect(await overviewOf(db, 2, NOW)).toEqual([]);
  });

  it('stops showing a repository once what GitHub said is too old', async () => {
    const { db } = made();
    await addDomain(db, 1, 'owner.test', 'acme/site');
    await replaceAccess(db, 2, ['acme/site'], granted());
    expect(await overviewOf(db, 2, NOW + ACCESS_TTL_MS - 1)).toHaveLength(1);
    expect(await overviewOf(db, 2, NOW + ACCESS_TTL_MS + 1)).toEqual([]);
  });

  it('shows a site once, however it is reachable', async () => {
    const { db } = made();
    await addDomain(db, 1, 'owner.test', 'acme/site');
    await replaceAccess(db, 1, ['acme/site'], granted());
    const [repo] = await overviewOf(db, 1, NOW);
    expect(repo?.sites).toHaveLength(1);
  });
});

describe('overviewOf, with the last deployment and the open issues', () => {
  const run = (
    db: ReturnType<typeof made>['db'],
    host: string,
    sha: string,
    at: string,
    kind: 'deployment' | 'scheduled' = 'deployment',
    userId = 1,
  ) =>
    recordRun(
      db,
      {
        userId,
        host,
        repo: 'acme/site',
        sha,
        status: 200,
        hash: 'h',
        findings: [],
        kind,
      },
      at,
    );

  it('gives each site the time and commit of its latest deployment', async () => {
    const { db } = made();
    await addDomain(db, 1, 'a.test', 'acme/site');
    await addDomain(db, 1, 'b.test', 'acme/site');
    await run(db, 'a.test', 'aaaaaaa1', '2026-01-01T00:00:00.000Z');
    await run(db, 'a.test', 'aaaaaaa2', '2026-01-01T01:00:00.000Z');
    const [repo] = await overviewOf(db, 1, NOW);
    expect(
      repo?.sites
        .map((s) => [s.host, s.deployed_at, s.sha])
        .toSorted(([a], [b]) => String(a).localeCompare(String(b))),
    ).toEqual([
      ['a.test', '2026-01-01T01:00:00.000Z', 'aaaaaaa2'],
      ['b.test', null, null],
    ]);
  });

  it('leaves a scheduled re-check out: it is not a deployment', async () => {
    const { db } = made();
    await addDomain(db, 1, 'a.test', 'acme/site');
    await run(db, 'a.test', 'old1234', '2026-01-01T00:00:00.000Z');
    await run(db, 'a.test', 'newer12', '2026-01-01T05:00:00.000Z', 'scheduled');
    const [repo] = await overviewOf(db, 1, NOW);
    expect(repo?.sites[0]?.sha).toBe('old1234');
  });

  it("shows the owner's deployment to someone who sees the repository", async () => {
    const { db } = made();
    await addDomain(db, 1, 'a.test', 'acme/site');
    await run(db, 'a.test', 'abc1234', '2026-01-01T00:00:00.000Z');
    await replaceAccess(db, 2, ['acme/site'], new Date(NOW).toISOString());
    const [repo] = await overviewOf(db, 2, NOW);
    expect(repo?.sites[0]?.sha).toBe('abc1234');
  });

  it('counts the issues that are open for the repository, and no others', async () => {
    const { db } = made();
    await addDomain(db, 1, 'a.test', 'acme/site');
    await addDomain(db, 1, 'x.test', 'acme/quiet');
    const issue = (number: number, state: 'open' | 'fixed') => ({
      number,
      state,
      signature: 's',
      reopens: 0,
    });
    await saveIssue(db, 'acme/site', 'a.test', 'csp', issue(1, 'open'));
    await saveIssue(db, 'acme/site', 'a.test', 'hsts', issue(2, 'open'));
    await saveIssue(db, 'acme/site', 'a.test', 'cors', issue(3, 'fixed'));
    await saveIssue(db, 'acme/other', 'z.test', 'csp', issue(4, 'open'));
    const overview = await overviewOf(db, 1, NOW);
    expect(overview.map((r) => [r.repo, r.open_issues])).toEqual([
      ['acme/quiet', 0],
      ['acme/site', 2],
    ]);
  });

  it('reads more than a hundred sites without binding more than D1 allows', async () => {
    const { db, raw } = made();
    const prepare = raw.prepare.bind(raw);
    raw.prepare = (sql: string) => {
      if ((sql.match(/\?/g) ?? []).length > 100) {
        throw new Error('too many SQL variables');
      }
      return prepare(sql);
    };
    for (let n = 0; n < 120; n += 1) {
      await addDomain(db, 1, `s${n}.test`, `acme/r${n}`);
    }
    const overview = await overviewOf(db, 1, NOW);
    expect(overview).toHaveLength(120);
  });

  it('reads only the repository asked for', async () => {
    const { db } = made();
    await addDomain(db, 1, 'a.test', 'acme/a');
    await addDomain(db, 1, 'b.test', 'acme/b');
    const one = await overviewOf(db, 1, NOW, 'acme/b');
    expect(one.map((r) => r.repo)).toEqual(['acme/b']);
    expect(await overviewOf(db, 1, NOW, 'acme/none')).toEqual([]);
  });

  it('does not show another person the repository asked for', async () => {
    const { db } = made();
    await addDomain(db, 2, 'a.test', 'acme/a');
    expect(await overviewOf(db, 1, NOW, 'acme/a')).toEqual([]);
  });

  it('answers a single repository from the repo index', async () => {
    const { raw } = made();
    const plan = raw
      .prepare(
        'EXPLAIN QUERY PLAN select id from domains where repo = ? and (user_id = ? or repo in (select repo from user_repositories where user_id = ? and granted_at > ?))',
      )
      .all('acme/a', 1, 1, '2020')
      .map((row) => String(row['detail']))
      .join(' | ');
    expect(plan).not.toMatch(/SCAN domains/);
  });

  it('answers from the indexes: no scan of the run history or the issues', async () => {
    const { db, raw } = made();
    await addDomain(db, 1, 'a.test', 'acme/site');
    const plan = (sql: string, ...params: (string | number)[]) =>
      raw
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...params)
        .map((row) => String(row['detail']))
        .join(' | ');
    expect(
      plan(
        "select host, sha, ran_at from suite_runs where user_id = ? and host in (?) and id = (select max(r.id) from suite_runs r where r.user_id = suite_runs.user_id and r.host = suite_runs.host and r.kind = 'deployment')",
        1,
        'a.test',
      ),
    ).not.toMatch(/SCAN suite_runs/);
    expect(
      plan(
        "select repo, count(*) from suite_check_issues where repo in (?) and state = 'open' group by repo",
        'acme/site',
      ),
    ).not.toMatch(/SCAN suite_check_issues/);
  });
});

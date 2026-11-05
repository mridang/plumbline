import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  ISSUES_LISTED,
  issuesOf,
  markIssueDeleted,
  recordIssue,
} from '@/domain/db/issue-history';
import { forgetIssue, saveIssue } from '@/domain/db/suite';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

const empty = () => sqliteDatabase(...APP_MIGRATIONS);
const issue = (number: number, state: 'open' | 'fixed' | 'dismissed') => ({
  number,
  state,
  signature: 's',
});
const at = (iso: string) => new Date(iso);

describe('recordIssue and issuesOf', () => {
  it('lists the issues of a site newest first, with the checks each reported', async () => {
    const { db } = empty();
    await recordIssue(
      db,
      'a/b',
      'x.test',
      { number: 1, state: 'open' },
      ['csp', 'hsts'],
      at('2026-01-01T00:00:00.000Z'),
    );
    await recordIssue(
      db,
      'a/b',
      'x.test',
      { number: 2, state: 'open' },
      ['csp'],
      at('2026-02-01T00:00:00.000Z'),
    );
    expect(await issuesOf(db, 'a/b', 'x.test')).toEqual([
      {
        number: 2,
        state: 'open',
        opened_at: '2026-02-01T00:00:00.000Z',
        checks: ['csp'],
      },
      {
        number: 1,
        state: 'open',
        opened_at: '2026-01-01T00:00:00.000Z',
        checks: ['csp', 'hsts'],
      },
    ]);
  });

  it('keeps the time it was opened when it is written again, and updates how it stands', async () => {
    const { db } = empty();
    await recordIssue(
      db,
      'a/b',
      'x.test',
      { number: 1, state: 'open' },
      ['csp'],
      at('2026-01-01T00:00:00.000Z'),
    );
    await recordIssue(
      db,
      'a/b',
      'x.test',
      { number: 1, state: 'fixed' },
      undefined,
      at('2026-03-01T00:00:00.000Z'),
    );
    expect(await issuesOf(db, 'a/b', 'x.test')).toEqual([
      {
        number: 1,
        state: 'fixed',
        opened_at: '2026-01-01T00:00:00.000Z',
        checks: ['csp'],
      },
    ]);
  });

  it('replaces the checks when a write gives them, once each', async () => {
    const { db } = empty();
    await recordIssue(db, 'a/b', 'x.test', { number: 1, state: 'open' }, ['a']);
    await recordIssue(db, 'a/b', 'x.test', { number: 1, state: 'open' }, [
      'b',
      'b',
      'c',
    ]);
    expect((await issuesOf(db, 'a/b', 'x.test'))[0]?.checks).toEqual([
      'b',
      'c',
    ]);
  });

  it('does not record a claim that is not an issue yet', async () => {
    const { db } = empty();
    await recordIssue(db, 'a/b', 'x.test', { number: 0, state: 'opening' });
    await recordIssue(db, 'a/b', 'x.test', { number: 5, state: 'opening' });
    expect(await issuesOf(db, 'a/b', 'x.test')).toEqual([]);
  });

  it('keeps one site’s issues apart from another’s', async () => {
    const { db } = empty();
    await recordIssue(db, 'a/b', 'x.test', { number: 1, state: 'open' });
    await recordIssue(db, 'a/b', 'y.test', { number: 2, state: 'open' });
    await recordIssue(db, 'c/d', 'x.test', { number: 3, state: 'open' });
    expect((await issuesOf(db, 'a/b', 'x.test')).map((i) => i.number)).toEqual([
      1,
    ]);
  });

  it('reads a damaged list of checks as none, and lists at most a page', async () => {
    const { db, raw } = empty();
    await recordIssue(db, 'a/b', 'x.test', { number: 1, state: 'open' });
    raw.exec("UPDATE suite_issue_history SET checks = 'not json'");
    expect((await issuesOf(db, 'a/b', 'x.test'))[0]?.checks).toEqual([]);
    raw.exec('UPDATE suite_issue_history SET checks = \'{"a":1}\'');
    expect((await issuesOf(db, 'a/b', 'x.test'))[0]?.checks).toEqual([]);
    for (let n = 2; n < ISSUES_LISTED + 5; n += 1) {
      await recordIssue(db, 'a/b', 'x.test', { number: n, state: 'open' });
    }
    expect(await issuesOf(db, 'a/b', 'x.test')).toHaveLength(ISSUES_LISTED);
  });
});

describe('the history through saveIssue and forgetIssue', () => {
  it('records an issue as it is opened, closed, reopened and replaced by another', async () => {
    const { db } = empty();
    await saveIssue(db, 'a/b', 'x.test', issue(1, 'open'), ['csp']);
    await saveIssue(db, 'a/b', 'x.test', issue(1, 'fixed'));
    expect((await issuesOf(db, 'a/b', 'x.test'))[0]).toMatchObject({
      number: 1,
      state: 'fixed',
      checks: ['csp'],
    });
    await saveIssue(db, 'a/b', 'x.test', issue(1, 'open'), ['csp', 'hsts']);
    await saveIssue(db, 'a/b', 'x.test', issue(1, 'dismissed'));
    await saveIssue(db, 'a/b', 'x.test', issue(2, 'open'), ['hsts']);
    const listed = await issuesOf(db, 'a/b', 'x.test');
    expect(listed.map((i) => [i.number, i.state])).toEqual(
      expect.arrayContaining([
        [1, 'dismissed'],
        [2, 'open'],
      ]),
    );
    expect(listed.find((i) => i.number === 1)?.checks).toEqual(['csp', 'hsts']);
  });

  it('leaves a deleted issue out of the list but keeps its row', async () => {
    const { db, raw } = empty();
    await saveIssue(db, 'a/b', 'x.test', issue(1, 'open'), ['csp']);
    await saveIssue(db, 'a/b', 'y.test', issue(1, 'open'), ['csp']);
    await forgetIssue(db, 'a/b', 1);
    expect(await issuesOf(db, 'a/b', 'x.test')).toEqual([]);
    expect(
      raw
        .prepare("SELECT state FROM suite_issue_history WHERE repo = 'a/b'")
        .all(),
    ).toEqual([{ state: 'deleted' }, { state: 'deleted' }]);
  });

  it('marks only the repository’s own issue number as deleted', async () => {
    const { db } = empty();
    await saveIssue(db, 'a/b', 'x.test', issue(1, 'open'));
    await saveIssue(db, 'c/d', 'x.test', issue(1, 'open'));
    await markIssueDeleted(db, 'a/b', 1);
    expect(await issuesOf(db, 'a/b', 'x.test')).toEqual([]);
    expect(await issuesOf(db, 'c/d', 'x.test')).toHaveLength(1);
  });
});

describe('migration 0016_issue_history', () => {
  it('backfills the issues of today, leaving out claims, with no checks', () => {
    const before = APP_MIGRATIONS.filter(
      (file) => file < '0016_issue_history.sql',
    );
    const { raw } = sqliteDatabase(...before);
    raw.exec(`
      INSERT INTO suite_issues (repo, host, number, state, signature) VALUES
        ('a/b', 'open.test', 4, 'open', 's'),
        ('a/b', 'fixed.test', 5, 'fixed', 's'),
        ('a/b', 'dismissed.test', 6, 'dismissed', 's'),
        ('a/b', 'claim.test', 0, 'opening', '2026-01-01T00:00:00.000Z');
    `);
    raw.exec(
      readFileSync(
        path.join(process.cwd(), 'migrations', '0016_issue_history.sql'),
        'utf8',
      ),
    );
    expect(
      raw
        .prepare(
          'SELECT host, number, state, checks FROM suite_issue_history ORDER BY number',
        )
        .all(),
    ).toEqual([
      { host: 'open.test', number: 4, state: 'open', checks: '[]' },
      { host: 'fixed.test', number: 5, state: 'fixed', checks: '[]' },
      { host: 'dismissed.test', number: 6, state: 'dismissed', checks: '[]' },
    ]);
  });
});

describe('the plan of the history queries', () => {
  it.each([
    [
      'a site’s issues',
      "SELECT number, state, opened_at, checks FROM suite_issue_history WHERE repo = 'a/b' AND host = 'x' AND state <> 'deleted' ORDER BY opened_at DESC, number DESC LIMIT 50",
    ],
    [
      'an issue by its number',
      "UPDATE suite_issue_history SET state = 'deleted' WHERE repo = 'a/b' AND number = 1",
    ],
  ])('answers %s from an index', (_name, sql) => {
    const { raw } = empty();
    const plan = raw
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all()
      .map((row) => String(row['detail']))
      .join('\n');
    expect(plan).toMatch(/USING (COVERING )?(INDEX|PRIMARY KEY)/);
    expect(plan).not.toMatch(/SCAN|TEMP B-TREE/);
  });
});

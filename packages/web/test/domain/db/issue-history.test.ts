import { describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ISSUES_LISTED,
  issuesOf,
  markIssueDeleted,
  markIssueReplaced,
  recordIssue,
} from '@/domain/db/issue-history';
import { forgetIssue, saveIssue } from '@/domain/db/suite';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

const PACKAGE = path.resolve(import.meta.dirname, '../../..');

const empty = () => sqliteDatabase(...APP_MIGRATIONS);
const issue = (
  number: number,
  state: 'open' | 'fixed' | 'dismissed',
  reopens = 0,
) => ({ number, state, signature: 's', reopens });
const at = (iso: string) => new Date(iso);

describe('recordIssue and issuesOf', () => {
  it('lists the issues of a site newest first, each with the one check it tracks', async () => {
    const { db } = empty();
    await recordIssue(
      db,
      'a/b',
      'x.test',
      'csp',
      { number: 1, state: 'open' },
      at('2026-01-01T00:00:00.000Z'),
    );
    await recordIssue(
      db,
      'a/b',
      'x.test',
      'hsts',
      { number: 2, state: 'open' },
      at('2026-02-01T00:00:00.000Z'),
    );
    expect(await issuesOf(db, 'a/b', 'x.test')).toEqual([
      {
        number: 2,
        state: 'open',
        opened_at: '2026-02-01T00:00:00.000Z',
        checks: ['hsts'],
      },
      {
        number: 1,
        state: 'open',
        opened_at: '2026-01-01T00:00:00.000Z',
        checks: ['csp'],
      },
    ]);
  });

  it('keeps the time it was opened when it is written again, and updates how it stands', async () => {
    const { db } = empty();
    await recordIssue(
      db,
      'a/b',
      'x.test',
      'csp',
      { number: 1, state: 'open' },
      at('2026-01-01T00:00:00.000Z'),
    );
    await recordIssue(
      db,
      'a/b',
      'x.test',
      'csp',
      { number: 1, state: 'fixed' },
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

  it('does not record a claim that is not an issue yet', async () => {
    const { db } = empty();
    await recordIssue(db, 'a/b', 'x.test', 'csp', {
      number: 0,
      state: 'opening',
    });
    await recordIssue(db, 'a/b', 'x.test', 'csp', {
      number: 5,
      state: 'opening',
    });
    expect(await issuesOf(db, 'a/b', 'x.test')).toEqual([]);
  });

  it('keeps one site’s issues apart from another’s', async () => {
    const { db } = empty();
    await recordIssue(db, 'a/b', 'x.test', 'csp', { number: 1, state: 'open' });
    await recordIssue(db, 'a/b', 'y.test', 'csp', { number: 2, state: 'open' });
    await recordIssue(db, 'c/d', 'x.test', 'csp', { number: 3, state: 'open' });
    const issues = await issuesOf(db, 'a/b', 'x.test');
    expect(issues.map((i) => i.number)).toEqual([1]);
  });

  it('reads an issue of the old kind (no check of its own) from its list of checks, and a damaged list as none, and lists at most a page', async () => {
    const { db, raw } = empty();
    await recordIssue(db, 'a/b', 'x.test', 'csp', { number: 1, state: 'open' });
    raw.exec(
      'UPDATE suite_issue_history SET check_id = \'\', checks = \'["a","b"]\'',
    );
    const old = await issuesOf(db, 'a/b', 'x.test');
    expect(old[0]?.checks).toEqual(['a', 'b']);
    raw.exec("UPDATE suite_issue_history SET checks = 'not json'");
    const damaged = await issuesOf(db, 'a/b', 'x.test');
    expect(damaged[0]?.checks).toEqual([]);
    raw.exec('UPDATE suite_issue_history SET checks = \'{"a":1}\'');
    const notList = await issuesOf(db, 'a/b', 'x.test');
    expect(notList[0]?.checks).toEqual([]);
    for (let n = 2; n < ISSUES_LISTED + 5; n += 1) {
      await recordIssue(db, 'a/b', 'x.test', 'csp', {
        number: n,
        state: 'open',
      });
    }
    expect(await issuesOf(db, 'a/b', 'x.test')).toHaveLength(ISSUES_LISTED);
  });
});

describe('the history through saveIssue and forgetIssue', () => {
  it('records an issue as it is opened, closed, reopened and replaced by another', async () => {
    const { db } = empty();
    await saveIssue(db, 'a/b', 'x.test', 'csp', issue(1, 'open'));
    await saveIssue(db, 'a/b', 'x.test', 'csp', issue(1, 'fixed'));
    const issues = await issuesOf(db, 'a/b', 'x.test');
    expect(issues[0]).toMatchObject({
      number: 1,
      state: 'fixed',
      checks: ['csp'],
    });
    await saveIssue(db, 'a/b', 'x.test', 'csp', issue(1, 'open'));
    await saveIssue(db, 'a/b', 'x.test', 'csp', issue(1, 'dismissed'));
    await saveIssue(db, 'a/b', 'x.test', 'csp', issue(2, 'open'));
    const listed = await issuesOf(db, 'a/b', 'x.test');
    expect(listed.map((i) => [i.number, i.state, i.checks])).toEqual(
      expect.arrayContaining([
        [1, 'dismissed', ['csp']],
        [2, 'open', ['csp']],
      ]),
    );
  });

  it('keeps an issue for each check of a site, each listed under its check', async () => {
    const { db } = empty();
    await saveIssue(db, 'a/b', 'x.test', 'csp', issue(1, 'open'));
    await saveIssue(db, 'a/b', 'x.test', 'hsts', issue(2, 'open'));
    const issues = await issuesOf(db, 'a/b', 'x.test');
    expect(
      issues
        .map((i) => [i.number, ...i.checks])
        .toSorted((a, b) => a.join(',').localeCompare(b.join(','))),
    ).toEqual([
      [1, 'csp'],
      [2, 'hsts'],
    ]);
  });

  it('leaves a deleted issue out of the list but keeps its row', async () => {
    const { db, raw } = empty();
    await saveIssue(db, 'a/b', 'x.test', 'csp', issue(1, 'open'));
    await saveIssue(db, 'a/b', 'y.test', 'csp', issue(1, 'open'));
    await forgetIssue(db, 'a/b', 1);
    expect(await issuesOf(db, 'a/b', 'x.test')).toEqual([]);
    expect(
      raw
        .prepare("SELECT state FROM suite_issue_history WHERE repo = 'a/b'")
        .all(),
    ).toEqual([{ state: 'deleted' }, { state: 'deleted' }]);
  });

  it('marks only the repository’s own issue number as deleted or replaced', async () => {
    const { db } = empty();
    await saveIssue(db, 'a/b', 'x.test', 'csp', issue(1, 'open'));
    await saveIssue(db, 'c/d', 'x.test', 'csp', issue(1, 'open'));
    await saveIssue(db, 'e/f', 'x.test', 'csp', issue(1, 'open'));
    await markIssueDeleted(db, 'a/b', 1);
    await markIssueReplaced(db, 'e/f', 1);
    expect(await issuesOf(db, 'a/b', 'x.test')).toEqual([]);
    expect(await issuesOf(db, 'e/f', 'x.test')).toEqual([]);
    expect(await issuesOf(db, 'c/d', 'x.test')).toHaveLength(1);
  });
});

describe('migration 0017_issue_per_check', () => {
  it('gives an issue that reported one check that check, leaves the others for the old kind, and drops claims', async () => {
    const before = APP_MIGRATIONS.filter(
      (file) => file.localeCompare('0017_issue_per_check.sql') < 0,
    );
    const { raw } = sqliteDatabase(...before);
    raw.exec(`
      INSERT INTO suite_issues (repo, host, number, state, signature) VALUES
        ('a/b', 'open.test', 4, 'open', 's'),
        ('a/b', 'claim.test', 0, 'opening', '2026-01-01T00:00:00.000Z');
      INSERT INTO suite_issue_history (repo, host, number, state, opened_at, checks) VALUES
        ('a/b', 'one.test', 1, 'open', '2026-01-01T00:00:00.000Z', '["csp"]'),
        ('a/b', 'many.test', 2, 'open', '2026-01-01T00:00:00.000Z', '["csp","hsts"]'),
        ('a/b', 'none.test', 3, 'open', '2026-01-01T00:00:00.000Z', '[]');
    `);
    raw.exec(
      await readFile(
        path.join(PACKAGE, 'migrations', '0017_issue_per_check.sql'),
        'utf8',
      ),
    );
    expect(
      raw
        .prepare(
          'SELECT number, check_id FROM suite_issue_history ORDER BY number',
        )
        .all(),
    ).toEqual([
      { number: 1, check_id: 'csp' },
      { number: 2, check_id: '' },
      { number: 3, check_id: '' },
    ]);
    expect(raw.prepare('SELECT host, number FROM suite_issues').all()).toEqual([
      { host: 'open.test', number: 4 },
    ]);
    expect(
      raw.prepare('SELECT COUNT(*) AS n FROM suite_check_issues').get(),
    ).toEqual({
      n: 0,
    });
  });
});

describe('the plan of the issue queries', () => {
  it.each([
    [
      'a site’s issues in the history',
      "SELECT number, state, opened_at, checks, check_id FROM suite_issue_history WHERE repo = 'a/b' AND host = 'x' AND state NOT IN ('deleted', 'replaced') ORDER BY opened_at DESC, number DESC LIMIT 50",
    ],
    [
      'an issue in the history by its number',
      "UPDATE suite_issue_history SET state = 'deleted' WHERE repo = 'a/b' AND number = 1",
    ],
    [
      'the issue of a check',
      "SELECT * FROM suite_check_issues WHERE repo = 'a/b' AND host = 'x' AND check_id = 'csp'",
    ],
    [
      'the issues of a host',
      "SELECT * FROM suite_check_issues WHERE repo = 'a/b' AND host = 'x'",
    ],
    [
      'the open issues of a repository',
      "SELECT * FROM suite_check_issues WHERE repo = 'a/b' AND state = 'open' ORDER BY host ASC, check_id ASC",
    ],
    [
      'an issue by its number',
      "SELECT * FROM suite_check_issues WHERE repo = 'a/b' AND number = 1",
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

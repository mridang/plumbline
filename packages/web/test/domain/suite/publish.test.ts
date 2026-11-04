import { describe, expect, it, jest } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { CLAIM_MS, issueOf, saveIssue } from '@/domain/db/suite';
import { GitHubApi } from '@/domain/github/api';
import type { StoredFinding } from '@/domain/suite/diff';
import {
  CHECK_NAME,
  ISSUE_LABEL,
  originOf,
  publishCheckRun,
  publishUnreachable,
  signatureOf,
  syncIssue,
  type SiteReport,
} from '@/domain/suite/publish';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

interface Request {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

/**
 * A GitHub that records what it is asked. `answers` maps "METHOD /path-start"
 * to the status (or status and JSON body) to answer with; a request nobody
 * answers for gets an ordinary success.
 */
function github(answers: Record<string, number | [number, unknown]> = {}) {
  const requests: Request[] = [];
  const api = new GitHubApi('tok', (async (
    input: unknown,
    init?: RequestInit,
  ) => {
    const method = init?.method ?? 'GET';
    const path = String(input).replace('https://api.github.com', '');
    requests.push({
      method,
      path,
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    const key = Object.keys(answers).find((k) =>
      `${method} ${path}`.startsWith(k),
    );
    if (key) {
      const answer = answers[key]!;
      const [status, body] = typeof answer === 'number' ? [answer, {}] : answer;
      return Response.json(body, { status });
    }
    if (method === 'GET') {
      return Response.json([]);
    }
    return Response.json({ id: 1, number: 21, state: 'open' });
  }) as typeof fetch);
  return { api, requests };
}

const database = () => createDatabase(sqliteD1(...APP_MIGRATIONS).d1);

const error: StoredFinding = {
  id: 'seo-viewport',
  severity: 'error',
  message: 'no viewport',
};
const other: StoredFinding = {
  id: 'seo-http-status',
  severity: 'error',
  message: 'status 500',
};
const warning: StoredFinding = {
  id: 'seo-links',
  severity: 'warning',
  message: 'odd link',
};

const report = (
  findings: StoredFinding[],
  more: Partial<SiteReport> = {},
): SiteReport => ({
  repo: 'acme/site',
  host: 'site.test',
  sha: 'abc1234def',
  url: 'https://site.test/',
  level: 'error',
  findings,
  source: null,
  browserOnly: [],
  problems: [],
  ...more,
});

const lines = (requests: Request[]) =>
  requests.map((r) => `${r.method} ${r.path}`);

/** The text of the comments made. */
const said = (requests: Request[]) =>
  requests
    .filter((r) => r.path.endsWith('/comments'))
    .map((r) => String(r.body['body']));

describe('signatureOf', () => {
  it('is empty for no findings, and the same for the same findings in any order', async () => {
    expect(await signatureOf([])).toBe('');
    expect(await signatureOf([error, other])).toBe(
      await signatureOf([other, error]),
    );
    expect(await signatureOf([error])).toMatch(/^[0-9a-f]{16}$/);
  });

  it('differs when the findings differ', async () => {
    expect(await signatureOf([error])).not.toBe(await signatureOf([other]));
    expect(await signatureOf([error])).not.toBe(
      await signatureOf([error, other]),
    );
  });
});

describe('syncIssue', () => {
  it('opens an issue for the first problem and remembers it', async () => {
    const db = database();
    const { api, requests } = github({
      'POST /repos/acme/site/issues': [201, { number: 12, state: 'open' }],
    });
    expect(await syncIssue(api, db, report([error]))).toBe('opened');
    expect(lines(requests)).toEqual(['POST /repos/acme/site/issues']);
    expect(requests[0]?.body).toMatchObject({
      title: 'Plumbline: 1 problem on site.test',
      labels: [ISSUE_LABEL],
    });
    expect(String(requests[0]?.body['body'])).toContain('no viewport');
    expect(await issueOf(db, 'acme/site', 'site.test')).toEqual({
      number: 12,
      state: 'open',
      signature: await signatureOf([error]),
    });
  });

  it('does nothing when there is nothing to report and no issue', async () => {
    const { api, requests } = github();
    expect(await syncIssue(api, database(), report([]))).toBe('none');
    expect(requests).toEqual([]);
  });

  it('does not count a warning when only errors open an issue', async () => {
    const { api, requests } = github();
    expect(await syncIssue(api, database(), report([warning]))).toBe('none');
    expect(requests).toEqual([]);
  });

  it('counts a warning when the level says so', async () => {
    expect(
      await syncIssue(
        github().api,
        database(),
        report([warning], { level: 'warning' }),
      ),
    ).toBe('opened');
  });

  it('opens nothing at all when issues are off', async () => {
    const { api, requests } = github();
    expect(
      await syncIssue(api, database(), report([error], { level: 'off' })),
    ).toBe('none');
    expect(requests).toEqual([]);
  });

  it('edits the issue it opened, without reopening it or commenting', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'site.test', {
      number: 12,
      state: 'open',
      signature: 'old',
    });
    const { api, requests } = github();
    expect(
      await syncIssue(api, db, report([error, warning], { level: 'warning' })),
    ).toBe('updated');
    expect(lines(requests)).toEqual(['PATCH /repos/acme/site/issues/12']);
    expect(requests[0]?.body).toMatchObject({
      title: 'Plumbline: 2 problems on site.test',
    });
    expect(requests[0]?.body).not.toHaveProperty('state');
  });

  describe('when the problems are gone', () => {
    const open = async () => {
      const db = database();
      await saveIssue(db, 'acme/site', 'site.test', {
        number: 12,
        state: 'open',
        signature: 'x',
      });
      return db;
    };

    it('closes the issue with a comment naming the pull request that fixed them', async () => {
      const db = await open();
      const { api, requests } = github({
        'GET /repos/acme/site/commits/abc1234def/pulls': [
          200,
          [{ number: 40, merged_at: '2026-01-01T00:00:00Z' }],
        ],
      });
      expect(await syncIssue(api, db, report([]))).toBe('closed');
      expect(lines(requests)).toEqual([
        'GET /repos/acme/site/commits/abc1234def/pulls',
        'PATCH /repos/acme/site/issues/12',
        'POST /repos/acme/site/issues/12/comments',
      ]);
      expect(said(requests)[0]).toContain('as of #40 (commit `abc1234`)');
      expect(requests[1]?.body).toEqual({
        state: 'closed',
        state_reason: 'completed',
      });
      expect(await issueOf(db, 'acme/site', 'site.test')).toMatchObject({
        state: 'fixed',
        signature: '',
      });
    });

    it('prefers a merged pull request to an open one', async () => {
      const { api, requests } = github({
        'GET /repos/acme/site/commits/abc1234def/pulls': [
          200,
          [
            { number: 41, merged_at: null },
            { number: 40, merged_at: '2026-01-01T00:00:00Z' },
          ],
        ],
      });
      await syncIssue(api, await open(), report([]));
      expect(said(requests)[0]).toContain('#40');
    });

    it('names only the commit when there is no pull request, or it cannot be looked up', async () => {
      const none = github();
      await syncIssue(none.api, await open(), report([]));
      expect(said(none.requests)[0]).toContain('as of commit `abc1234`');
      const refused = github({ 'GET /repos/acme/site/commits': 403 });
      await syncIssue(refused.api, await open(), report([]));
      expect(said(refused.requests)[0]).toContain('as of commit `abc1234`');
    });

    it('does not look for a pull request when the deployment gave no commit', async () => {
      const { api, requests } = github();
      await syncIssue(api, await open(), report([], { sha: null }));
      expect(lines(requests)).toEqual([
        'PATCH /repos/acme/site/issues/12',
        'POST /repos/acme/site/issues/12/comments',
      ]);
      expect(said(requests)[0]).toContain('as of the latest deployment');
    });

    it('closes the issue even when the comment cannot be made', async () => {
      const db = await open();
      const logged = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { api, requests } = github({
        'POST /repos/acme/site/issues/12/comments': 403,
      });
      expect(await syncIssue(api, db, report([]))).toBe('closed');
      expect(lines(requests)).toContain('PATCH /repos/acme/site/issues/12');
      expect(logged).toHaveBeenCalled();
      logged.mockRestore();
    });

    it('closes the issue only once', async () => {
      const db = await open();
      const { api, requests } = github();
      await syncIssue(api, db, report([]));
      const count = requests.length;
      expect(await syncIssue(api, db, report([]))).toBe('none');
      expect(requests).toHaveLength(count);
    });

    it('records a deleted issue as fixed', async () => {
      const db = await open();
      const { api } = github({ 'PATCH /repos/acme/site/issues/12': 410 });
      expect(await syncIssue(api, db, report([]))).toBe('closed');
      expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe(
        'fixed',
      );
    });
  });

  describe('when the problems come back', () => {
    it('reopens the issue the app closed, and says so', async () => {
      const db = database();
      await saveIssue(db, 'acme/site', 'site.test', {
        number: 12,
        state: 'fixed',
        signature: '',
      });
      const { api, requests } = github();
      expect(await syncIssue(api, db, report([error]))).toBe('reopened');
      expect(lines(requests)).toEqual([
        'GET /repos/acme/site/commits/abc1234def/pulls',
        'PATCH /repos/acme/site/issues/12',
        'POST /repos/acme/site/issues/12/comments',
      ]);
      expect(said(requests)[0]).toContain(
        'These problems are back as of commit `abc1234`',
      );
      expect(requests[1]?.body).toMatchObject({
        state: 'open',
        state_reason: 'reopened',
      });
      expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe('open');
    });

    it('goes through close and reopen again with the same issue', async () => {
      const db = database();
      const { api } = github({
        'POST /repos/acme/site/issues': [201, { number: 5, state: 'open' }],
      });
      await syncIssue(api, db, report([error]));
      expect(await syncIssue(api, db, report([]))).toBe('closed');
      expect(await syncIssue(api, db, report([error]))).toBe('reopened');
      expect((await issueOf(db, 'acme/site', 'site.test'))?.number).toBe(5);
    });
  });

  describe('an issue a person closed', () => {
    const closedByAPerson = async (problems: StoredFinding[]) => {
      const db = database();
      await saveIssue(db, 'acme/site', 'site.test', {
        number: 12,
        state: 'dismissed',
        signature: await signatureOf(problems),
      });
      return db;
    };

    it('stays closed while the same problems are there', async () => {
      const { api, requests } = github();
      expect(
        await syncIssue(api, await closedByAPerson([error]), report([error])),
      ).toBe('none');
      expect(requests).toEqual([]);
    });

    it('is opened again when other problems are found, with a comment saying so', async () => {
      const db = await closedByAPerson([error]);
      const { api, requests } = github();
      expect(await syncIssue(api, db, report([error, other]))).toBe('reopened');
      expect(said(requests)[0]).toContain('found other problems as of');
      expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe('open');
    });

    it('is treated as fixed once the problems are gone, so they reopen it if they return', async () => {
      const db = await closedByAPerson([error]);
      const { api, requests } = github();
      expect(await syncIssue(api, db, report([]))).toBe('none');
      expect(requests).toEqual([]);
      expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe(
        'fixed',
      );
      expect(await syncIssue(api, db, report([error]))).toBe('reopened');
      expect(said(requests)[0]).toContain('These problems are back');
    });
  });

  it('opens a new issue when the old one was deleted', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'site.test', {
      number: 12,
      state: 'open',
      signature: 'x',
    });
    const { api, requests } = github({
      'PATCH /repos/acme/site/issues/12': 404,
      'POST /repos/acme/site/issues': [201, { number: 30, state: 'open' }],
    });
    expect(await syncIssue(api, db, report([error]))).toBe('opened');
    expect(lines(requests)).toEqual([
      'PATCH /repos/acme/site/issues/12',
      'POST /repos/acme/site/issues',
    ]);
    expect((await issueOf(db, 'acme/site', 'site.test'))?.number).toBe(30);
  });

  it('fails, and keeps what it knew, when GitHub fails in another way', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'site.test', {
      number: 12,
      state: 'open',
      signature: 'x',
    });
    await expect(
      syncIssue(github({ 'PATCH ': 500 }).api, db, report([error])),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      syncIssue(github({ 'PATCH ': 403 }).api, db, report([])),
    ).rejects.toMatchObject({ status: 403 });
    expect(await issueOf(db, 'acme/site', 'site.test')).toEqual({
      number: 12,
      state: 'open',
      signature: 'x',
    });
  });

  it('keeps the issues of two sites of one repository apart', async () => {
    const db = database();
    const { api } = github({
      'POST /repos/acme/site/issues': [201, { number: 1, state: 'open' }],
    });
    await syncIssue(
      api,
      db,
      report([error], { host: 'a.test', url: 'https://a.test/' }),
    );
    const second = github({
      'POST /repos/acme/site/issues': [201, { number: 2, state: 'open' }],
    });
    await syncIssue(
      second.api,
      db,
      report([error], { host: 'b.test', url: 'https://b.test/' }),
    );
    expect((await issueOf(db, 'acme/site', 'a.test'))?.number).toBe(1);
    expect((await issueOf(db, 'acme/site', 'b.test'))?.number).toBe(2);
  });
});

describe('publishCheckRun', () => {
  const preview = {
    repo: 'acme/site',
    sha: 'abc1234',
    url: 'https://pr-3.site.test/',
    source: null,
    browserOnly: [],
    problems: [],
  };

  it.each([
    [[error], 'failure'],
    [[warning], 'neutral'],
    [[], 'success'],
  ] as const)('reports %j as %s', async (findings, conclusion) => {
    const { api, requests } = github();
    await publishCheckRun(api, { ...preview, findings: [...findings] });
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/repos/acme/site/check-runs',
      body: {
        name: CHECK_NAME,
        head_sha: 'abc1234',
        status: 'completed',
        conclusion,
        details_url: 'https://pr-3.site.test/',
      },
    });
  });

  it('carries the title and summary of the findings', async () => {
    const { api, requests } = github();
    await publishCheckRun(api, { ...preview, findings: [error] });
    const output = requests[0]?.body['output'] as {
      title: string;
      summary: string;
    };
    expect(output.title).toBe(
      '1 error, 0 warnings and 0 hints on pr-3.site.test',
    );
    expect(output.summary).toContain('no viewport');
  });
});

describe('publishUnreachable', () => {
  it('explains on the commit why nothing was checked', async () => {
    const { api, requests } = github();
    await publishUnreachable(
      api,
      'acme/site',
      'abc1234',
      'https://pr-3.site.test/',
    );
    expect(requests[0]?.body).toMatchObject({
      head_sha: 'abc1234',
      conclusion: 'neutral',
      output: { title: 'The preview could not be reached' },
    });
  });
});

describe('what a site that looks the same, or a second delivery, does to its issue', () => {
  const open = async (signature: string) => {
    const db = database();
    await saveIssue(db, 'acme/site', 'site.test', {
      number: 12,
      state: 'open',
      signature,
    });
    return db;
  };

  it('keeps the same signature when only the numbers in a message change', async () => {
    const slow = (ms: number): StoredFinding => ({
      id: 'technical-response-time',
      severity: 'error',
      message: `The page took ${ms} ms to answer.`,
    });
    expect(await signatureOf([slow(1234)])).toBe(
      await signatureOf([slow(1301)]),
    );
    expect(await signatureOf([slow(1234)])).not.toBe(
      await signatureOf([error]),
    );
  });

  it('does not reopen an issue a person closed because a number in a message moved', async () => {
    const slow = (ms: number): StoredFinding => ({
      id: 'technical-response-time',
      severity: 'error',
      message: `The page took ${ms} ms to answer.`,
    });
    const db = database();
    await saveIssue(db, 'acme/site', 'site.test', {
      number: 12,
      state: 'dismissed',
      signature: await signatureOf([slow(1234)]),
    });
    const { api, requests } = github();
    expect(await syncIssue(api, db, report([slow(1500)]))).toBe('none');
    expect(requests).toEqual([]);
  });

  it('leaves an existing issue alone when issues are turned off', async () => {
    const db = await open('x');
    const { api, requests } = github();
    expect(await syncIssue(api, db, report([], { level: 'off' }))).toBe('none');
    expect(requests).toEqual([]);
  });

  it('does nothing for a page that looks the same while its issue says the same', async () => {
    const db = await open(await signatureOf([error]));
    const { api, requests } = github();
    expect(await syncIssue(api, db, report([error], { unchanged: true }))).toBe(
      'none',
    );
    expect(requests).toEqual([]);
  });

  it('updates the issue of an unchanged page when what it reports is not what the issue says', async () => {
    const db = await open('something else');
    const { api } = github();
    expect(await syncIssue(api, db, report([error], { unchanged: true }))).toBe(
      'updated',
    );
  });

  it('opens a new issue for a page that looks the same when its issue is gone', async () => {
    const { api, requests } = github();
    expect(
      await syncIssue(api, database(), report([error], { unchanged: true })),
    ).toBe('opened');
    expect(lines(requests)).toEqual(['POST /repos/acme/site/issues']);
  });

  it('opens one issue when two deliveries find the problems at the same time', async () => {
    const db = database();
    const first = github({
      'POST /repos/acme/site/issues': [201, { number: 5, state: 'open' }],
    });
    const second = github({
      'POST /repos/acme/site/issues': [201, { number: 6, state: 'open' }],
    });
    const actions = await Promise.all([
      syncIssue(first.api, db, report([error])),
      syncIssue(second.api, db, report([error])),
    ]);
    expect(actions.toSorted()).toEqual(['none', 'opened']);
    expect(
      [...first.requests, ...second.requests].filter(
        (r) => r.path === '/repos/acme/site/issues',
      ),
    ).toHaveLength(1);
    expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe('open');
  });

  it('leaves the opening to a delivery that is already at it', async () => {
    const db = database();
    const now = new Date('2026-01-01T00:00:00.000Z');
    await saveIssue(db, 'acme/site', 'site.test', {
      number: 0,
      state: 'opening',
      signature: now.toISOString(),
    });
    const { api, requests } = github();
    expect(
      await syncIssue(
        api,
        db,
        report([error]),
        new Date(now.getTime() + CLAIM_MS - 1),
      ),
    ).toBe('none');
    expect(requests).toEqual([]);
  });

  it('takes over an opening that was left behind by a delivery that died', async () => {
    const db = database();
    const then = new Date('2026-01-01T00:00:00.000Z');
    await saveIssue(db, 'acme/site', 'site.test', {
      number: 0,
      state: 'opening',
      signature: then.toISOString(),
    });
    const { api } = github({
      'POST /repos/acme/site/issues': [201, { number: 8, state: 'open' }],
    });
    expect(
      await syncIssue(
        api,
        db,
        report([error]),
        new Date(then.getTime() + CLAIM_MS),
      ),
    ).toBe('opened');
    expect((await issueOf(db, 'acme/site', 'site.test'))?.number).toBe(8);
  });

  it('gives up its claim when GitHub refuses the issue, so the next run can try again', async () => {
    const db = database();
    await expect(
      syncIssue(
        github({ 'POST /repos/acme/site/issues': 422 }).api,
        db,
        report([error]),
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(await issueOf(db, 'acme/site', 'site.test')).toBeUndefined();
    expect(await syncIssue(github().api, db, report([error]))).toBe('opened');
  });

  it('makes no comment when closing or reopening the issue failed', async () => {
    const db = await open('x');
    const closing = github({ 'PATCH /repos/acme/site/issues/12': 500 });
    await expect(syncIssue(closing.api, db, report([]))).rejects.toMatchObject({
      status: 500,
    });
    expect(said(closing.requests)).toEqual([]);
    const fixed = database();
    await saveIssue(fixed, 'acme/site', 'site.test', {
      number: 12,
      state: 'fixed',
      signature: '',
    });
    const reopening = github({ 'PATCH /repos/acme/site/issues/12': 500 });
    await expect(
      syncIssue(reopening.api, fixed, report([error])),
    ).rejects.toMatchObject({ status: 500 });
    expect(said(reopening.requests)).toEqual([]);
  });

  it('makes no comment on an issue that was deleted when it closed it', async () => {
    const db = await open('x');
    const { api, requests } = github({
      'PATCH /repos/acme/site/issues/12': 404,
    });
    expect(await syncIssue(api, db, report([]))).toBe('closed');
    expect(said(requests)).toEqual([]);
  });
});

describe('originOf', () => {
  it('looks the pull request up once however many times it is asked', async () => {
    const { api, requests } = github({
      'GET /repos/acme/site/commits/abc1234def/pulls': [
        200,
        [{ number: 7, merged_at: null }],
      ],
    });
    const origin = originOf(api, 'acme/site', 'abc1234def');
    expect(await Promise.all([origin(), origin(), origin()])).toEqual([
      '#7 (commit `abc1234`)',
      '#7 (commit `abc1234`)',
      '#7 (commit `abc1234`)',
    ]);
    expect(requests).toHaveLength(1);
  });

  it('says the latest deployment when there is no commit, without asking', async () => {
    const { api, requests } = github();
    expect(await originOf(api, 'acme/site', null)()).toBe(
      'the latest deployment',
    );
    expect(requests).toEqual([]);
  });

  it('is used by a report that brings its own, which is not looked up again', async () => {
    const db = database();
    await saveIssue(db, 'acme/site', 'site.test', {
      number: 12,
      state: 'open',
      signature: 'x',
    });
    const { api, requests } = github();
    await syncIssue(
      api,
      db,
      report([], { origin: async () => 'the shared place' }),
    );
    expect(said(requests)[0]).toContain('as of the shared place');
    expect(requests.some((r) => r.method === 'GET')).toBe(false);
  });
});

import { describe, expect, it, jest } from '@jest/globals';

import { CHECKS } from '@/domain/checks/catalogue';
import { createDatabase } from '@/domain/db/client';
import { issuesOf } from '@/domain/db/issue-history';
import {
  CLAIM_MS,
  claimNewIssue,
  issueOf,
  issuesOfHost,
  openIssuesOf,
  legacyIssueOf,
  saveIssue,
} from '@/domain/db/suite';
import type { StoredFinding } from '@/domain/suite/diff';
import type { Level } from '@/domain/suite/rules';
import {
  CHECK_NAME,
  ISSUE_LABEL,
  MAX_NEW_ISSUES,
  closeUndeployed,
  newBudget,
  noteDeferred,
  originOf,
  publishCheckRun,
  publishUnreachable,
  signatureOf,
  syncIssues,
  type SiteReport,
} from '@/domain/suite/publish';

import { github, lines, said } from '../../helpers/fake-github';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const database = () => createDatabase(sqliteD1(...APP_MIGRATIONS).d1);

/** A database and its raw handle, for rows the app no longer writes. */
function withRaw() {
  const made = sqliteD1(...APP_MIGRATIONS);
  return { made, db: createDatabase(made.d1) };
}

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

/** The rules of the tests: three checks on. */
const LEVELS: ReadonlyMap<string, Level> = new Map([
  ['seo-viewport', 'on'],
  ['seo-http-status', 'on'],
  ['seo-links', 'on'],
]);

const report = (
  findings: StoredFinding[],
  more: Partial<SiteReport> = {},
): SiteReport => ({
  repo: 'acme/site',
  host: 'site.test',
  sha: 'abc1234def',
  url: 'https://site.test/',
  level: 'error',
  levels: LEVELS,
  findings,
  source: null,
  problems: [],
  ...more,
});

/** Stores an open issue for a check, as the app would have after opening it. */
const open = (
  db: ReturnType<typeof database>,
  check: string,
  number: number,
  signature = 'old',
  host = 'site.test',
  reopens = 0,
) =>
  saveIssue(db, 'acme/site', host, check, {
    number,
    state: 'open',
    signature,
    reopens,
  });

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

describe('syncIssues: opening', () => {
  it('opens one issue for each check that finds a problem, and remembers each', async () => {
    const db = database();
    const { api, requests } = github();
    const actions = await syncIssues(api, db, report([error, other]));
    expect([...actions]).toEqual([
      ['seo-viewport', 'opened'],
      ['seo-http-status', 'opened'],
    ]);
    expect(lines(requests)).toEqual([
      'POST /repos/acme/site/issues',
      'POST /repos/acme/site/issues',
    ]);
    expect(requests[0]?.body).toMatchObject({
      title: expect.stringMatching(/^\[Plumbline\] .+ on site\.test$/),
      labels: [ISSUE_LABEL],
    });
    expect(String(requests[0]?.body['body'])).toContain(
      '<!-- plumbline:site.test:seo-viewport -->',
    );
    expect(String(requests[1]?.body['body'])).toContain(
      '<!-- plumbline:site.test:seo-http-status -->',
    );
    expect(await issueOf(db, 'acme/site', 'site.test', 'seo-viewport')).toEqual(
      {
        number: 21,
        state: 'open',
        signature: await signatureOf([error]),
        reopens: 0,
      },
    );
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-http-status'))?.number,
    ).toBe(22);
  });

  it('keeps a history, one issue under each check', async () => {
    const db = database();
    const { api } = github();
    await syncIssues(api, db, report([error, other]));
    expect(
      (await issuesOf(db, 'acme/site', 'site.test'))
        .map((i) => [i.number, i.state, ...i.checks])
        .toSorted(),
    ).toEqual([
      [21, 'open', 'seo-viewport'],
      [22, 'open', 'seo-http-status'],
    ]);
  });

  it('puts the link to the results in the issue when it is given', async () => {
    const db = database();
    const { api, requests } = github();
    await syncIssues(
      api,
      db,
      report([error], { pageUrl: 'https://app.test/repos/acme/site' }),
    );
    expect(String(requests[0]?.body['body'])).toContain(
      'https://app.test/repos/acme/site',
    );
  });

  it('does nothing when there is nothing to report and no issue', async () => {
    const { api, requests } = github();
    await syncIssues(api, database(), report([]));
    expect(requests).toEqual([]);
  });

  it('does not count a warning when only errors open an issue, and counts it when the level says so', async () => {
    const { api, requests } = github();
    await syncIssues(api, database(), report([warning]));
    expect(requests).toEqual([]);
    await syncIssues(api, database(), report([warning], { level: 'warning' }));
    expect(lines(requests)).toEqual(['POST /repos/acme/site/issues']);
  });

  it('opens nothing at all when issues are off', async () => {
    const { api, requests } = github();
    await syncIssues(api, database(), report([error], { level: 'off' }));
    expect(requests).toEqual([]);
  });

  it('keeps the issues of two sites of one repository apart: the same failing check gives an issue for each', async () => {
    const db = database();
    const { api, requests } = github();
    await syncIssues(api, db, report([error]));
    await syncIssues(api, db, report([error], { host: 'b.test' }));
    expect(lines(requests)).toEqual([
      'POST /repos/acme/site/issues',
      'POST /repos/acme/site/issues',
    ]);
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.number,
    ).toBe(21);
    expect(
      (await issueOf(db, 'acme/site', 'b.test', 'seo-viewport'))?.number,
    ).toBe(22);
    expect(String(requests[1]?.body['body'])).toContain(
      '<!-- plumbline:b.test:seo-viewport -->',
    );
  });

  it('keeps the issues of two repositories apart', async () => {
    const db = database();
    const { api } = github();
    await syncIssues(api, db, report([error]));
    await syncIssues(api, db, report([error], { repo: 'acme/other' }));
    expect(
      (await issueOf(db, 'acme/other', 'site.test', 'seo-viewport'))?.number,
    ).toBe(22);
  });

  it('pauses before each write to GitHub', async () => {
    const pause = jest.fn(async () => undefined);
    const { api, requests } = github();
    await syncIssues(api, database(), report([error, other], { pause }));
    expect(pause).toHaveBeenCalledTimes(requests.length);
    expect(requests).toHaveLength(2);
  });
});

describe('syncIssues: the first run of a site with many problems', () => {
  const failing = CHECKS.slice(0, MAX_NEW_ISSUES + 5).map(
    (check): StoredFinding => ({
      id: check.id,
      severity: 'error',
      message: `${check.id} fails`,
    }),
  );
  const levels: ReadonlyMap<string, Level> = new Map(
    CHECKS.map((check) => [check.id, 'on' as const]),
  );

  it(`opens at most ${MAX_NEW_ISSUES} issues in a run, in the order the checks come`, async () => {
    const db = database();
    const { api, requests } = github();
    const budget = newBudget();
    const actions = await syncIssues(
      api,
      db,
      report(failing, { levels, budget }),
    );
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(
      MAX_NEW_ISSUES,
    );
    expect([...actions.values()].filter((a) => a === 'opened')).toHaveLength(
      MAX_NEW_ISSUES,
    );
    expect(budget).toMatchObject({ remaining: 0, deferred: 5 });
    const waiting = failing.slice(MAX_NEW_ISSUES).map((f) => f.id);
    for (const id of waiting) {
      expect(await issueOf(db, 'acme/site', 'site.test', id)).toBeUndefined();
    }
  });

  it('opens the rest on the next runs', async () => {
    const db = database();
    const { api, requests } = github();
    await syncIssues(api, db, report(failing, { levels }));
    const second = newBudget();
    await syncIssues(api, db, report(failing, { levels, budget: second }));
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(
      MAX_NEW_ISSUES + 5,
    );
    expect(second.deferred).toBe(0);
  });

  it('shares the limit between the sites of a repository', async () => {
    const db = database();
    const { api, requests } = github();
    const budget = newBudget();
    await syncIssues(api, db, report(failing, { levels, budget }));
    await syncIssues(
      api,
      db,
      report(failing, { levels, budget, host: 'b.test' }),
    );
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(
      MAX_NEW_ISSUES,
    );
    expect(budget.deferred).toBe(5 + MAX_NEW_ISSUES + 5);
  });

  it('says on the issue opened last that more will follow, and says nothing when all found room', async () => {
    const db = database();
    const { api, requests } = github();
    const budget = newBudget();
    await syncIssues(api, db, report(failing, { levels, budget }));
    await noteDeferred(api, 'acme/site', budget);
    const note = requests.at(-1);
    expect(note?.path).toBe(
      `/repos/acme/site/issues/${20 + MAX_NEW_ISSUES}/comments`,
    );
    expect(said(requests).at(-1)).toContain('5 more problems than');
    const quiet = github();
    await noteDeferred(quiet.api, 'acme/site', newBudget());
    expect(quiet.requests).toEqual([]);
  });

  it('counts a limit that is too small as a limit, not an error', async () => {
    const { api, requests } = github();
    await syncIssues(
      api,
      database(),
      report([error, other], { budget: newBudget(1) }),
    );
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1);
  });
});

describe('syncIssues: while a problem lasts', () => {
  it('edits the issue when what the check finds changes, without reopening it or commenting', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api, requests } = github();
    const actions = await syncIssues(api, db, report([error]));
    expect([...actions]).toEqual([['seo-viewport', 'updated']]);
    expect(lines(requests)).toEqual(['PATCH /repos/acme/site/issues/12']);
    expect(requests[0]?.body).not.toHaveProperty('state');
    expect(String(requests[0]?.body['body'])).toContain('no viewport');
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.signature,
    ).toBe(await signatureOf([error]));
  });

  it('does nothing when what the check finds is what the issue says', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12, await signatureOf([error]));
    const { api, requests } = github();
    const actions = await syncIssues(api, db, report([error]));
    expect([...actions]).toEqual([['seo-viewport', 'none']]);
    expect(requests).toEqual([]);
  });

  it('keeps the same signature when only the numbers in a message change', async () => {
    const a = { ...error, message: 'took 1234 ms' };
    const b = { ...error, message: 'took 1300 ms' };
    expect(await signatureOf([a])).toBe(await signatureOf([b]));
  });

  it('opens one issue for a check when two deliveries find the problem at the same time', async () => {
    const db = database();
    const { api, requests } = github();
    const results = await Promise.all([
      syncIssues(api, db, report([error])),
      syncIssues(api, db, report([error])),
    ]);
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1);
    expect(results.map((r) => r.get('seo-viewport')).toSorted()).toEqual([
      'none',
      'opened',
    ]);
  });

  it('opens nothing twice when a delivery is sent again', async () => {
    const db = database();
    const { api, requests } = github();
    await syncIssues(api, db, report([error, other]));
    const again = await syncIssues(api, db, report([error, other]));
    expect([...again.values()]).toEqual(['none', 'none']);
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(2);
  });

  it('leaves the opening to a delivery that is already at it', async () => {
    const db = database();
    const then = new Date('2026-01-01T00:00:00.000Z');
    await claimNewIssue(db, 'acme/site', 'site.test', 'seo-viewport', then);
    const { api, requests } = github();
    const actions = await syncIssues(
      api,
      db,
      report([error]),
      new Date(then.getTime() + 1000),
    );
    expect([...actions]).toEqual([['seo-viewport', 'none']]);
    expect(requests).toEqual([]);
  });

  it('takes over an opening that was left behind by a delivery that died', async () => {
    const db = database();
    const then = new Date('2026-01-01T00:00:00.000Z');
    await claimNewIssue(db, 'acme/site', 'site.test', 'seo-viewport', then);
    const { api } = github();
    const actions = await syncIssues(
      api,
      db,
      report([error]),
      new Date(then.getTime() + CLAIM_MS),
    );
    expect(actions.get('seo-viewport')).toBe('opened');
  });

  it('gives up its claim when GitHub refuses the issue, so the next run can try again', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = database();
    const failing = github({ 'POST /repos/acme/site/issues': 500 });
    await syncIssues(failing.api, db, report([error]));
    expect(await issueOf(db, 'acme/site', 'site.test', 'seo-viewport')).toBe(
      undefined,
    );
    const { api } = github();
    const actions = await syncIssues(api, db, report([error]));
    expect(actions.get('seo-viewport')).toBe('opened');
  });

  it('opens a new issue when the old one was deleted', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api, requests } = github({
      'PATCH /repos/acme/site/issues/12': 404,
    });
    const actions = await syncIssues(api, db, report([error]));
    expect(actions.get('seo-viewport')).toBe('opened');
    expect(lines(requests)).toEqual([
      'PATCH /repos/acme/site/issues/12',
      'POST /repos/acme/site/issues',
    ]);
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.number,
    ).toBe(21);
  });

  it('keeps going with the other checks when GitHub fails for one, and says what it could not do', async () => {
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const db = database();
    await open(db, 'seo-viewport', 12);
    await open(db, 'seo-http-status', 13);
    const { api, requests } = github({
      'PATCH /repos/acme/site/issues/12': 500,
    });
    const actions = await syncIssues(api, db, report([error, other]));
    expect([...actions]).toEqual([['seo-http-status', 'updated']]);
    expect(requests).toHaveLength(2);
    expect(log).toHaveBeenCalled();
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.signature,
    ).toBe('old');
  });

  it('stops when GitHub refuses the app, so it does not make that worse', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    await open(db, 'seo-http-status', 13);
    const { api, requests } = github({
      'PATCH /repos/acme/site/issues/12': 403,
    });
    await expect(
      syncIssues(api, db, report([error, other])),
    ).rejects.toMatchObject({ status: 403 });
    expect(requests).toHaveLength(1);
  });
});

describe('syncIssues: when the problem is gone', () => {
  it('closes the issue of a check that is fixed, and says so', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12, 'sig');
    const { api, requests } = github();
    const actions = await syncIssues(api, db, report([]));
    expect([...actions]).toEqual([['seo-viewport', 'closed']]);
    expect(requests[0]).toMatchObject({
      method: 'PATCH',
      path: '/repos/acme/site/issues/12',
      body: { state: 'closed', state_reason: 'completed' },
    });
    expect(said(requests)[0]).toContain('no longer finds this problem');
    expect(said(requests)[0]).toContain('commit `abc1234`');
    expect(await issueOf(db, 'acme/site', 'site.test', 'seo-viewport')).toEqual(
      {
        number: 12,
        state: 'fixed',
        signature: '',
        reopens: 0,
      },
    );
    expect((await issuesOf(db, 'acme/site', 'site.test'))[0]?.state).toBe(
      'fixed',
    );
  });

  it('closes only the issue of the check that is fixed', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12, await signatureOf([error]));
    await open(db, 'seo-http-status', 13, await signatureOf([other]));
    const { api, requests } = github();
    await syncIssues(api, db, report([other]));
    expect(lines(requests).filter((line) => !line.startsWith('GET '))).toEqual([
      'PATCH /repos/acme/site/issues/12',
      'POST /repos/acme/site/issues/12/comments',
    ]);
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-http-status'))?.state,
    ).toBe('open');
  });

  it('reopens the issue, saying so, when the problem is back', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12, 'sig');
    const { api, requests } = github();
    await syncIssues(api, db, report([]));
    const back = await syncIssues(api, db, report([error]));
    expect(back.get('seo-viewport')).toBe('reopened');
    const edit = requests.filter((r) => r.method === 'PATCH').at(-1);
    expect(edit?.body).toMatchObject({
      state: 'open',
      state_reason: 'reopened',
    });
    expect(said(requests).at(-1)).toContain('back as of');
  });

  it('says where the fix came in, once however many issues it closes', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    await open(db, 'seo-http-status', 13);
    const { api, requests } = github({
      'GET /repos/acme/site/commits/abc1234def/pulls': [
        200,
        [{ number: 7, merged_at: null }],
      ],
    });
    await syncIssues(api, db, report([]));
    expect(said(requests)[0]).toContain('#7 (commit `abc1234`)');
    expect(requests.filter((r) => r.method === 'GET')).toHaveLength(1);
  });

  it('uses the place a report brings and does not look it up', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api, requests } = github();
    await syncIssues(
      api,
      db,
      report([], { origin: async () => 'the shared place' }),
    );
    expect(said(requests)[0]).toContain('as of the shared place');
    expect(requests.some((r) => r.method === 'GET')).toBe(false);
  });

  it('makes no comment when closing the issue failed, and keeps it open', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api, requests } = github({
      'PATCH /repos/acme/site/issues/12': 500,
    });
    await syncIssues(api, db, report([]));
    expect(said(requests)).toEqual([]);
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.state,
    ).toBe('open');
  });

  it('makes no comment on an issue that was deleted when it closed it', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api, requests } = github({
      'PATCH /repos/acme/site/issues/12': 404,
    });
    await syncIssues(api, db, report([]));
    expect(said(requests)).toEqual([]);
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.state,
    ).toBe('fixed');
  });

  it('does not touch the issue of a check that did not run this time', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api, requests } = github();
    await syncIssues(api, db, report([], { notRun: ['seo-viewport'] }));
    expect(requests).toEqual([]);
  });
});

describe('syncIssues: when the rules change', () => {
  it('closes the issue of a check the rules turned off, with a note that links the rules', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api, requests } = github();
    const levels = new Map(LEVELS);
    levels.set('seo-viewport', 'off');
    await syncIssues(api, db, report([], { levels, source: 'plumbline.yaml' }));
    expect(requests[0]?.body).toMatchObject({
      state: 'closed',
      state_reason: 'not_planned',
    });
    expect(said(requests)[0]).toContain('turned off by the rules');
    expect(said(requests)[0]).toContain('blob/abc1234def/plumbline.yaml');
  });

  it('closes the issue of a check that is in no rule set the same way', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api, requests } = github();
    await syncIssues(api, db, report([], { levels: new Map() }));
    expect(said(requests)[0]).toContain('turned off by the rules');
  });

  it('closes the issue of a check whose findings no longer open an issue', async () => {
    const db = database();
    await open(db, 'seo-links', 12);
    const { api, requests } = github();
    await syncIssues(api, db, report([warning]));
    expect(said(requests)[0]).toContain('no longer opens an issue');
  });

  it('closes every open issue when the rules turn issues off', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    await open(db, 'seo-http-status', 13);
    const { api, requests } = github();
    await syncIssues(api, db, report([error, other], { level: 'off' }));
    expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(2);
    expect(said(requests)[0]).toContain('no longer opens an issue');
  });

  it('closes the issue of a check that is not in the catalogue any more', async () => {
    const db = database();
    await open(db, 'no-such-check', 12);
    const { api, requests } = github();
    await syncIssues(
      api,
      db,
      report([], { levels: new Map([['no-such-check', 'on']]) }),
    );
    expect(said(requests)[0]).toContain('no longer has this check');
  });

  it('opens a new issue when a check that was turned off is turned on and fails', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api } = github();
    const levels = new Map(LEVELS);
    levels.set('seo-viewport', 'off');
    await syncIssues(api, db, report([], { levels }));
    const again = await syncIssues(api, db, report([error]));
    expect(again.get('seo-viewport')).toBe('reopened');
  });
});

describe('syncIssues: an issue a person closed', () => {
  const dismissed = (
    db: ReturnType<typeof database>,
    signature: string,
    reopens: number,
  ) =>
    saveIssue(db, 'acme/site', 'site.test', 'seo-viewport', {
      number: 12,
      state: 'dismissed',
      signature,
      reopens,
    });

  it('stays closed while it reports the same problem', async () => {
    const db = database();
    await dismissed(db, await signatureOf([error]), 1);
    const { api, requests } = github();
    await syncIssues(api, db, report([error]));
    expect(requests).toEqual([]);
  });

  it('is reopened when the problem changes, saying that it did', async () => {
    const db = database();
    await dismissed(db, 'something else', 1);
    const { api, requests } = github();
    const actions = await syncIssues(api, db, report([error]));
    expect(actions.get('seo-viewport')).toBe('reopened');
    expect(said(requests)[0]).toContain('different problem');
  });

  it('is left closed, however the problem changes, once the app has stopped reopening it', async () => {
    const db = database();
    await dismissed(db, 'something else', 3);
    const { api, requests } = github();
    await syncIssues(api, db, report([error]));
    expect(requests).toEqual([]);
  });

  it('is marked fixed when the problem is gone, so a later problem is a new one', async () => {
    const db = database();
    await dismissed(db, 'sig', 3);
    const { api, requests } = github();
    await syncIssues(api, db, report([]));
    expect(requests).toEqual([]);
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.state,
    ).toBe('dismissed');
  });
});

describe('the issues of the old kind, one for each site', () => {
  const legacy = (state: string, number = 7) => {
    const { made, db } = withRaw();
    made.raw
      .prepare(
        'INSERT INTO suite_issues (repo, host, number, state, signature) VALUES (?, ?, ?, ?, ?)',
      )
      .run('acme/site', 'site.test', number, state, 'sig');
    return db;
  };

  it('closes the old issue with a note and opens one for each check that still fails', async () => {
    const db = legacy('open');
    const { api, requests } = github();
    await syncIssues(api, db, report([error, other]));
    expect(requests[0]).toMatchObject({
      method: 'PATCH',
      path: '/repos/acme/site/issues/7',
      body: { state: 'closed' },
    });
    expect(said(requests)[0]).toContain('one issue for each check');
    expect(
      requests.filter((r) => r.path === '/repos/acme/site/issues'),
    ).toHaveLength(2);
    expect(await legacyIssueOf(db, 'acme/site', 'site.test')).toBeUndefined();
  });

  it('forgets an old issue a person had closed, without asking GitHub', async () => {
    const db = legacy('dismissed');
    const { api, requests } = github();
    await syncIssues(api, db, report([]));
    expect(requests).toEqual([]);
    expect(await legacyIssueOf(db, 'acme/site', 'site.test')).toBeUndefined();
  });

  it('forgets an old issue that is gone from GitHub', async () => {
    const db = legacy('open');
    const { api } = github({ 'PATCH /repos/acme/site/issues/7': 404 });
    await syncIssues(api, db, report([]));
    expect(await legacyIssueOf(db, 'acme/site', 'site.test')).toBeUndefined();
  });

  it('does it once: the next run finds nothing of the old kind', async () => {
    const db = legacy('open');
    const first = github();
    await syncIssues(first.api, db, report([]));
    const second = github();
    await syncIssues(second.api, db, report([]));
    expect(second.requests).toEqual([]);
  });

  it('no longer lists the old issue under any check', async () => {
    const { made, db } = withRaw();
    made.raw
      .prepare(
        "INSERT INTO suite_issues (repo, host, number, state, signature) VALUES ('acme/site', 'site.test', 7, 'open', 's')",
      )
      .run();
    made.raw
      .prepare(
        "INSERT INTO suite_issue_history (repo, host, number, state, opened_at, checks) VALUES ('acme/site', 'site.test', 7, 'open', '2026-01-01T00:00:00.000Z', '[\"seo-viewport\",\"seo-links\"]')",
      )
      .run();
    expect(await issuesOf(db, 'acme/site', 'site.test')).toHaveLength(1);
    const { api } = github();
    await syncIssues(api, db, report([]));
    expect(await issuesOf(db, 'acme/site', 'site.test')).toEqual([]);
  });
});

describe('closeUndeployed', () => {
  it('closes the issues of a site the repository no longer deploys, and keeps the others', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12, 'sig', 'gone.test');
    await open(db, 'seo-links', 13, 'sig', 'gone.test');
    await open(db, 'seo-viewport', 14, 'sig', 'site.test');
    const { api, requests } = github();
    await closeUndeployed(api, db, {
      repo: 'acme/site',
      hosts: new Set(['site.test']),
      sha: 'abc1234def',
      source: null,
    });
    expect(
      requests
        .filter((r) => r.method === 'PATCH')
        .map((r) => r.path)
        .toSorted(),
    ).toEqual(['/repos/acme/site/issues/12', '/repos/acme/site/issues/13']);
    expect(said(requests)[0]).toContain(
      'gone.test is no longer deployed from this repository',
    );
    expect(
      (await issuesOfHost(db, 'acme/site', 'site.test')).get('seo-viewport')
        ?.state,
    ).toBe('open');
    expect(
      (await issuesOfHost(db, 'acme/site', 'gone.test')).get('seo-links')
        ?.state,
    ).toBe('fixed');
  });

  it('closes every issue, saying checks were turned off, when the reason is disabled', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12, 'sig', 'a.test');
    await open(db, 'seo-links', 13, 'sig', 'b.test');
    const { api, requests } = github();
    await closeUndeployed(api, db, {
      repo: 'acme/site',
      hosts: new Set(),
      sha: null,
      source: null,
      reason: 'disabled',
    });
    expect(
      requests
        .filter((r) => r.method === 'PATCH')
        .map((r) => r.path)
        .toSorted(),
    ).toEqual(['/repos/acme/site/issues/12', '/repos/acme/site/issues/13']);
    expect(said(requests)).toHaveLength(2);
    expect(said(requests)[0]).toContain('turned off in Plumbline');
    expect((await openIssuesOf(db, 'acme/site')).length).toBe(0);
  });

  it('does nothing when every site is still deployed', async () => {
    const db = database();
    await open(db, 'seo-viewport', 12);
    const { api, requests } = github();
    await closeUndeployed(api, db, {
      repo: 'acme/site',
      hosts: new Set(['site.test']),
      sha: null,
      source: null,
    });
    expect(requests).toEqual([]);
  });

  it('closes the issue of the old kind of a site that is no longer deployed', async () => {
    const { made, db } = withRaw();
    made.raw
      .prepare(
        "INSERT INTO suite_issues (repo, host, number, state, signature) VALUES ('acme/site', 'gone.test', 9, 'open', 's')",
      )
      .run();
    const { api, requests } = github();
    await closeUndeployed(api, db, {
      repo: 'acme/site',
      hosts: new Set(['site.test']),
      sha: null,
      source: null,
    });
    expect(requests[0]?.path).toBe('/repos/acme/site/issues/9');
    expect(await legacyIssueOf(db, 'acme/site', 'gone.test')).toBeUndefined();
  });

  it('keeps going when one issue cannot be closed, and stops when GitHub refuses the app', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = database();
    await open(db, 'seo-viewport', 12, 'sig', 'gone.test');
    await open(db, 'seo-links', 13, 'sig', 'gone.test');
    const failing = github({ 'PATCH /repos/acme/site/issues/12': 500 });
    await closeUndeployed(failing.api, db, {
      repo: 'acme/site',
      hosts: new Set(),
      sha: null,
      source: null,
    });
    expect(failing.requests.filter((r) => r.method === 'PATCH')).toHaveLength(
      2,
    );
    const refused = github({ 'PATCH /repos/acme/site/issues/12': 403 });
    await expect(
      closeUndeployed(refused.api, db, {
        repo: 'acme/site',
        hosts: new Set(),
        sha: null,
        source: null,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('publishCheckRun', () => {
  const preview = {
    repo: 'acme/site',
    sha: 'abc1234',
    url: 'https://pr-3.site.test/',
    source: null,
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

  it('opens the report from the check, and carries its id', async () => {
    const { api, requests } = github();
    await publishCheckRun(api, {
      ...preview,
      findings: [error],
      reportUrl: 'https://plumbline.test/r/abc',
      reportId: 'abc',
    });
    expect(requests[0]?.body).toMatchObject({
      details_url: 'https://plumbline.test/r/abc',
      external_id: 'abc',
      output: { text: expect.stringContaining('```json') },
    });
  });

  it('links the preview itself when there is no report', async () => {
    const { api, requests } = github();
    await publishCheckRun(api, { ...preview, findings: [error] });
    expect(requests[0]?.body).not.toHaveProperty('external_id');
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
});

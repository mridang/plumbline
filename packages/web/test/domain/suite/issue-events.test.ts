import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { disableRepo } from '@/domain/db/disabled';
import { issuesOf as historyOf } from '@/domain/db/issue-history';
import { issueOf, saveIssue, type IssueState } from '@/domain/db/suite';
import { botLogin, handleIssueEvent } from '@/domain/suite/issue-events';
import { MAX_REOPENS } from '@/domain/suite/publish';

import { github, said } from '../../helpers/fake-github';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const SLUG = 'plumbline-test';
const CHECK = 'seo-viewport';

const setup = async (state: IssueState = 'open', reopens = 0) => {
  const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
  await saveIssue(db, 'acme/site', 'site.test', CHECK, {
    number: 12,
    state,
    signature: 'sig',
    reopens,
  });
  return db;
};

const event = (action: string, sender = 'someone', number = 12) => ({
  action,
  repository: { full_name: 'acme/site' },
  issue: { number },
  sender: { login: sender },
});

const stored = (db: Awaited<ReturnType<typeof setup>>) =>
  issueOf(db, 'acme/site', 'site.test', CHECK);

describe('botLogin', () => {
  it('is the name GitHub gives the account of an app', () => {
    expect(botLogin('plumbline')).toBe('plumbline[bot]');
  });
});

describe('handleIssueEvent in a repository whose checks are off', () => {
  it('ignores a closed issue: nothing is reopened and no comment is made', async () => {
    const db = await setup();
    await disableRepo(db, 1, 'acme/site');
    const { api, requests } = github();
    await handleIssueEvent(db, SLUG, event('closed'), async () => api);
    expect(requests).toEqual([]);
    const issue = await stored(db);
    expect(issue?.state).toBe('open');
  });
});

describe('handleIssueEvent', () => {
  it('reopens an issue a person closed while the problem is still there, and says why', async () => {
    const db = await setup();
    const { api, requests } = github();
    await handleIssueEvent(db, SLUG, event('closed'), async () => api);
    expect(requests[0]).toMatchObject({
      method: 'PATCH',
      path: '/repos/acme/site/issues/12',
      body: { state: 'open', state_reason: 'reopened' },
    });
    expect(said(requests)[0]).toContain('Please do not close this issue');
    expect(said(requests)[0]).toContain('seo-viewport: off');
    expect(await stored(db)).toEqual({
      number: 12,
      state: 'open',
      signature: 'sig',
      reopens: 1,
    });
  });

  it(`reopens it ${MAX_REOPENS} times and then leaves it closed, saying so`, async () => {
    const db = await setup();
    const { api, requests } = github();
    for (let n = 1; n <= MAX_REOPENS; n += 1) {
      await handleIssueEvent(db, SLUG, event('closed'), async () => api);
      const issue = await stored(db);
      expect(issue?.reopens).toBe(n);
      expect(issue?.state).toBe('open');
    }
    const before = requests.length;
    await handleIssueEvent(db, SLUG, event('closed'), async () => api);
    expect(await stored(db)).toMatchObject({
      state: 'dismissed',
      reopens: MAX_REOPENS,
    });
    // It made no edit this time, only the last word.
    expect(requests.slice(before).map((r) => r.method)).toEqual(['POST']);
    expect(said(requests).at(-1)).toContain('will not reopen it');
  });

  it('keeps the history of the issue as it is reopened', async () => {
    const db = await setup();
    const { api } = github();
    await handleIssueEvent(db, SLUG, event('closed'), async () => api);
    const history = await historyOf(db, 'acme/site', 'site.test');
    expect(history.map((i) => [i.number, i.state])).toEqual([[12, 'open']]);
  });

  it('asks GitHub for nothing when it has nothing to answer', async () => {
    let asked = 0;
    const makeApi = async () => {
      asked += 1;
      return github().api;
    };
    const db = await setup('fixed');
    await handleIssueEvent(db, SLUG, event('closed'), makeApi);
    await handleIssueEvent(db, SLUG, event('edited'), makeApi);
    await handleIssueEvent(db, SLUG, event('closed', 'someone', 99), makeApi);
    expect(asked).toBe(0);
  });

  it('leaves an issue the app closed as it is when it is closed again', async () => {
    const db = await setup('fixed');
    const { api, requests } = github();
    await handleIssueEvent(db, SLUG, event('closed'), async () => api);
    const issue = await stored(db);
    expect(issue?.state).toBe('fixed');
    expect(requests).toEqual([]);
  });

  it.each(['fixed', 'dismissed'] as const)(
    'notes that a person reopened an issue that was %s',
    async (state) => {
      const db = await setup(state, 2);
      const { api, requests } = github();
      await handleIssueEvent(db, SLUG, event('reopened'), async () => api);
      expect(await stored(db)).toMatchObject({ state: 'open', reopens: 2 });
      expect(requests).toEqual([]);
    },
  );

  it('ignores what the app did itself, and does not answer its own reopening', async () => {
    const db = await setup();
    const { api, requests } = github();
    await handleIssueEvent(
      db,
      SLUG,
      event('closed', botLogin(SLUG)),
      async () => api,
    );
    const issue = await stored(db);
    expect(issue?.state).toBe('open');
    const closed = await setup('fixed');
    await handleIssueEvent(
      closed,
      SLUG,
      event('reopened', botLogin(SLUG)),
      async () => api,
    );
    const closedIssue = await issueOf(closed, 'acme/site', 'site.test', CHECK);
    expect(closedIssue?.state).toBe('fixed');
    expect(requests).toEqual([]);
  });

  it('forgets an issue that was deleted, whoever deleted it', async () => {
    for (const sender of ['someone', botLogin(SLUG)]) {
      const db = await setup();
      const { api } = github();
      await handleIssueEvent(
        db,
        SLUG,
        event('deleted', sender),
        async () => api,
      );
      expect(await stored(db)).toBeUndefined();
    }
  });

  it('ignores an issue the app did not open, in this or another repository', async () => {
    const db = await setup();
    const { api, requests } = github();
    await handleIssueEvent(
      db,
      SLUG,
      event('closed', 'someone', 99),
      async () => api,
    );
    await handleIssueEvent(
      db,
      SLUG,
      { ...event('closed'), repository: { full_name: 'acme/other' } },
      async () => api,
    );
    const issue = await stored(db);
    expect(issue?.state).toBe('open');
    expect(requests).toEqual([]);
  });

  it('ignores other changes to its issues, and a delivery with no issue or repository', async () => {
    const db = await setup();
    const { api, requests } = github();
    const make = async () => api;
    await handleIssueEvent(db, SLUG, event('edited'), make);
    await handleIssueEvent(db, SLUG, event('labeled'), make);
    await handleIssueEvent(db, SLUG, { action: 'closed' }, make);
    await handleIssueEvent(
      db,
      SLUG,
      { action: 'closed', issue: { number: 12 } },
      make,
    );
    const issue = await stored(db);
    expect(issue?.state).toBe('open');
    expect(requests).toEqual([]);
  });
});

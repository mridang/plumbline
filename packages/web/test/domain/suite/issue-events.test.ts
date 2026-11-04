import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { issueOf, saveIssue, type IssueState } from '@/domain/db/suite';
import { botLogin, handleIssueEvent } from '@/domain/suite/issue-events';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const SLUG = 'plumbline-test';

const setup = async (state: IssueState = 'open') => {
  const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
  await saveIssue(db, 'acme/site', 'site.test', {
    number: 12,
    state,
    signature: 'sig',
  });
  return db;
};

const event = (action: string, sender = 'someone', number = 12) => ({
  action,
  repository: { full_name: 'acme/site' },
  issue: { number },
  sender: { login: sender },
});

describe('botLogin', () => {
  it('is the name GitHub gives the account of an app', () => {
    expect(botLogin('plumbline')).toBe('plumbline[bot]');
  });
});

describe('handleIssueEvent', () => {
  it('notes that a person closed an open issue, keeping what it reported', async () => {
    const db = await setup();
    await handleIssueEvent(db, SLUG, event('closed'));
    expect(await issueOf(db, 'acme/site', 'site.test')).toEqual({
      number: 12,
      state: 'dismissed',
      signature: 'sig',
    });
  });

  it('leaves an issue the app closed as it is when it is closed again', async () => {
    const db = await setup('fixed');
    await handleIssueEvent(db, SLUG, event('closed'));
    expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe('fixed');
  });

  it.each(['fixed', 'dismissed'] as const)(
    'notes that a person reopened an issue that was %s',
    async (state) => {
      const db = await setup(state);
      await handleIssueEvent(db, SLUG, event('reopened'));
      expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe('open');
    },
  );

  it('ignores what the app did itself', async () => {
    const db = await setup();
    await handleIssueEvent(db, SLUG, event('closed', botLogin(SLUG)));
    expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe('open');
    const closed = await setup('fixed');
    await handleIssueEvent(closed, SLUG, event('reopened', botLogin(SLUG)));
    expect((await issueOf(closed, 'acme/site', 'site.test'))?.state).toBe(
      'fixed',
    );
  });

  it('forgets an issue that was deleted, whoever deleted it', async () => {
    for (const sender of ['someone', botLogin(SLUG)]) {
      const db = await setup();
      await handleIssueEvent(db, SLUG, event('deleted', sender));
      expect(await issueOf(db, 'acme/site', 'site.test')).toBeUndefined();
    }
  });

  it('ignores an issue the app did not open, in this or another repository', async () => {
    const db = await setup();
    await handleIssueEvent(db, SLUG, event('closed', 'someone', 99));
    await handleIssueEvent(db, SLUG, {
      ...event('closed'),
      repository: { full_name: 'acme/other' },
    });
    expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe('open');
  });

  it('ignores other changes to its issues, and a delivery with no issue or repository', async () => {
    const db = await setup();
    await handleIssueEvent(db, SLUG, event('edited'));
    await handleIssueEvent(db, SLUG, event('labeled'));
    await handleIssueEvent(db, SLUG, { action: 'closed' });
    await handleIssueEvent(db, SLUG, {
      action: 'closed',
      issue: { number: 12 },
    });
    expect((await issueOf(db, 'acme/site', 'site.test'))?.state).toBe('open');
  });
});

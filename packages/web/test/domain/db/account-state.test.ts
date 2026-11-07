import { describe, expect, it } from '@jest/globals';

import { connectionState } from '@/domain/db/account-state';
import { linkAccount } from '@/domain/db/github';
import { oauthGrants } from '@/domain/db/schema';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

const grant = (id: string, revoked: string | null) => ({
  id,
  user_id: 1,
  client_id: 'c',
  scope: 'read',
  resource: 'r',
  created_at: '2026-01-01',
  revoked_at: revoked,
});

describe('connectionState', () => {
  it('is nothing connected for a new person', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    expect(await connectionState(db, 1)).toEqual({
      github: false,
      assistants: false,
    });
  });

  it('sees a linked GitHub account and an approved assistant', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await linkAccount(db, 1, { id: 10, login: 'ada' });
    await db.insert(oauthGrants).values(grant('g1', null));
    expect(await connectionState(db, 1)).toEqual({
      github: true,
      assistants: true,
    });
  });

  it('ignores a revoked assistant and other people', async () => {
    const { db } = sqliteDatabase(...APP_MIGRATIONS);
    await db.insert(oauthGrants).values(grant('g1', '2026-02-01'));
    expect((await connectionState(db, 1)).assistants).toBe(false);
    expect((await connectionState(db, 2)).assistants).toBe(false);
  });
});

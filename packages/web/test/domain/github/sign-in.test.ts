import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { peopleWithAccess } from '@/domain/db/access';
import { linkAccount } from '@/domain/db/github';
import { upsertUser } from '@/domain/db/users';
import {
  noreplyOf,
  signInWithGitHub,
  signedInWithGithub,
  subjectOf,
} from '@/domain/github/sign-in';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const identity = {
  id: 42,
  login: 'octo',
  name: 'Octo Cat',
  picture: 'https://avatars.test/42',
  installations: [{ id: 5, account: 'acme' }],
};

const made = () => {
  const { d1, raw } = sqliteD1(...APP_MIGRATIONS);
  return { db: createDatabase(d1), raw };
};

describe('signInWithGitHub', () => {
  it('makes a person of a GitHub account that is linked to no one, and links it', async () => {
    const { db, raw } = made();
    const user = await signInWithGitHub(db, identity, ['acme/site']);
    expect(user).toMatchObject({
      google_sub: subjectOf(42),
      email: noreplyOf(identity),
      name: 'Octo Cat',
      picture: 'https://avatars.test/42',
    });
    expect(
      raw.prepare('SELECT user_id, github_id FROM github_links').all(),
    ).toEqual([{ user_id: user.id, github_id: 42 }]);
  });

  it('signs in as the same person next time, and does not make another', async () => {
    const { db, raw } = made();
    const first = await signInWithGitHub(db, identity, ['acme/site']);
    const again = await signInWithGitHub(db, identity, ['acme/site']);
    expect(again.id).toBe(first.id);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({
      n: 1,
    });
  });

  it('signs in as the person a GitHub account was linked to from their Google account', async () => {
    const { db, raw } = made();
    const google = await upsertUser(db, {
      google_sub: 'google-sub-1',
      email: 'a@example.com',
    });
    await linkAccount(db, google.id, { id: 42, login: 'octo' });
    const user = await signInWithGitHub(db, identity, ['acme/site']);
    expect(user.id).toBe(google.id);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({
      n: 1,
    });
  });

  it('keeps the repositories they can reach, and replaces them each time', async () => {
    const { db } = made();
    const user = await signInWithGitHub(db, identity, [
      'acme/site',
      'acme/api',
    ]);
    expect(await peopleWithAccess(db, 'acme/site')).toEqual([user.id]);
    await signInWithGitHub(db, identity, ['acme/api']);
    expect(await peopleWithAccess(db, 'acme/site')).toEqual([]);
    expect(await peopleWithAccess(db, 'acme/api')).toEqual([user.id]);
  });

  it('makes a person of each GitHub account, with their own access', async () => {
    const { db } = made();
    const one = await signInWithGitHub(db, identity, ['acme/site']);
    const two = await signInWithGitHub(
      db,
      { ...identity, id: 43, login: 'other' },
      ['acme/other'],
    );
    expect(two.id).not.toBe(one.id);
    expect(await peopleWithAccess(db, 'acme/site')).toEqual([one.id]);
  });

  it('uses the login when the profile has no name and leaves out a missing picture', async () => {
    const { db } = made();
    const user = await signInWithGitHub(
      db,
      { ...identity, name: null, picture: null },
      [],
    );
    expect(user.name).toBe('octo');
    expect(user.picture).toBeNull();
  });
});

describe('noreplyOf', () => {
  it('is the address GitHub gives the account', () => {
    expect(noreplyOf(identity)).toBe('42+octo@users.noreply.github.com');
  });
});

describe('signedInWithGithub', () => {
  it('is true for a person keyed by their GitHub account, and false for a Google one', () => {
    expect(signedInWithGithub({ google_sub: subjectOf(42) })).toBe(true);
    expect(signedInWithGithub({ google_sub: '1234567890' })).toBe(false);
  });
});

import { beforeEach, describe, expect, it } from '@jest/globals';

import type { CurrentUserResolver } from '@/domain/api/auth';
import { createUserSelf, userResource } from '@/domain/api/users';
import type { User } from '@/domain/db/users';

const person: User = {
  id: 7,
  google_sub: 'sub-7',
  email: 'ada@example.com',
  name: 'Ada',
  picture: 'https://pics.example/ada',
  session_epoch: 3,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

/** Who is signed in; null means nobody. */
const session: { user: User | null } = { user: person };

/** Identity injected in place of the session cookie. */
const resolver: CurrentUserResolver = {
  currentUid: async () => session.user?.id ?? null,
  currentLiveUid: async () => session.user?.id ?? null,
  currentUser: async () => session.user,
};

const { GET } = createUserSelf(resolver).handlers();

beforeEach(() => {
  session.user = person;
});

const read = () => GET(new Request('https://plumbline.test/api/users/self'));

describe('userResource', () => {
  it('shows who the person is and nothing internal', () => {
    expect(userResource(person)).toEqual({
      email: 'ada@example.com',
      name: 'Ada',
      picture: 'https://pics.example/ada',
      created_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('leaves out a name and picture Google did not share', () => {
    expect(userResource({ ...person, name: null, picture: null })).toEqual({
      email: 'ada@example.com',
      created_at: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('GET /api/users/self', () => {
  it('answers the signed-in person’s account', async () => {
    const response = await read();
    expect(await response.json()).toEqual(userResource(person));
  });

  it('is private to the person', async () => {
    const response = await read();
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('answers 401 when nobody is signed in', async () => {
    session.user = null;
    const response = await read();
    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/users/self', () => {
  it('is not offered: there is nothing to change, so Next answers 405', () => {
    expect(createUserSelf(resolver).handlers().PATCH).toBeUndefined();
  });
});

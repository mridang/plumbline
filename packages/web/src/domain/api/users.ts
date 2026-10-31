/**
 * @packageDocumentation
 *
 * The signed-in person's own account, as a controller over the `core/api`
 * framework. Only reading it is a controller: deleting it also clears the
 * session cookie, which the route does itself.
 */

import { ApiController, ok } from '@/lib/core/api';
import {
  requestCookieResolver,
  sessionUser,
  type CurrentUserResolver,
} from '@/domain/api/auth';
import type { User } from '@/domain/db/users';

/** The account as the API shows it. */
export interface UserResource {
  readonly email: string;
  readonly name?: string;
  readonly picture?: string;
  readonly created_at: string;
}

/** The API's view of a user row: who they are, nothing internal. */
export function userResource(user: Readonly<User>): UserResource {
  return {
    email: user.email,
    ...(user.name ? { name: user.name } : {}),
    ...(user.picture ? { picture: user.picture } : {}),
    created_at: user.created_at,
  };
}

/**
 * `GET /api/users/self`: the signed-in person's account. 401 when nobody is
 * signed in or the session was ended.
 */
export function createUserSelf(
  resolver: CurrentUserResolver = requestCookieResolver,
): ApiController<{ readonly user: User }> {
  return new ApiController<{ readonly user: User }>({
    context: async (request) => ({
      user: await sessionUser(request, resolver),
    }),
  }).on<null, User>({
    method: 'GET',
    handle: (_input, { user }) => user,
    encode: (user) =>
      ok(userResource(user), {
        headers: { 'Cache-Control': 'private, no-cache' },
      }),
  });
}

/** The account controller bound to the production resolver. */
export const userSelf = createUserSelf();

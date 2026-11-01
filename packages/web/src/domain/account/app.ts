/**
 * @packageDocumentation
 *
 * What this app does of its own when someone deletes their account, after the
 * shared route (`app/api/users/self/route.ts`) has removed every row kept about
 * them. plumbline keeps nothing anywhere else, so there is nothing more to do.
 */

import type { User } from '@/domain/db/users';

/** Tidy up after a person's account was deleted: nothing to do here. */
export const afterAccountDeleted: (user: Readonly<User>) => void = () =>
  undefined;

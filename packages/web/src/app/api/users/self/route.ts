/**
 * The signed-in user. `self` stands for whoever the session belongs to.
 *
 *   GET    /api/users/self   their account
 *   DELETE /api/users/self   delete the account and everything plumbline keeps
 *
 * GET lives in the `userSelf` controller; DELETE is a thin handler because it
 * clears the session cookie, which the controller's JSON pipeline does not
 * express.
 */

import { NextResponse } from 'next/server';

import { requireUser } from '@/domain/api/auth';
import { userSelf } from '@/domain/api/users';
import { SESSION_COOKIE } from '@/domain/auth/app';
import { deleteAccountData } from '@/domain/db/account';
import { getDatabase } from '@/domain/db/client';

export const dynamic = 'force-dynamic';

export const { GET } = userSelf.handlers();

/**
 * `DELETE /api/users/self`: delete the signed-in person's account. Their
 * domains, reports and connected apps go at once and their session is ended.
 * Answers 204, 401 when nobody is signed in, 403 from another site.
 */
export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return auth.response;
  }
  await deleteAccountData(getDatabase(), auth.value.id);
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

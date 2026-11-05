/**
 * GitHub's way back into the app, after the person approved it or installed
 * it. The `state` must match the cookie the round trip began with. The code is
 * traded for the person's GitHub identity, which is linked to the Google
 * account that is signed in; every installation of the app they can reach is
 * recorded as theirs; and their repositories are read in the background. Any
 * failure sends them back with a fixed flag rather than leaking details.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { linkAccount, saveInstallation } from '@/domain/db/github';
import { getDatabase } from '@/domain/db/client';
import { replaceAccess } from '@/domain/db/access';
import {
  accessibleRepositories,
  exchangeCode,
  identify,
} from '@/domain/github/oauth';
import {
  githubConfig,
  GITHUB_PATH,
  GITHUB_STATE_COOKIE,
  syncAllOf,
} from '@/domain/github/service';
import { getCurrentUser } from '@/lib/core/auth/current-user';
import { appOrigin } from '@/lib/core/origin';

/** Back to the GitHub page with the one-time cookie cleared. */
function back(origin: string, flag: string | null): NextResponse {
  const response = NextResponse.redirect(
    `${origin}${GITHUB_PATH}${flag ? `?error=${flag}` : ''}`,
  );
  response.cookies.delete(GITHUB_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = appOrigin(request);
  const config = githubConfig();
  if (!config) {
    return back(origin, 'unavailable');
  }
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  const expected = request.cookies.get(GITHUB_STATE_COOKIE)?.value;
  if (!state || !expected || state !== expected) {
    return back(origin, 'state');
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      `${origin}/auth/login?returnTo=${encodeURIComponent(GITHUB_PATH)}`,
    );
  }
  const code = searchParams.get('code');
  if (!code) {
    return back(origin, 'code');
  }
  const db = getDatabase();
  try {
    const token = await exchangeCode(config, code);
    const identity = await identify(token);
    if (!(await linkAccount(db, user.id, identity))) {
      return back(origin, 'taken');
    }
    for (const installation of identity.installations) {
      await saveInstallation(
        db,
        user.id,
        installation.id,
        installation.account,
      );
    }
    // What the person can reach is read now, so the dashboard shows them
    // the sites of every repository they can see, not only their own.
    await replaceAccess(
      db,
      user.id,
      await accessibleRepositories(token, identity.installations),
    );
  } catch (error) {
    console.error('github sign-in failed', error);
    return back(origin, 'failed');
  }
  // Read now, not in the background: the person lands on /github straight
  // after this, and the list must already be there. A failing installation
  // is skipped inside syncAllOf, so this cannot fail the connection.
  await syncAllOf(db, config, user.id);
  return back(origin, null);
}

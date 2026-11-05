/**
 * GitHub's way back into the app after someone signed in with it. The `state`
 * must match the cookie the round trip began with. The code is traded for who
 * they are and the repositories of the installed app they can reach; they get
 * an ordinary session, and the dashboard shows them those repositories. Any
 * failure sends them back to the sign-in page with a fixed flag, never anything
 * GitHub said.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { LANDING_PATH, RETURN_COOKIE, STATE_COOKIE } from '@/domain/auth/app';
import { getDatabase } from '@/domain/db/client';
import {
  accessibleRepositories,
  exchangeCode,
  identify,
} from '@/domain/github/oauth';
import { githubConfig } from '@/domain/github/service';
import { signInWithGitHub } from '@/domain/github/sign-in';
import { finishFlow, setSessionCookie } from '@/lib/core/auth';
import { appOrigin } from '@/lib/core/origin';
import { getEnv } from '@/lib/core/runtime';
import { requireSessionSecret } from '@/lib/session';
import { safeReturnPath } from '@/lib/web-security';

export const dynamic = 'force-dynamic';

/** Back to the sign-in page with a fixed flag and the one-time cookies cleared. */
function failed(origin: string, flag: string): NextResponse {
  const response = NextResponse.redirect(`${origin}/login?error=${flag}`);
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(RETURN_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = appOrigin(request);
  const config = githubConfig();
  if (!config) {
    return failed(origin, 'github');
  }
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!state || !expected || state !== expected) {
    return failed(origin, 'auth');
  }
  const code = searchParams.get('code');
  if (!code) {
    // The person pressed Cancel, or closed the window.
    return failed(origin, 'denied');
  }
  try {
    const token = await exchangeCode(config, code);
    const identity = await identify(token);
    const repositories = await accessibleRepositories(
      token,
      identity.installations,
    );
    const user = await signInWithGitHub(getDatabase(), identity, repositories);
    const returnTo = safeReturnPath(
      request.cookies.get(RETURN_COOKIE)?.value ?? null,
    );
    const response = finishFlow(origin, returnTo ?? LANDING_PATH);
    await setSessionCookie(response, user, {
      secret: requireSessionSecret(getEnv().SESSION_SECRET),
      secure: origin.startsWith('https'),
    });
    return response;
  } catch (error) {
    console.error('github sign-in failed', error);
    return failed(origin, 'auth');
  }
}

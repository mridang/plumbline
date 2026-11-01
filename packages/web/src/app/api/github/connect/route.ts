/**
 * Start connecting GitHub: sends the signed-in person to GitHub, either to
 * approve the app (`/api/github/connect`) or to install it on their account or
 * organisation (`?install=1`). A one-time `state` is kept in a short-lived
 * cookie for the callback to check. Someone not signed in is sent to sign in
 * first, because the GitHub account is linked to the Google one they signed in
 * with.
 */

import { NextResponse } from 'next/server';

import {
  githubConfig,
  GITHUB_PATH,
  GITHUB_STATE_COOKIE,
} from '@/domain/github/service';
import { authorizeUrl, installUrl } from '@/domain/github/oauth';
import { getCurrentUser } from '@/lib/core/auth/current-user';
import { appOrigin } from '@/lib/core/origin';
import { STATE_TTL_SECONDS } from '@/lib/web-security';

export async function GET(request: Request): Promise<NextResponse> {
  const origin = appOrigin(request);
  const config = githubConfig();
  if (!config) {
    return NextResponse.redirect(`${origin}${GITHUB_PATH}?error=unavailable`);
  }
  if (!(await getCurrentUser())) {
    return NextResponse.redirect(
      `${origin}/auth/login?returnTo=${encodeURIComponent(GITHUB_PATH)}`,
    );
  }
  const state = `github.${crypto.randomUUID()}`;
  const install = new URL(request.url).searchParams.has('install');
  const target = install
    ? installUrl(config, state)
    : authorizeUrl(config, `${origin}/api/github/callback`, state);
  const response = NextResponse.redirect(target);
  response.cookies.set(GITHUB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith('https:'),
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}

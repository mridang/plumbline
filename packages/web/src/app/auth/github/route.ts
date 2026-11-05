/**
 * Start signing in with GitHub: for the people who use the dashboard but did not
 * install the app (an owner of an organization, or anyone with access to one of
 * its repositories). Remembers a one-time `state` for the callback to check and
 * sends the browser to GitHub to approve the app. Sends people back to the
 * sign-in page, with a fixed flag, when the app has no GitHub settings.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { authorizeUrl } from '@/domain/github/oauth';
import { githubConfig } from '@/domain/github/service';
import { startFlowCookies } from '@/lib/core/auth';
import { appOrigin } from '@/lib/core/origin';
import { safeReturnPath } from '@/lib/web-security';

export const dynamic = 'force-dynamic';

/** The path GitHub sends people back to. */
export const GITHUB_SIGN_IN_CALLBACK = '/auth/github/callback';

export function GET(request: NextRequest): NextResponse {
  const origin = appOrigin(request);
  const config = githubConfig();
  if (!config) {
    return NextResponse.redirect(`${origin}/login?error=github`);
  }
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(
    authorizeUrl(config, `${origin}${GITHUB_SIGN_IN_CALLBACK}`, state),
  );
  startFlowCookies(response, {
    state,
    returnTo: safeReturnPath(new URL(request.url).searchParams.get('returnTo')),
    secure: origin.startsWith('https'),
  });
  return response;
}

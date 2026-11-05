/**
 * Where the GitHub App's callback used to be. Linking a GitHub account is a
 * browser redirect flow, not a REST resource, so it moved to
 * `/auth/github/link/callback`. The old address is the one registered with the
 * GitHub App until its settings are changed, so it still answers, with a
 * redirect that keeps the query. Remove this file once the new callback URL is
 * the only one registered.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { appOrigin } from '@/lib/core/origin';

export function GET(request: NextRequest): NextResponse {
  const { search } = new URL(request.url);
  return NextResponse.redirect(
    `${appOrigin(request)}/auth/github/link/callback${search}`,
  );
}

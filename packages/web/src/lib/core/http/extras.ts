/**
 * @packageDocumentation
 *
 * What this app adds to the shared edge code (`edge-limits.ts`, used by
 * `serve.ts`): which request counts against which rate limit, beyond the
 * classes every app has. Starting a scan and fetching for one are the costly
 * things here (a scan makes a few hundred fetches through the Worker), so each
 * has a class of its own, counted by network address: the app has no sign-in.
 */

import {
  GENERIC_CLASSES,
  genericClass,
  type ClassSpec,
  type EdgeLimits,
} from '@/lib/core/http/edge-limits';

/** The kinds of request this app counts besides the classes every app has. */
type OwnClass = 'scan' | 'fetch';

/** Every class this app counts, with its binding (limits in `wrangler.jsonc`). */
const CLASSES: Readonly<Record<OwnClass, ClassSpec>> = {
  scan: {
    binding: 'RL_SCAN',
    counted: 'address',
    periodSeconds: 60,
    style: 'problem',
  },
  fetch: {
    binding: 'RL_FETCH',
    counted: 'address',
    periodSeconds: 60,
    style: 'problem',
  },
};

/** A scan's fetches: `/api/scans/{id}/fetches`. */
const FETCHES = /^\/api\/scans\/[^/]+\/fetches$/;

/** The class of a request this app counts specially, or undefined. */
function ownClass(request: Request): OwnClass | undefined {
  const { pathname } = new URL(request.url);
  if (request.method !== 'POST') {
    return undefined;
  }
  if (pathname === '/api/scans') {
    return 'scan';
  }
  return FETCHES.test(pathname) ? 'fetch' : undefined;
}

/** What this app counts, and how a request is sorted into it. */
export const EDGE_LIMITS: EdgeLimits = {
  classes: { ...GENERIC_CLASSES, ...CLASSES },
  classify: (request) =>
    ownClass(request) ?? genericClass(new URL(request.url).pathname),
  sessionCookie: undefined,
};

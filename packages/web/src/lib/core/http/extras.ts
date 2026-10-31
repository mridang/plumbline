/**
 * @packageDocumentation
 *
 * What this app adds to the shared edge code (`edge-limits.ts`, used by
 * `serve.ts`): which request counts against which rate limit, beyond the
 * classes every app has. It is the one place an app says what it is protecting.
 * Starting a scan and fetching for one are the costly things here (a scan makes
 * a few hundred fetches through the Worker), so each has a class of its own,
 * counted by network address, since scanning needs no sign-in. The sign-in,
 * approval, token and MCP classes are the ones chowdown has.
 */

import { SESSION_COOKIE } from '@/domain/auth/app';
import {
  GENERIC_CLASSES,
  genericClass,
  type ClassSpec,
  type EdgeLimits,
} from '@/lib/core/http/edge-limits';

/** The kinds of request this app counts besides the classes every app has. */
type OwnClass =
  'auth' | 'token' | 'register' | 'mcp' | 'mcpAnonymous' | 'scan' | 'fetch';

/**
 * Every class this app counts, with its binding (limits in `wrangler.jsonc`):
 * sign-in and approval flows are slow human actions, the token endpoint serves
 * assistants that share egress addresses, and scans fan out into many fetches.
 */
const CLASSES: Readonly<Record<OwnClass, ClassSpec>> = {
  auth: {
    binding: 'RL_AUTH',
    counted: 'address',
    periodSeconds: 60,
    style: 'text',
  },
  token: {
    binding: 'RL_TOKEN',
    counted: 'address',
    periodSeconds: 60,
    style: 'oauth',
  },
  register: {
    binding: 'RL_REGISTER',
    counted: 'address',
    periodSeconds: 60,
    style: 'oauth',
  },
  mcp: {
    binding: 'RL_MCP',
    counted: 'token',
    periodSeconds: 60,
    style: 'jsonrpc',
  },
  mcpAnonymous: {
    binding: 'RL_MCP_ANONYMOUS',
    counted: 'address',
    periodSeconds: 60,
    style: 'jsonrpc',
  },
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

/**
 * The class of a request this app counts specially, or undefined when it is one
 * of the classes every app has. A request with no `Authorization` header sent to
 * the MCP endpoint is only probing, so it is counted in a much tighter class
 * than a real client.
 */
function ownClass(request: Request): OwnClass | undefined {
  const { pathname } = new URL(request.url);
  if (pathname === '/mcp') {
    return request.headers.has('authorization') ? 'mcp' : 'mcpAnonymous';
  }
  if (pathname === '/oauth/token') {
    return 'token';
  }
  if (pathname === '/oauth/register') {
    return 'register';
  }
  if (
    pathname.startsWith('/oauth/') ||
    pathname.startsWith('/auth/') ||
    pathname === '/api/sessions/self'
  ) {
    return 'auth';
  }
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
  sessionCookie: SESSION_COOKIE,
};

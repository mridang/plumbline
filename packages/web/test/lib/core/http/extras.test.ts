import { describe, expect, it } from '@jest/globals';

import { SESSION_COOKIE } from '@/domain/auth/app';
import { GENERIC_CLASSES } from '@/lib/core/http/edge-limits';
import { EDGE_LIMITS } from '@/lib/core/http/extras';

const classOf = (
  pathname: string,
  method = 'GET',
  headers: Record<string, string> = {},
) =>
  EDGE_LIMITS.classify(
    new Request(`https://app.test${pathname}`, { method, headers }),
  );

describe('EDGE_LIMITS', () => {
  it('counts the classes every app has, sign-in, OAuth, MCP, scans and their fetches', () => {
    expect(EDGE_LIMITS.classes).toEqual({
      ...GENERIC_CLASSES,
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
    });
  });

  it('counts a signed-in person by their session cookie', () => {
    expect(EDGE_LIMITS.sessionCookie).toBe(SESSION_COOKIE);
  });

  it('counts an MCP call that carries a token as a client', () => {
    expect(classOf('/mcp', 'POST', { authorization: 'Bearer t' })).toBe('mcp');
  });

  it('counts an MCP call with no token in the tighter anonymous class', () => {
    expect(classOf('/mcp', 'POST')).toBe('mcpAnonymous');
  });

  it('puts the token endpoint in its own class', () => {
    expect(classOf('/oauth/token', 'POST')).toBe('token');
  });

  it('puts client registration in its own class', () => {
    expect(classOf('/oauth/register', 'POST')).toBe('register');
  });

  it.each([
    ['/oauth/authorize', 'GET'],
    ['/oauth/consent', 'POST'],
    ['/auth/login', 'GET'],
    ['/auth/callback', 'GET'],
    ['/api/sessions/self', 'DELETE'],
  ])('puts %s (%s) in the sign-in class', (pathname, method) => {
    expect(classOf(pathname, method)).toBe('auth');
  });

  it('leaves a GET of a scan fetch path to the API class', () => {
    expect(classOf('/api/scans/abc.def/fetches')).toBe('api');
  });

  it('puts starting a scan in its own class', () => {
    expect(classOf('/api/scans', 'POST')).toBe('scan');
  });

  it('puts a scan fetch in its own class', () => {
    expect(classOf('/api/scans/abc.def/fetches', 'POST')).toBe('fetch');
    expect(classOf('/api/scans/abc.def/probes', 'POST')).toBe('fetch');
  });

  it('leaves other scan paths to the API class', () => {
    expect(classOf('/api/scans/abc.def', 'POST')).toBe('api');
    expect(classOf('/api/scans/a/b/fetches', 'POST')).toBe('api');
  });

  it.each([
    ['/', 'site'],
    ['/api/scans', 'api'],
    ['/csp/reports', 'reports'],
    ['/robots.txt', 'discovery'],
  ])('puts a GET of %s in %s', (pathname, expected) => {
    expect(classOf(pathname)).toBe(expected);
  });

  it('does not count the static files', () => {
    expect(classOf('/_next/static/chunks/a.js')).toBeUndefined();
  });
});

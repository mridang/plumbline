import { describe, expect, it } from '@jest/globals';

import { SESSION_COOKIE } from '@/domain/auth/app';
import { GENERIC_CLASSES } from '@/lib/core/http/edge-limits';
import { EDGE_LIMITS } from '@/lib/core/http/extras';

const limitClassOf = (
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
    });
  });

  it('counts a signed-in person by their session cookie', () => {
    expect(EDGE_LIMITS.sessionCookie).toBe(SESSION_COOKIE);
  });

  it('counts an MCP call that carries a token as a client', () => {
    expect(limitClassOf('/mcp', 'POST', { authorization: 'Bearer t' })).toBe(
      'mcp',
    );
  });

  it('counts an MCP call with no token in the tighter anonymous class', () => {
    expect(limitClassOf('/mcp', 'POST')).toBe('mcpAnonymous');
  });

  it('puts the token endpoint in its own class', () => {
    expect(limitClassOf('/oauth/token', 'POST')).toBe('token');
  });

  it('puts client registration in its own class', () => {
    expect(limitClassOf('/oauth/register', 'POST')).toBe('register');
  });

  it.each([
    ['/oauth/authorize', 'GET'],
    ['/oauth/consent', 'POST'],
    ['/auth/login', 'GET'],
    ['/auth/callback', 'GET'],
    ['/api/sessions/self', 'DELETE'],
  ])('puts %s (%s) in the sign-in class', (pathname, method) => {
    expect(limitClassOf(pathname, method)).toBe('auth');
  });

  it('leaves a GET of a scan run path to the API class', () => {
    expect(limitClassOf('/api/scans/abc.def/run')).toBe('api');
  });

  it('puts starting a scan in its own class', () => {
    expect(limitClassOf('/api/scans', 'POST')).toBe('scan');
  });

  it('counts a scan run with the scans', () => {
    expect(limitClassOf('/api/scans/abc.def/run', 'POST')).toBe('scan');
  });

  it('leaves other scan paths to the API class', () => {
    expect(limitClassOf('/api/scans/abc.def', 'POST')).toBe('api');
    expect(limitClassOf('/api/scans/a/b/run', 'POST')).toBe('api');
  });

  it.each([
    ['/', 'site'],
    ['/api/scans', 'api'],
    ['/csp/reports', 'reports'],
    ['/robots.txt', 'discovery'],
  ])('puts a GET of %s in %s', (pathname, expected) => {
    expect(limitClassOf(pathname)).toBe(expected);
  });

  it('does not count the static files', () => {
    expect(limitClassOf('/_next/static/chunks/a.js')).toBeUndefined();
  });
});

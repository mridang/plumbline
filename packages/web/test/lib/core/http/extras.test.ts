import { describe, expect, it } from '@jest/globals';

import { GENERIC_CLASSES } from '@/lib/core/http/edge-limits';
import { EDGE_LIMITS } from '@/lib/core/http/extras';

const classOf = (pathname: string, method = 'GET') =>
  EDGE_LIMITS.classify(new Request(`https://app.test${pathname}`, { method }));

describe('EDGE_LIMITS', () => {
  it('counts the classes every app has, scans and their fetches', () => {
    expect(EDGE_LIMITS.classes).toEqual({
      ...GENERIC_CLASSES,
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

  it('counts every caller by address, because the app has no sign-in', () => {
    expect(EDGE_LIMITS.sessionCookie).toBeUndefined();
  });

  it('puts starting a scan in its own class', () => {
    expect(classOf('/api/scans', 'POST')).toBe('scan');
  });

  it('puts a scan fetch in its own class', () => {
    expect(classOf('/api/scans/abc.def/fetches', 'POST')).toBe('fetch');
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

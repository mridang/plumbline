import { describe, expect, it } from '@jest/globals';

import {
  CACHED_QUERY_PARAMS,
  EDGE_CACHED_PAGES,
  EDGE_TTL_SECONDS,
  EXTRA_DIRECTIVES,
  EXTRA_IMG_SOURCES,
  OPEN_FILES,
  PUBLIC_PAGES,
  RARELY_CHANGING,
} from '@/lib/core/http/site';

describe('site settings', () => {
  it('lets the edge keep the one page, which is the same for everyone', () => {
    expect([...EDGE_CACHED_PAGES]).toEqual(['/']);
  });

  it('lets a kept page carry only the domain to scan', () => {
    expect([...CACHED_QUERY_PARAMS]).toEqual(['domain']);
  });

  it('keeps a copy for half an hour', () => {
    expect(EDGE_TTL_SECONDS).toBe(1800);
  });

  it('lets search engines index the scan page, the checks and the docs', () => {
    expect([...PUBLIC_PAGES]).toEqual(['/', '/checks', '/docs']);
  });

  it.each([
    '/icon.svg',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/.well-known/security.txt',
    '/badge/acme/site/0123456789abcdef0123.svg',
    '/schemas/plumbline.schema.json',
  ])('opens %s to other sites', (path) => {
    expect(OPEN_FILES.test(path)).toBe(true);
  });

  it.each([
    '/',
    '/api/scans',
    '/csp/reports',
    '/badge/acme/site/0123.png',
    '/badge/acme/0123.svg',
    '/r/abc/json',
    '/schemas/other.schema.json',
  ])('keeps %s to this site', (path) => {
    expect(OPEN_FILES.test(path)).toBe(false);
  });

  it('lets the icons be cached for a day', () => {
    expect(
      [...RARELY_CHANGING].toSorted((a, b) => Number(a > b) - Number(a < b)),
    ).toEqual(['/favicon.ico', '/icon.svg']);
  });

  it("lets pages load the signed-in person's Google profile picture, and nothing else outside", () => {
    expect(EXTRA_IMG_SOURCES).toEqual(['https://lh3.googleusercontent.com']);
  });

  it('adds no directives of its own: nothing on the page is inline', () => {
    expect(EXTRA_DIRECTIVES).toEqual([]);
  });
});

import { describe, expect, it } from '@jest/globals';

import {
  MAX_FRESH_SECONDS,
  conditionalHeaders,
  directivesOf,
  freshUntil,
  validatorsOf,
} from '@/domain/suite/http-cache';

const NOW = Date.parse('2026-01-01T00:00:00.000Z');
const headers = (init: Record<string, string>) => new Headers(init);

describe('directivesOf', () => {
  it('reads max-age, no-cache and no-store', () => {
    expect(directivesOf('public, max-age=120')).toEqual({
      noStore: false,
      noCache: false,
      maxAge: 120,
    });
    expect(directivesOf('NO-CACHE').noCache).toBe(true);
    expect(directivesOf('no-store').noStore).toBe(true);
  });

  it('takes private as no-store, because the page is not for sharing', () => {
    expect(directivesOf('private, max-age=60').noStore).toBe(true);
  });

  it('prefers s-maxage to max-age and reads a quoted number', () => {
    expect(directivesOf('max-age=10, s-maxage="30"').maxAge).toBe(30);
  });

  it('ignores a number that is not one, and a missing header', () => {
    expect(directivesOf('max-age=soon').maxAge).toBeNull();
    expect(directivesOf('max-age=-5').maxAge).toBeNull();
    expect(directivesOf(null).maxAge).toBeNull();
  });
});

describe('validatorsOf', () => {
  it('reads the etag and the modification time', () => {
    expect(
      validatorsOf(
        headers({ etag: '"a"', 'last-modified': 'Mon, 01 Jan 2026' }),
      ),
    ).toEqual({ etag: '"a"', lastModified: 'Mon, 01 Jan 2026' });
  });

  it('is null when there is neither', () => {
    expect(validatorsOf(headers({}))).toBeNull();
  });
});

describe('freshUntil', () => {
  it('adds max-age to now', () => {
    expect(freshUntil(headers({ 'cache-control': 'max-age=60' }), NOW)).toBe(
      '2026-01-01T00:01:00.000Z',
    );
  });

  it('takes the age the page already has off', () => {
    expect(
      freshUntil(headers({ 'cache-control': 'max-age=60', age: '45' }), NOW),
    ).toBe('2026-01-01T00:00:15.000Z');
  });

  it('is null when the page is already stale, or must be checked every time', () => {
    expect(
      freshUntil(headers({ 'cache-control': 'max-age=60', age: '60' }), NOW),
    ).toBeNull();
    expect(
      freshUntil(headers({ 'cache-control': 'max-age=0' }), NOW),
    ).toBeNull();
    expect(
      freshUntil(headers({ 'cache-control': 'no-cache' }), NOW),
    ).toBeNull();
    expect(
      freshUntil(headers({ 'cache-control': 'no-store, max-age=60' }), NOW),
    ).toBeNull();
  });

  it('falls back to Expires, and ignores one that is not a date', () => {
    expect(
      freshUntil(headers({ expires: 'Thu, 01 Jan 2026 00:02:00 GMT' }), NOW),
    ).toBe('2026-01-01T00:02:00.000Z');
    expect(freshUntil(headers({ expires: '0' }), NOW)).toBeNull();
  });

  it('is null when the site says nothing', () => {
    expect(freshUntil(headers({}), NOW)).toBeNull();
  });

  it('never trusts the site for longer than the limit', () => {
    expect(
      freshUntil(headers({ 'cache-control': 'max-age=31536000' }), NOW),
    ).toBe(new Date(NOW + MAX_FRESH_SECONDS * 1000).toISOString());
  });
});

describe('conditionalHeaders', () => {
  it('sends back what the site gave', () => {
    expect(conditionalHeaders({ etag: '"a"', lastModified: 'x' })).toEqual({
      'if-none-match': '"a"',
      'if-modified-since': 'x',
    });
  });

  it('sends nothing without validators', () => {
    expect(conditionalHeaders(null)).toEqual({});
    expect(conditionalHeaders({ etag: null, lastModified: null })).toEqual({});
  });
});

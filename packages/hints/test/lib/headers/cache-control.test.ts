import { describe, expect, it } from '@jest/globals';
import { cacheControlFindings } from '../../../src/lib/headers/cache-control.js';

describe('cacheControlFindings', () => {
  it('accepts no-store and max-age=0 in any order', () => {
    expect(cacheControlFindings('no-store, max-age=0')).toEqual([]);
    expect(cacheControlFindings('Max-Age=0,No-Store')).toEqual([]);
  });

  it('errors when missing', () => {
    expect(cacheControlFindings(null)[0]?.message).toContain('not specified');
  });

  it.each(['no-store', 'max-age=0', 'no-store, no-cache, max-age=0', 'public'])(
    'rejects %s',
    (value) => {
      expect(cacheControlFindings(value)[0]?.message).toContain(
        'no-store, max-age=0',
      );
    },
  );
});

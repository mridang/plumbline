import { describe, expect, it } from '@jest/globals';

import { conditionalHeaders, validatorsOf } from '@/domain/suite/http-cache';

const headers = (init: Record<string, string>) => new Headers(init);

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

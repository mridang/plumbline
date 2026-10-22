import { describe, expect, it } from '@jest/globals';
import {
  domRelLinks,
  headerRelLinks,
  isAbsoluteUrl,
  withRel,
  type DocumentLike,
} from '../../../src/lib/discovery/links.js';

/** A fake document whose querySelectorAll returns the configured elements. */
function doc(elements: ReadonlyArray<Record<string, string>>): DocumentLike {
  return {
    querySelectorAll: () =>
      elements.map((attrs) => ({
        getAttribute: (name: string) => attrs[name] ?? null,
      })),
  };
}

describe('domRelLinks', () => {
  it('reads rel tokens and href, lower-casing rels', () => {
    const links = domRelLinks(
      doc([{ rel: 'Me Author', href: ' https://x.test/me ' }]),
    );
    expect(links).toEqual([
      { rels: ['me', 'author'], href: 'https://x.test/me', source: 'dom' },
    ]);
  });

  it('skips elements with a blank rel', () => {
    expect(domRelLinks(doc([{ rel: '  ', href: '/x' }]))).toEqual([]);
  });

  it('keeps an empty href as an empty string', () => {
    expect(domRelLinks(doc([{ rel: 'me' }]))[0]?.href).toBe('');
  });
});

describe('headerRelLinks', () => {
  it('returns [] for a null header', () => {
    expect(headerRelLinks(null)).toEqual([]);
  });

  it('parses a Link header relation', () => {
    const links = headerRelLinks('<https://x.test/wm>; rel="webmention"');
    expect(links).toEqual([
      { rels: ['webmention'], href: 'https://x.test/wm', source: 'header' },
    ]);
  });
});

describe('withRel', () => {
  it('filters by relation token', () => {
    const links = [
      { rels: ['me'], href: 'a', source: 'dom' as const },
      { rels: ['webmention'], href: 'b', source: 'dom' as const },
    ];
    expect(withRel(links, 'me')).toHaveLength(1);
  });
});

describe('isAbsoluteUrl', () => {
  it('is true for absolute http and mailto URLs', () => {
    expect(isAbsoluteUrl('https://x.test/a')).toBe(true);
    expect(isAbsoluteUrl('mailto:a@x.test')).toBe(true);
  });

  it('is false for a relative path', () => {
    expect(isAbsoluteUrl('/wm')).toBe(false);
  });
});

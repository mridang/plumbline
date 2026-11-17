import { describe, expect, it } from '@jest/globals';
import {
  domRelationshipLinks,
  headerRelationshipLinks,
  isAbsoluteUrl,
  withRelationship,
} from '../../../src/lib/discovery/links.js';
import type { DocumentLike } from '../../../src/lib/discovery/links.js';

/** A fake document whose querySelectorAll returns the configured elements. */
function fakeDocument(
  elements: ReadonlyArray<Record<string, string>>,
): DocumentLike {
  return {
    querySelectorAll: () =>
      elements.map((attributes) => ({
        getAttribute: (name: string) => attributes[name] ?? null,
      })),
  };
}

describe('domRelationshipLinks', () => {
  it('reads rel tokens and href, lower-casing rels', () => {
    const links = domRelationshipLinks(
      fakeDocument([{ rel: 'Me Author', href: ' https://x.test/me ' }]),
    );
    expect(links).toEqual([
      { rels: ['me', 'author'], href: 'https://x.test/me', source: 'dom' },
    ]);
  });

  it('skips elements with a blank rel', () => {
    expect(
      domRelationshipLinks(fakeDocument([{ rel: '  ', href: '/x' }])),
    ).toEqual([]);
  });

  it('keeps an empty href as an empty string', () => {
    expect(domRelationshipLinks(fakeDocument([{ rel: 'me' }]))[0]?.href).toBe(
      '',
    );
  });
});

describe('headerRelationshipLinks', () => {
  it('returns [] for a null header', () => {
    expect(headerRelationshipLinks(null)).toEqual([]);
  });

  it('parses a Link header relation', () => {
    const links = headerRelationshipLinks(
      '<https://x.test/wm>; rel="webmention"',
    );
    expect(links).toEqual([
      { rels: ['webmention'], href: 'https://x.test/wm', source: 'header' },
    ]);
  });
});

describe('withRelationship', () => {
  it('filters by relation token', () => {
    const links = [
      { rels: ['me'], href: 'a', source: 'dom' as const },
      { rels: ['webmention'], href: 'b', source: 'dom' as const },
    ];
    expect(withRelationship(links, 'me')).toHaveLength(1);
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

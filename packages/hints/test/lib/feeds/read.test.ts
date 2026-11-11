import { createHTMLDocument } from '@hint/utils-dom';
import { describe, expect, it } from '@jest/globals';
import type { DocumentLike } from '../../../src/lib/feeds/read.js';
import {
  getFeedLinks,
  getOembedLinks,
  getOpenSearchLinks,
} from '../../../src/lib/feeds/read.js';

/** Parses markup with the same DOM implementation webhint uses. */
const parse = (html: string): DocumentLike =>
  createHTMLDocument(html, 'https://x.test/') as DocumentLike;

describe('getFeedLinks', () => {
  it('finds RSS and Atom alternate links', () => {
    const doc = parse(
      '<link rel="alternate" type="application/rss+xml" href="https://x.test/f.xml">' +
        '<link rel="alternate" type="application/atom+xml" href="/a.xml">',
    );
    expect(getFeedLinks(doc)).toEqual([
      { type: 'application/rss+xml', href: 'https://x.test/f.xml' },
      { type: 'application/atom+xml', href: '/a.xml' },
    ]);
  });

  it('matches a multi-valued rel and ignores non-feed types', () => {
    const doc = parse(
      '<link rel="home alternate" type="application/rss+xml" href="/f">' +
        '<link rel="alternate" type="text/html" href="/p">',
    );
    expect(getFeedLinks(doc)).toHaveLength(1);
  });

  it('returns nothing when no feed link is present', () => {
    expect(getFeedLinks(parse('<link rel="icon" href="/i.png">'))).toEqual([]);
  });
});

describe('getOembedLinks', () => {
  it('finds JSON and XML oEmbed links', () => {
    const doc = parse(
      '<link rel="alternate" type="application/json+oembed" href="/o.json">' +
        '<link rel="alternate" type="text/xml+oembed" href="/o.xml">',
    );
    expect(getOembedLinks(doc)).toHaveLength(2);
  });
});

describe('getOpenSearchLinks', () => {
  it('finds the OpenSearch search link', () => {
    const doc = parse(
      '<link rel="search" type="application/opensearchdescription+xml" href="/os.xml">',
    );
    expect(getOpenSearchLinks(doc)).toEqual([
      {
        type: 'application/opensearchdescription+xml',
        href: '/os.xml',
      },
    ]);
  });

  it('ignores a search link of another type', () => {
    const doc = parse('<link rel="search" type="text/html" href="/s">');
    expect(getOpenSearchLinks(doc)).toEqual([]);
  });
});

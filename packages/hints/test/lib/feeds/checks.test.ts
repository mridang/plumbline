import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import type { DocumentLike } from '../../../src/lib/feeds/read.js';
import {
  feedDiscovery,
  oembedDiscovery,
  opensearchDiscovery,
} from '../../../src/lib/feeds/checks.js';

const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom');

const parse = (html: string): DocumentLike =>
  createHTMLDocument(html, 'https://x.test/') as DocumentLike;

describe('feedDiscovery', () => {
  it('reports no feed as an informational hint', () => {
    const [found] = feedDiscovery(parse('<head></head>'));
    expect(found.severity).toBe('hint');
    expect(found.message).toContain('No RSS or Atom feed');
  });

  it('passes a feed with an absolute href', () => {
    expect(
      feedDiscovery(
        parse(
          '<link rel="alternate" type="application/rss+xml" href="https://x.test/f.xml">',
        ),
      ),
    ).toEqual([]);
  });

  it('warns about a relative feed href', () => {
    const [found] = feedDiscovery(
      parse('<link rel="alternate" type="application/atom+xml" href="/a.xml">'),
    );
    expect(found.severity).toBe('warning');
    expect(found.message).toContain('not an absolute URL');
  });

  it('warns about a missing feed href', () => {
    const [found] = feedDiscovery(
      parse('<link rel="alternate" type="application/rss+xml">'),
    );
    expect(found.severity).toBe('warning');
    expect(found.message).toContain('no href');
  });
});

describe('oembedDiscovery', () => {
  it('reports no oEmbed endpoint as a hint', () => {
    expect(oembedDiscovery(parse('<head></head>'))[0].severity).toBe('hint');
  });

  it('passes an oEmbed link with an href (relative allowed)', () => {
    expect(
      oembedDiscovery(
        parse(
          '<link rel="alternate" type="application/json+oembed" href="/o.json">',
        ),
      ),
    ).toEqual([]);
  });

  it('warns about a missing oEmbed href', () => {
    const [found] = oembedDiscovery(
      parse('<link rel="alternate" type="text/xml+oembed">'),
    );
    expect(found.severity).toBe('warning');
    expect(found.message).toContain('no href');
  });
});

describe('opensearchDiscovery', () => {
  it('reports no OpenSearch description as a hint', () => {
    expect(opensearchDiscovery(parse('<head></head>'))[0].severity).toBe(
      'hint',
    );
  });

  it('passes an OpenSearch link with an absolute href', () => {
    expect(
      opensearchDiscovery(
        parse(
          '<link rel="search" type="application/opensearchdescription+xml" href="https://x.test/os.xml">',
        ),
      ),
    ).toEqual([]);
  });

  it('warns about a relative OpenSearch href', () => {
    const [found] = opensearchDiscovery(
      parse(
        '<link rel="search" type="application/opensearchdescription+xml" href="/os.xml">',
      ),
    );
    expect(found.severity).toBe('warning');
  });
});

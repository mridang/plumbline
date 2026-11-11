import { describe, expect, it } from '@jest/globals';
import {
  validateFeed,
  validateOpenSearch,
} from '../../../src/lib/feeds/validate.js';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
<title>Title</title><link>https://x.test/</link><description>About</description>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<id>urn:1</id><title>Title</title><updated>2026-01-01T00:00:00Z</updated></feed>`;

const OPENSEARCH = `<?xml version="1.0"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
<ShortName>Search</ShortName>
<Url type="text/html" template="https://x.test/?q={searchTerms}"/>
</OpenSearchDescription>`;

describe('validateFeed', () => {
  it('passes a well-formed RSS 2.0 feed', () => {
    expect(validateFeed(RSS)).toEqual([]);
  });

  it('passes a well-formed Atom 1.0 feed', () => {
    expect(validateFeed(ATOM)).toEqual([]);
  });

  it('errors on unparsable XML', () => {
    const [found] = validateFeed('not xml at all');
    expect(found.severity).toBe('error');
    expect(found.message).toContain('well-formed');
  });

  it('errors on a non-feed root element', () => {
    const [found] = validateFeed('<html></html>');
    expect(found.message).toContain('must be <rss>');
  });

  it('errors when the RSS channel is missing', () => {
    expect(validateFeed('<rss version="2.0"></rss>')[0].message).toContain(
      'no <channel>',
    );
  });

  it('errors for each missing required RSS channel element', () => {
    const found = validateFeed(
      '<rss><channel><title>t</title></channel></rss>',
    );
    expect(found.map((f) => f.message).join(',')).toContain('<link>');
    expect(found.map((f) => f.message).join(',')).toContain('<description>');
    expect(found).toHaveLength(2);
  });

  it('errors for a missing required Atom element', () => {
    const found = validateFeed(
      '<feed><title>t</title><updated>x</updated></feed>',
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('<id>');
  });
});

describe('validateOpenSearch', () => {
  it('passes a well-formed description', () => {
    expect(validateOpenSearch(OPENSEARCH)).toEqual([]);
  });

  it('errors on unparsable XML', () => {
    expect(validateOpenSearch('')[0].message).toContain('well-formed');
  });

  it('errors on the wrong root element', () => {
    expect(validateOpenSearch('<feed></feed>')[0].message).toContain(
      'must be <OpenSearchDescription>',
    );
  });

  it('errors on a missing ShortName', () => {
    const found = validateOpenSearch(
      '<OpenSearchDescription><Url template="https://x.test/?q={searchTerms}"/></OpenSearchDescription>',
    );
    expect(found[0].message).toContain('<ShortName>');
  });

  it('errors on a ShortName longer than 16 characters', () => {
    const found = validateOpenSearch(
      '<OpenSearchDescription><ShortName>This name is far too long</ShortName><Url template="x"/></OpenSearchDescription>',
    );
    expect(found[0].message).toContain('16 characters or fewer');
  });

  it('errors when no Url has a template', () => {
    const found = validateOpenSearch(
      '<OpenSearchDescription><ShortName>S</ShortName><Url type="text/html"/></OpenSearchDescription>',
    );
    expect(found[0].message).toContain('template attribute');
  });
});

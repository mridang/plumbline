import { describe, expect, it } from '@jest/globals';
import {
  classifyRequests,
  parseWebUrl,
} from '../../../src/lib/privacy/requests.js';

const req = (url: string, type = 'script') => ({ url, type });

describe('classifyRequests', () => {
  it('counts third-party requests by host, security and type', () => {
    const result = classifyRequests('https://www.example.com/', [
      req('https://cdn.example.com/a.js'),
      req('https://tracker.test/a.js'),
      req('https://tracker.test/b.png', 'image'),
      req('http://ads.test/c.png', 'image'),
    ]);
    expect(result.pageDomain).toBe('example.com');
    expect(result.thirdParty).toHaveLength(3);
    expect(result.thirdPartyHosts).toEqual(['tracker.test', 'ads.test']);
    expect(result.secure).toBe(2);
    expect(result.insecure).toBe(1);
    expect(result.byType).toEqual({ script: 1, image: 2 });
  });

  it('treats subdomains as first party', () => {
    const result = classifyRequests('https://example.co.uk/', [
      req('https://static.example.co.uk/a.js'),
    ]);
    expect(result.thirdParty).toEqual([]);
  });

  it('finds insecure first-party requests on https and http pages', () => {
    const urls = [
      req('http://static.example.com/a.js'),
      req('https://static.example.com/b.js'),
      req('http://other.test/c.js'),
    ];
    for (const page of ['https://example.com/', 'http://example.com/']) {
      expect(classifyRequests(page, urls).insecureFirstParty).toEqual([
        urls[0],
      ]);
    }
  });

  it('splits mixed content into active and passive', () => {
    const result = classifyRequests('https://example.com/', [
      req('http://other.test/a.js', 'script'),
      req('http://other.test/b.css', 'css'),
      req('http://other.test/c.png', 'image'),
      req('https://other.test/d.png', 'image'),
    ]);
    expect(result.mixedContent.active).toHaveLength(2);
    expect(result.mixedContent.passive).toHaveLength(1);
  });

  it('reports no mixed content on an http page', () => {
    const result = classifyRequests('http://example.com/', [
      req('http://other.test/a.js'),
    ]);
    expect(result.mixedContent).toEqual({ active: [], passive: [] });
  });

  it('ignores non-web and invalid URLs', () => {
    const result = classifyRequests('https://example.com/', [
      req('data:image/png;base64,AAAA', 'image'),
      req('not a url'),
    ]);
    expect(result.thirdParty).toEqual([]);
    expect(result.mixedContent.active).toEqual([]);
  });

  it('copes with an unparsable page URL', () => {
    const result = classifyRequests('nonsense', [req('http://a.test/x.js')]);
    expect(result.pageSecure).toBe(false);
    expect(result.thirdParty).toHaveLength(1);
  });
});

describe('parseWebUrl', () => {
  it('accepts http and https only', () => {
    expect(parseWebUrl('https://a.test/')).not.toBeNull();
    expect(parseWebUrl('ftp://a.test/')).toBeNull();
    expect(parseWebUrl('::')).toBeNull();
  });
});

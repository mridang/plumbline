import { describe, expect, it } from '@jest/globals';

import {
  BRAND_NAME,
  BRAND_SHORT_NAME,
  BRAND_URL,
  CRAWLABLE_PATHS,
  INDEX_BY_DEFAULT,
  MANIFEST_EXTRAS,
  PRIVATE_PATHS,
  SITEMAP_PAGES,
  THEME_COLOR,
} from '@/app/_brand';

describe('the brand', () => {
  it('is named and placed as the site says', () => {
    expect(BRAND_NAME).toBe('plumbline');
    expect(BRAND_SHORT_NAME).toBe('plumbline');
    expect(BRAND_URL).toBe('https://plumbline.apps.mrida.ng');
  });

  it('has a short name that fits under a home-screen icon', () => {
    expect(BRAND_SHORT_NAME.length).toBeLessThanOrEqual(12);
  });

  it('colours the browser bar the paper of the page', () => {
    expect(THEME_COLOR).toBe('#f7f7f5');
  });
});

describe('what crawlers may read', () => {
  it('is the scan page, which may be indexed', () => {
    expect(INDEX_BY_DEFAULT).toBe(true);
    expect(CRAWLABLE_PATHS).toEqual(['/$']);
    expect(SITEMAP_PAGES).toEqual([{ path: '/' }]);
  });

  it('keeps them out of the signed-in pages, the API, sign-in, OAuth and MCP', () => {
    expect(PRIVATE_PATHS).toEqual([
      '/domains',
      '/connect',
      '/login',
      '/api/',
      '/auth/',
      '/oauth/',
      '/mcp',
    ]);
  });
});

describe('what the installed app offers', () => {
  it('offers shortcuts to scan a site and to the domains, and nothing else', () => {
    expect(Object.keys(MANIFEST_EXTRAS)).toEqual(['shortcuts']);
    expect(MANIFEST_EXTRAS.shortcuts?.map((s) => s.url)).toEqual([
      '/?source=pwa-shortcut#scan',
      '/domains?source=pwa-shortcut',
    ]);
  });
});

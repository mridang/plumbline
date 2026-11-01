import { describe, expect, it } from '@jest/globals';

import { runChecks, type PageResponse } from '@/domain/suite/checks';
import type { PageFacts } from '@/domain/suite/facts';

const good: PageFacts = {
  title: 'Garden tips',
  viewport: 'width=device-width, initial-scale=1',
  appleTouchIcons: 1,
  hrefs: ['/about', '/contact'],
  images: [],
  iframes: [],
  scripts: 1,
  stylesheets: 1,
  blockingScripts: 0,
  deprecated: {},
};

const words = Array.from(
  { length: 320 },
  (_, i) => ['garden', 'soil', 'water'][i % 3],
).join(' ');

const page: PageResponse = {
  url: 'https://example.com/tips',
  status: 200,
  responseMs: 120,
  html: `<html><body><p>${words}</p><a href="/about">About our team</a></body></html>`,
  bytes: 4000,
};

/** The ids of the checks that found something. */
function failing(response: PageResponse, facts: PageFacts): string[] {
  return runChecks(response, facts)
    .filter((check) =>
      check.findings.some((found) => found.severity !== 'hint'),
    )
    .map((check) => check.id);
}

describe('runChecks', () => {
  it('runs the sixteen content, mobile and speed checks once each', () => {
    const ids = runChecks(page, good).map((check) => check.id);
    expect(new Set(ids).size).toBe(16);
  });

  it('finds nothing wrong with a healthy page', () => {
    expect(failing(page, good)).toEqual([]);
  });

  it.each([
    ['seo-http-status', { ...page, status: 404 }, good],
    ['seo-content-length', { ...page, html: '<p>too short</p>' }, good],
    ['seo-url-friendly', { ...page, url: 'https://example.com/A_B' }, good],
    ['technical-html-size', { ...page, bytes: 300 * 1024 }, good],
    ['technical-response-time', { ...page, responseMs: 2000 }, good],
    ['seo-links', page, { ...good, hrefs: [] }],
    ['seo-viewport', page, { ...good, viewport: null }],
    ['icons-apple-touch-icon-missing', page, { ...good, appleTouchIcons: 0 }],
    ['seo-deprecated-html', page, { ...good, deprecated: { font: 2 } }],
    ['seo-keywords-in-title', page, { ...good, title: 'Unrelated words' }],
    ['technical-asset-count', page, { ...good, blockingScripts: 2 }],
  ])('flags %s', (id, response, facts) => {
    expect(failing(response, facts)).toContain(id);
  });

  it('flags images that are fixed size, legacy format and not lazy loaded', () => {
    const image = {
      src: 'a.jpg',
      srcset: '',
      inPicture: false,
      modernSource: false,
      lazy: false,
    };
    const facts = { ...good, images: [image, image, image, image] };
    expect(failing(page, facts)).toEqual(
      expect.arrayContaining([
        'seo-responsive-images',
        'technical-image-formats',
        'technical-lazy-loading',
      ]),
    );
  });

  it('flags links with no text and links with generic text', () => {
    const html = `${page.html}<a href="/x"></a><a href="/y">click here</a>`;
    expect(failing({ ...page, html }, good)).toContain('seo-link-anchor-text');
  });

  it('lists the frequent keywords as advice only', () => {
    const keywords = runChecks(page, good).find(
      (check) => check.id === 'seo-keywords-frequent',
    );
    expect(keywords?.findings.map((found) => found.severity)).toEqual(['hint']);
  });
});

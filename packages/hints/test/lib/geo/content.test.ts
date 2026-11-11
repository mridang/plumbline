import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import {
  measureContent,
  type ContentDocument,
} from '../../../src/lib/geo/content.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line sonarjs/no-require-or-define -- @hint/utils-dom is CommonJS only, loaded through createRequire
const { createHTMLDocument } = require('@hint/utils-dom');

const measure = (html: string) =>
  measureContent(
    createHTMLDocument(html, 'https://example.com/') as ContentDocument,
  );

const LONG = 'x'.repeat(31);

describe('measureContent', () => {
  it('counts headings and paragraphs longer than 30 characters', () => {
    expect(
      measure(
        `<body><h1>a</h1><h2>b</h2><p>${LONG}</p><p>${'y'.repeat(30)}</p><ul><li>${LONG}</li></ul></body>`,
      ),
    ).toEqual({
      headingCount: 2,
      paragraphCount: 2,
      maxUnstructuredLength: 0,
      unstructuredIndex: -1,
    });
  });

  it('prefers <main> over the rest of the body', () => {
    const stats = measure(`<body><h1>a</h1><main><h2>b</h2></main></body>`);
    expect(stats?.headingCount).toBe(1);
  });

  it('measures the longest div without inner structure', () => {
    const stats = measure(
      `<body><div>${'z'.repeat(900)}</div><div><p>${LONG}</p></div></body>`,
    );
    expect(stats?.maxUnstructuredLength).toBe(900);
  });

  it('returns null without a root', () => {
    expect(measureContent({ querySelector: () => null })).toBeNull();
  });
});

import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import { metaValue, metaValues } from '../../../src/lib/opengraph/meta.js';

const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom');

const doc = createHTMLDocument(
  `<html><head>
    <meta property="og:title" content=" Hello ">
    <meta name="twitter:card" content="summary">
    <meta property="OG:Image" content="/a.png">
    <meta property="og:image" content="/b.png">
    <meta property="og:empty" content="  ">
    <meta property="og:nocontent">
    <meta property="description" name="twitter:site" content="@x">
  </head></html>`,
  'http://example.com/',
);

describe('metaValues', () => {
  it('reads property and name attributes case-insensitively', () => {
    expect(metaValues(doc, 'og:title')).toEqual(['Hello']);
    expect(metaValues(doc, 'twitter:card')).toEqual(['summary']);
    expect(metaValues(doc, 'og:image')).toEqual(['/a.png', '/b.png']);
  });
  it('matches either attribute when a tag carries both', () => {
    expect(metaValues(doc, 'twitter:site')).toEqual(['@x']);
  });
  it('skips empty and missing content', () => {
    expect(metaValues(doc, 'og:empty')).toEqual([]);
    expect(metaValues(doc, 'og:nocontent')).toEqual([]);
  });
});

describe('metaValue', () => {
  it('returns the first value or null', () => {
    expect(metaValue(doc, 'og:image')).toBe('/a.png');
    expect(metaValue(doc, 'og:missing')).toBeNull();
  });
});

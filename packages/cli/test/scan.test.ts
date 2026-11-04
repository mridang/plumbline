import { describe, expect, it } from '@jest/globals';
import { createRequire } from 'node:module';
import { findBrowser } from '../src/browser.js';
import { allHintIds, hintCatalogue, hintConfig, scan } from '../src/scan.js';
import { serve } from './helpers/serve.js';

describe('the Puppeteer page shim', () => {
  it('keeps page.removeListener, which the connector calls and newer Puppeteer renamed to off', () => {
    const require = createRequire(import.meta.url);
    const { Page } = createRequire(
      require.resolve('@hint/connector-puppeteer'),
    )('puppeteer-core');
    expect(typeof Page.prototype.removeListener).toBe('function');
  });
});

describe('allHintIds', () => {
  it('lists the shipped hints', () => {
    expect(allHintIds.length).toBeGreaterThan(0);
  });

  it('is sorted and free of duplicates', () => {
    const ids = [...allHintIds];
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries no prefix on the ids', () => {
    expect(allHintIds.some((id) => id.includes('/'))).toBe(false);
  });
});

describe('hintCatalogue', () => {
  it('has one entry per hint id', () => {
    expect(hintCatalogue().map((h) => h.id)).toEqual([...allHintIds]);
  });

  it('fills in every field', () => {
    for (const hint of hintCatalogue()) {
      expect(typeof hint.name).toBe('string');
      expect(typeof hint.description).toBe('string');
      expect(typeof hint.category).toBe('string');
      expect(Array.isArray(hint.groups)).toBe(true);
    }
  });
});

describe('hintConfig', () => {
  // The hint classes are handed to the analyzer, which matches config keys
  // against each class's `meta.id` (`extra/<id>`); any other key leaves the
  // hint switched off.
  it('keys every hint by its extra/ id', () => {
    expect(hintConfig(['csp'])).toEqual({ 'extra/csp': 'default' });
  });

  it('keys all shipped hints and nothing else', () => {
    const keys = Object.keys(hintConfig(allHintIds));
    expect(keys.length).toBe(allHintIds.length);
    expect(keys.every((k) => k.startsWith('extra/'))).toBe(true);
  });
});

describe('scan', () => {
  // A real puppeteer scan of a local page with one hint switched on: the page
  // sends no Content-Security-Policy, so the `csp` hint must report it.
  it('reports what the selected hint finds on a live page', async () => {
    const site = await serve();
    try {
      const result = await scan(site.url, {
        hints: ['csp'],
        executablePath: findBrowser(),
      });
      expect(result.hints.map((h) => h.id)).toEqual(['csp']);
      expect(result.problems.map((p) => p.hintId)).toContain('extra/csp');
    } finally {
      await site.close();
    }
  });

  it('ignores ids that are not shipped hints', async () => {
    const site = await serve();
    try {
      const result = await scan(site.url, {
        hints: ['csp', 'no-such-hint'],
        executablePath: findBrowser(),
      });
      expect(result.hints.map((h) => h.id)).toEqual(['csp']);
    } finally {
      await site.close();
    }
  });
});

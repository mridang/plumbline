import { describe, expect, it } from '@jest/globals';
import { allHintIds, hintCatalogue, hintConfig } from '../src/scan.js';

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
  // Webhint resolves a multi-hint package's hints by the package-qualified key
  // `@mridang/webhint-hint-extra/<id>`; the `extra/<id>` short form only works
  // when the hint classes are handed to the analyzer directly, so using it in
  // the server's config leaves every hint unresolved and the scan fails.
  it('keys every hint by its package-qualified name', () => {
    expect(hintConfig(['csp'])).toEqual({
      '@mridang/webhint-hint-extra/csp': 'default',
    });
  });

  it('keys all shipped hints and nothing else', () => {
    const keys = Object.keys(hintConfig(allHintIds));
    expect(keys.length).toBe(allHintIds.length);
    expect(
      keys.every((k) => k.startsWith('@mridang/webhint-hint-extra/')),
    ).toBe(true);
  });
});

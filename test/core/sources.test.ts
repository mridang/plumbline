import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_GROUPS } from '../../src/core/groups.js';
import { SOURCES } from '../../src/core/sources.js';

const read = (path: string) =>
  JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', path), 'utf8'),
  ) as { sources?: unknown };

describe('the sources', () => {
  it('has one entry for every source group', () => {
    expect(SOURCES.map((s) => s.id).sort()).toEqual([...SOURCE_GROUPS].sort());
  });

  it('names each source, links it and states its licence', () => {
    for (const source of SOURCES) {
      expect(source.name.length).toBeGreaterThan(3);
      expect(source.url.startsWith('https://')).toBe(true);
      expect(source.licence.length).toBeGreaterThan(2);
    }
  });

  it('is stamped into package.json', () => {
    expect(read('package.json').sources).toEqual([...SOURCES]);
  });

  it('is stamped into the formatter package.json', () => {
    const sources = read('formatter/package.json').sources as unknown[];
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThan(0);
  });
});

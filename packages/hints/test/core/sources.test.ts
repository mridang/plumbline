import { describe, expect, it } from '@jest/globals';
import { SOURCE_GROUPS } from '../../src/core/groups.js';
import { SOURCES } from '../../src/core/sources.js';

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
});

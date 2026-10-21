import { describe, expect, it } from '@jest/globals';
import hints from '../../src/index.js';
import { CATEGORIES, PLACEMENT } from '../../src/core/taxonomy.js';

describe('the taxonomy', () => {
  const ids = new Set(CATEGORIES.map((c) => c.id));

  it('has between six and twelve categories, each explained', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(CATEGORIES.length).toBeLessThanOrEqual(12);
    for (const c of CATEGORIES) {
      expect(c.title.length).toBeGreaterThan(3);
      expect(c.description.length).toBeGreaterThan(10);
      expect(c.whoFixesIt.length).toBeGreaterThan(3);
    }
  });

  it('has no other bucket', () => {
    expect(ids.has('other')).toBe(false);
  });

  it('places every hint, and only hints that exist', () => {
    expect(Object.keys(PLACEMENT).sort()).toEqual(Object.keys(hints).sort());
  });

  it('uses known categories, with tags that differ from the primary', () => {
    for (const [id, placement] of Object.entries(PLACEMENT)) {
      expect({ id, known: ids.has(placement.category) }).toEqual({
        id,
        known: true,
      });
      for (const tag of placement.tags) {
        expect({ id, tag, known: ids.has(tag) }).toEqual({
          id,
          tag,
          known: true,
        });
        expect(tag).not.toBe(placement.category);
      }
    }
  });

  it('stamps the section, tags and origins on the hint metadata', () => {
    const docs = hints.csp.meta.docs as {
      section?: string;
      sectionTitle?: string;
      tags?: string[];
      origins?: { source: string }[];
    };
    expect(docs.section).toBe(PLACEMENT.csp.category);
    expect(docs.sectionTitle).toBeTruthy();
    expect(docs.tags).toEqual([...PLACEMENT.csp.tags]);
    expect(docs.origins?.length).toBeGreaterThan(0);
  });
});

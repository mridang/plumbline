import { describe, expect, it } from '@jest/globals';
import hints, { hintsByGroup } from '../src/index.js';
import { SOURCE_GROUPS } from '../src/core/groups.js';

interface Docs {
  name?: string;
  description?: string;
  category?: string;
  url?: string;
  groups?: string[];
}

describe('the hint registry', () => {
  const all = Object.entries(hints);

  it('describes every hint completely', () => {
    for (const [id, hint] of all) {
      const docs = hint.meta.docs as Docs;
      expect({ id, name: Boolean(docs.name) }).toEqual({ id, name: true });
      expect({ id, text: (docs.description ?? '').length > 20 }).toEqual({
        id,
        text: true,
      });
      expect({ id, category: docs.category }).not.toEqual({
        id,
        category: 'other',
      });
      expect({ id, url: docs.url?.startsWith('https://') }).toEqual({
        id,
        url: true,
      });
      expect(hint.meta.id).toBe(`extra/${id}`);
    }
  });

  it('puts every hint in a source group', () => {
    for (const [id, hint] of all) {
      const groups = (hint.meta.docs as Docs).groups ?? [];
      expect({
        id,
        source: groups.some((g) => SOURCE_GROUPS.includes(g as never)),
      }).toEqual({ id, source: true });
    }
  });

  it('lists each hint under every group it declares', () => {
    for (const [id, hint] of all) {
      for (const group of (hint.meta.docs as Docs).groups ?? []) {
        expect(hintsByGroup[group as keyof typeof hintsByGroup]).toContain(id);
      }
    }
  });
});

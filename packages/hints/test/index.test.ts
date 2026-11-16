import { describe, expect, it } from '@jest/globals';
import hints, { hintsByGroup } from '../src/index.js';
import { SOURCE_GROUPS } from '../src/core/groups.js';

interface HintDocumentation {
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
      const documentation = hint.meta.docs as HintDocumentation;
      expect({ id, name: Boolean(documentation.name) }).toEqual({
        id,
        name: true,
      });
      expect({
        id,
        text: (documentation.description ?? '').length > 20,
      }).toEqual({
        id,
        text: true,
      });
      expect({ id, category: documentation.category }).not.toEqual({
        id,
        category: 'other',
      });
      expect({ id, url: documentation.url?.startsWith('https://') }).toEqual({
        id,
        url: true,
      });
      expect(hint.meta.id).toBe(`extra/${id}`);
    }
  });

  it('puts every hint in a source group', () => {
    for (const [id, hint] of all) {
      const groups = (hint.meta.docs as HintDocumentation).groups ?? [];
      expect({
        id,
        source: groups.some((g) => SOURCE_GROUPS.includes(g as never)),
      }).toEqual({ id, source: true });
    }
  });

  it('lists each hint under every group it declares', () => {
    for (const [id, hint] of all) {
      for (const group of (hint.meta.docs as HintDocumentation).groups ?? []) {
        expect(hintsByGroup[group as keyof typeof hintsByGroup]).toContain(id);
      }
    }
  });
});

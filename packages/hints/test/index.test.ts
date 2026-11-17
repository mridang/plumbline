import { describe, expect, it } from '@jest/globals';
import hints, { hintsByGroup } from '../src/index.js';
import { SOURCE_GROUPS } from '../src/core/groups.js';
import { documentationOf, groupsOf, textOf } from './helpers/documentation.js';

describe('the hint registry', () => {
  const all = Object.entries(hints);

  it('describes every hint completely', () => {
    for (const [id, hint] of all) {
      const documentation = documentationOf(hint);
      expect({ id, name: Boolean(documentation.name) }).toEqual({
        id,
        name: true,
      });
      expect({
        id,
        text: textOf(documentation.description).length > 20,
      }).toEqual({
        id,
        text: true,
      });
      expect({ id, category: documentation.category }).not.toEqual({
        id,
        category: 'other',
      });
      expect({
        id,
        url: textOf(documentation.url).startsWith('https://'),
      }).toEqual({
        id,
        url: true,
      });
      expect(hint.meta.id).toBe(`extra/${id}`);
    }
  });

  it('puts every hint in a source group', () => {
    for (const [id, hint] of all) {
      const groups = groupsOf(hint);
      expect({
        id,
        source: groups.some((g) => SOURCE_GROUPS.includes(g)),
      }).toEqual({ id, source: true });
    }
  });

  it('lists each hint under every group it declares', () => {
    for (const [id, hint] of all) {
      for (const group of groupsOf(hint)) {
        const members = Object.entries(hintsByGroup).find(
          ([name]) => name === group,
        )?.[1];
        expect(members).toContain(id);
      }
    }
  });
});

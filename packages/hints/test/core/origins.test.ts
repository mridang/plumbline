import { describe, expect, it } from '@jest/globals';
import hints, { hintsByGroup } from '../../src/index.js';
import { ORIGINS } from '../../src/core/origins.js';
import { SOURCES } from '../../src/core/sources.js';

describe('the origins', () => {
  const sourceIds = new Set(SOURCES.map((s) => s.id));

  it('only describes hints that exist, from sources that exist', () => {
    for (const [id, origins] of Object.entries(ORIGINS)) {
      expect({ id, exists: id in hints }).toEqual({ id, exists: true });
      for (const origin of origins) {
        expect(sourceIds.has(origin.source)).toBe(true);
        expect(origin.url.startsWith('https://')).toBe(true);
        expect(origin.summary.length).toBeGreaterThan(10);
        expect(origin.licence.length).toBeGreaterThan(1);
      }
    }
  });

  it('gives every ported hint at least one origin', () => {
    const ported = new Set(
      SOURCES.filter((s) => s.id !== 'original').flatMap(
        (s) => hintsByGroup[s.id as keyof typeof hintsByGroup],
      ),
    );
    for (const id of ported) {
      expect({ id, origins: (ORIGINS[id] ?? []).length > 0 }).toEqual({
        id,
        origins: true,
      });
    }
  });

  it('lists an origin for each source group a hint is in', () => {
    for (const [id, origins] of Object.entries(ORIGINS)) {
      const groups =
        (hints[id].meta.docs as { groups?: string[] }).groups ?? [];
      for (const origin of origins) {
        expect({
          id,
          source: origin.source,
          inGroups: groups.includes(origin.source),
        }).toEqual({
          id,
          source: origin.source,
          inGroups: true,
        });
      }
    }
  });

  it('marks hints written for this package as original work', () => {
    expect(hintsByGroup.original).toContain('privacy-geolocation');
    expect(ORIGINS['privacy-geolocation']?.[0].source).toBe('original');
    expect(ORIGINS['privacy-geolocation']?.[0].url).toBe(
      'https://www.w3.org/TR/geolocation/',
    );
  });
});

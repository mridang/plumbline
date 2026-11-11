import { describe, expect, it } from '@jest/globals';
import hints from '../../src/index.js';
import { ORIGINS } from '../../src/core/origins.js';
import { ALIASES, GROUPS, SOURCE_GROUPS } from '../../src/core/groups.js';
import {
  AUDIENCE_TAGS,
  CONTROLS,
  GROUP_DEFS,
  HOW_TO_FIX,
  INTRO,
  OPT_IN_NOTE,
  PLACEMENT,
  PROFILES,
  SECTION_DEFS,
  SECTION_TAG_TWINS,
  SET_DEFS,
  TAG_IDS,
  TARGETS,
  TIERS,
} from '../../src/core/taxonomy-data.js';

const ids = Object.keys(hints).toSorted((a, b) => a.localeCompare(b));

describe('the taxonomy data', () => {
  it('places every hint, and only hints that exist', () => {
    expect(
      Object.keys(PLACEMENT).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(ids);
  });

  it('gives every hint a section, tier, target, control, month and version', () => {
    const sections = new Set(SECTION_DEFS.map((section) => section.id));
    const controls = new Set(CONTROLS.map((control) => control.id));
    for (const id of ids) {
      const placement = PLACEMENT[id];
      expect({ id, section: sections.has(placement.section) }).toEqual({
        id,
        section: true,
      });
      expect({ id, tier: TIERS.includes(placement.tier) }).toEqual({
        id,
        tier: true,
      });
      expect({ id, target: TARGETS.includes(placement.target) }).toEqual({
        id,
        target: true,
      });
      expect({ id, control: controls.has(placement.control) }).toEqual({
        id,
        control: true,
      });
      expect({
        id,
        added: /^\d{4}-(0[1-9]|1[0-2])$/.test(placement.added),
      }).toEqual({
        id,
        added: true,
      });
      expect(placement.subsection.length).toBeGreaterThan(1);
      expect(placement.since).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives every hint at least one origin', () => {
    for (const id of ids) {
      expect({ id, origins: (ORIGINS[id] ?? []).length > 0 }).toEqual({
        id,
        origins: true,
      });
    }
  });

  it('uses only tags of the closed list, once each', () => {
    for (const id of ids) {
      const { tags } = PLACEMENT[id];
      expect(new Set(tags).size).toBe(tags.length);
      for (const tag of tags) {
        expect({ id, tag, known: TAG_IDS.includes(tag) }).toEqual({
          id,
          tag,
          known: true,
        });
      }
    }
  });

  it('gives a check the tag of a section that is also a tag', () => {
    for (const id of ids) {
      const { section, tags } = PLACEMENT[id];
      if (SECTION_TAG_TWINS.includes(section)) {
        expect({ id, tagged: tags.includes(section) }).toEqual({
          id,
          tagged: true,
        });
      }
    }
  });

  it('lists every section in exactly one display group', () => {
    const listed = GROUP_DEFS.flatMap((group) => group.sections);
    expect([...listed].toSorted((a, b) => a.localeCompare(b))).toEqual(
      SECTION_DEFS.map((section) => section.id).toSorted((a, b) =>
        a.localeCompare(b),
      ),
    );
    for (const section of SECTION_DEFS) {
      const group = GROUP_DEFS.find((g) => g.sections.includes(section.id));
      expect(group?.id).toBe(section.group);
      expect(section.scope.length).toBeGreaterThan(10);
      expect(section.fixer.length).toBeGreaterThan(3);
    }
  });

  it('has no empty section', () => {
    for (const section of SECTION_DEFS) {
      const members = ids.filter((id) => PLACEMENT[id].section === section.id);
      expect({ section: section.id, empty: members.length === 0 }).toEqual({
        section: section.id,
        empty: false,
      });
    }
  });

  it('keeps names unique across sections, tags, targets, tiers, sources and aliases', () => {
    const twins = new Set(SECTION_TAG_TWINS);
    const names = [
      ...SECTION_DEFS.map((section) => section.id).filter(
        (id) => !twins.has(id),
      ),
      ...TAG_IDS,
      ...TARGETS,
      ...TIERS,
      ...SOURCE_GROUPS,
      ...GROUP_DEFS.map((group) => group.id),
      ...Object.keys(ALIASES),
    ];
    const seen = new Set<string>();
    const repeated = names.filter((name) => {
      const again = seen.has(name);
      seen.add(name);
      return again;
    });
    expect(repeated).toEqual([]);
    for (const twin of twins) {
      expect(SECTION_DEFS.some((section) => section.id === twin)).toBe(true);
      expect(TAG_IDS).toContain(twin);
    }
  });

  it('keeps the audience tags in the tag list', () => {
    for (const tag of AUDIENCE_TAGS) {
      expect(TAG_IDS).toContain(tag);
    }
  });

  it('lists profile members that exist', () => {
    expect(PROFILES.length).toBeGreaterThan(0);
    for (const profile of PROFILES) {
      expect(profile.id.startsWith('plumbline:profile/')).toBe(true);
    }
    for (const profile of PROFILES) {
      for (const member of profile.members) {
        expect({ member, known: member in PLACEMENT }).toEqual({
          member,
          known: true,
        });
      }
    }
  });

  it('has a fix for every recommended check, and only for checks that exist', () => {
    const recommended = ids.filter(
      (id) => PLACEMENT[id].tier === 'recommended',
    );
    expect(recommended.filter((id) => !HOW_TO_FIX[id])).toEqual([]);
    for (const id of Object.keys(HOW_TO_FIX)) {
      expect({ id, known: id in PLACEMENT }).toEqual({ id, known: true });
      expect(HOW_TO_FIX[id].fix.length).toBeGreaterThan(5);
    }
  });

  it('introduces every section and the rules in plain words', () => {
    for (const section of SECTION_DEFS) {
      expect(section.intro.length).toBeGreaterThan(20);
    }
    expect(INTRO.length).toBeGreaterThan(0);
    expect(OPT_IN_NOTE).toContain('plumbline:');
  });

  it('describes every top-level and per-section set once, and every profile as a union of sets', () => {
    const names = new Set(SET_DEFS.map((set) => set.id));
    expect(names.size).toBe(SET_DEFS.length);
    for (const section of SECTION_DEFS) {
      for (const tier of TIERS) {
        expect(names.has(`plumbline:${section.id}/${tier}`)).toBe(true);
      }
    }
    for (const set of [SET_DEFS, PROFILES].flat()) {
      expect(set.summary.length).toBeGreaterThan(10);
      expect(set.whenToUse.length).toBeGreaterThan(10);
    }
    for (const profile of PROFILES) {
      for (const part of profile.extends) {
        expect({ part, known: names.has(part) }).toEqual({ part, known: true });
      }
    }
  });

  it('keeps every old group name resolvable', () => {
    expect(GROUPS.length).toBeGreaterThan(0);
  });
});

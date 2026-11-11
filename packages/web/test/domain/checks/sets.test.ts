import { describe, expect, it } from '@jest/globals';

import { CHECKS, PROFILES, SECTIONS } from '@/domain/checks/catalogue';
import { RULE_SET_DEFS, findRuleSet } from '@/domain/checks/sets';

const members = (id: string): readonly string[] =>
  findRuleSet(id)?.members ?? [];

describe('the rule sets', () => {
  it('have each name once, in the plumbline: namespace', () => {
    const ids = RULE_SET_DEFS.map((set) => set.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('plumbline:'))).toBe(true);
  });

  it('start with the default, and hold only checks of the catalogue', () => {
    expect(RULE_SET_DEFS[0]?.id).toBe('plumbline:recommended');
    const known = new Set(CHECKS.map((check) => check.id));
    for (const set of RULE_SET_DEFS) {
      expect(set.members.filter((id) => !known.has(id))).toEqual([]);
      expect(set.title).toBeTruthy();
      expect(set.description).toBeTruthy();
      expect(set.members).toEqual(
        set.members.toSorted((a, b) => Number(a > b) - Number(a < b)),
      );
    }
  });

  it('hold every check in plumbline:all', () => {
    expect(members('plumbline:all')).toEqual(
      CHECKS.map((check) => check.id).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    );
  });

  it('make advanced a superset of recommended, and keep experimental apart', () => {
    const advanced = new Set(members('plumbline:advanced'));
    for (const id of members('plumbline:recommended')) {
      expect(advanced.has(id)).toBe(true);
    }
    const experimental = members('plumbline:experimental');
    expect(experimental).toEqual(
      CHECKS.filter((check) => check.tier === 'experimental')
        .map((check) => check.id)
        .toSorted((a, b) => Number(a > b) - Number(a < b)),
    );
    for (const id of experimental) {
      expect(advanced.has(id)).toBe(false);
    }
  });

  it('make recommended the union of the recommended sets of the default sections', () => {
    const expected = SECTIONS.filter((section) => section.default_on)
      .flatMap((section) => members(`plumbline:${section.id}/recommended`))
      .toSorted((a, b) => Number(a > b) - Number(a < b));
    expect(members('plumbline:recommended')).toEqual(expected);
  });

  it('give every section a recommended, an advanced and an experimental set', () => {
    for (const section of SECTIONS) {
      const recommended = members(`plumbline:${section.id}/recommended`);
      const advanced = members(`plumbline:${section.id}/advanced`);
      const experimental = members(`plumbline:${section.id}/experimental`);
      const own = CHECKS.filter((check) => check.section === section.id);
      expect(recommended).toEqual(
        own
          .filter((c) => c.tier === 'recommended')
          .map((c) => c.id)
          .toSorted((a, b) => Number(a > b) - Number(a < b)),
      );
      expect(advanced).toHaveLength(
        own.filter((c) => c.tier !== 'experimental').length,
      );
      expect(experimental).toHaveLength(
        own.filter((c) => c.tier === 'experimental').length,
      );
      expect(findRuleSet(`plumbline:${section.id}/advanced`)?.section).toBe(
        section.id,
      );
    }
  });

  it('make each profile the union of the sets it extends', () => {
    for (const profile of PROFILES) {
      const union = new Set(profile.extends.flatMap((part) => members(part)));
      expect(members(profile.id)).toEqual(
        [...union].toSorted((a, b) => Number(a > b) - Number(a < b)),
      );
    }
  });

  it('say in words what each set is and when to use it', () => {
    for (const set of RULE_SET_DEFS) {
      expect(set.summary.length).toBeGreaterThan(10);
      expect(set.whenToUse.length).toBeGreaterThan(10);
    }
  });

  it('list the profiles by hand', () => {
    for (const profile of PROFILES) {
      expect(members(profile.id)).toEqual(
        profile.members.toSorted((a, b) => Number(a > b) - Number(a < b)),
      );
      expect(findRuleSet(profile.id)?.kind).toBe('profile');
    }
  });

  it('know nothing of a name that is not a set', () => {
    expect(findRuleSet('plumbline:nope')).toBeUndefined();
  });
});

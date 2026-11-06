import { describe, expect, it } from '@jest/globals';

import {
  areaPath,
  byArea,
  bySubsection,
  filterRules,
  formatMonth,
  parseView,
  queryOf,
  rulesOfArea,
  rulesOfSet,
  rulesOfTag,
  selectorsFor,
  setOfSegments,
  setPath,
  tagPath,
  tierCounts,
  topicTags,
  yamlFor,
} from '@/domain/checks/browse';
import { CHECKS, SECTIONS } from '@/domain/checks/catalogue';
import { findRuleSet } from '@/domain/checks/sets';

describe('parseView', () => {
  it('is empty when the address says nothing', () => {
    expect(parseView({})).toEqual({ q: '' });
  });

  it('reads the text, the tier, the open rule and the fold state', () => {
    const rule = CHECKS[0]!.id;
    expect(
      parseView({ q: ' tls ', tier: 'advanced', rule, open: 'all' }),
    ).toEqual({ q: 'tls', tier: 'advanced', rule, open: 'all' });
  });

  it('drops what it does not know and takes the first of a repeat', () => {
    expect(
      parseView({ tier: 'loud', rule: 'nope', open: 'some', q: ['a', 'b'] }),
    ).toEqual({ q: 'a' });
  });
});

describe('queryOf', () => {
  it('is empty for an empty view', () => {
    expect(queryOf({ q: '' })).toBe('');
  });

  it('writes what is set, lets a change override and removes with undefined', () => {
    const view = { q: 'tls', tier: 'advanced' as const, rule: 'hsts' };
    expect(queryOf(view)).toBe('?q=tls&tier=advanced&rule=hsts');
    expect(queryOf(view, { tier: undefined, rule: undefined })).toBe('?q=tls');
    expect(queryOf(view, { open: 'all' })).toContain('open=all');
  });
});

describe('addresses', () => {
  it('map a set to a path and back', () => {
    expect(setPath('plumbline:recommended')).toBe('/checks/sets/recommended');
    expect(setPath('plumbline:seo/advanced')).toBe('/checks/sets/seo/advanced');
    expect(setOfSegments(['seo', 'advanced'])).toBe('plumbline:seo/advanced');
    expect(setOfSegments(['recommended'])).toBe('plumbline:recommended');
    expect(setOfSegments(['nope'])).toBeUndefined();
  });

  it('give an area and a tag a path', () => {
    expect(areaPath('https')).toBe('/checks/areas/https');
    expect(tagPath('seo')).toBe('/checks/tags/seo');
  });
});

describe('the rules of a view', () => {
  it('take the rules of a set, an area and a tag', () => {
    const set = findRuleSet('plumbline:recommended')!;
    expect(rulesOfSet(set.id).map((c) => c.id)).toEqual(
      CHECKS.filter((c) => set.members.includes(c.id)).map((c) => c.id),
    );
    const area = SECTIONS[0]!.id;
    expect(rulesOfArea(area).every((c) => c.section === area)).toBe(true);
    expect(rulesOfTag('seo').every((c) => c.tags.includes('seo'))).toBe(true);
    expect(rulesOfSet('plumbline:nope')).toEqual([]);
  });

  it('filter by text over id, name, description and tags, and by tier', () => {
    const all = rulesOfSet('plumbline:all');
    const hsts = filterRules(all, { q: 'strict-transport' });
    expect(hsts.map((c) => c.id)).toContain('hsts');
    expect(filterRules(all, { q: 'STRICT TRANSPORT' })).toEqual(hsts);
    expect(filterRules(all, { q: 'zzzz-nothing' })).toEqual([]);
    const experimental = filterRules(all, { q: '', tier: 'experimental' });
    expect(experimental.every((c) => c.tier === 'experimental')).toBe(true);
    expect(filterRules(all, { q: '' })).toEqual(all);
  });

  it('group by area in report order and by subsection by name', () => {
    const groups = byArea(rulesOfSet('plumbline:all'));
    expect(groups.map((g) => g.section.id)).toEqual(
      SECTIONS.map((s) => s.id).filter((id) =>
        CHECKS.some((c) => c.section === id),
      ),
    );
    const subs = bySubsection(rulesOfArea(SECTIONS[0]!.id));
    expect(subs.map((g) => g.subsection)).toEqual(
      subs.map((g) => g.subsection).toSorted(),
    );
    expect(subs.flatMap((g) => g.rules)).toHaveLength(
      rulesOfArea(SECTIONS[0]!.id).length,
    );
  });

  it('count the tiers', () => {
    const rules = rulesOfSet('plumbline:all');
    const counts = tierCounts(rules);
    expect(counts.recommended + counts.advanced + counts.experimental).toBe(
      rules.length,
    );
  });
});

describe('what a rule shows', () => {
  it('leaves out the tag that is its own area, and lists the selectors that reach it', () => {
    const check = CHECKS.find(
      (c) => c.section === 'seo' && c.tags.includes('seo'),
    )!;
    expect(topicTags(check)).not.toContain('seo');
    expect(selectorsFor(check)).toEqual(
      expect.arrayContaining([
        'section:seo',
        'tag:seo',
        `target:${check.target}`,
        `control:${check.control}`,
      ]),
    );
  });

  it('writes a month in full and returns an odd one as it is', () => {
    expect(formatMonth('2026-06')).toBe('June 2026');
    expect(formatMonth('soon')).toBe('soon');
  });

  it('writes the lines that turn a set on', () => {
    expect(yamlFor('plumbline:recommended')).toBe(
      'extends: plumbline:recommended',
    );
    expect(yamlFor('plumbline:all')).toBe('extends: plumbline:all');
    expect(yamlFor('plumbline:email/recommended')).toBe(
      'extends:\n  - plumbline:recommended\n  - plumbline:email/recommended',
    );
  });
});

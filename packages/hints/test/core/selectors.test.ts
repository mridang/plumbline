import { describe, expect, it } from '@jest/globals';
import { ALIASES, GROUPS } from '../../src/core/groups.js';
import { matches, resolve } from '../../src/core/selectors.js';
import { PLACEMENT } from '../../src/core/taxonomy.js';
import hints from '../../src/index.js';

const groupsOf = (id: string): readonly string[] =>
  (hints[id].meta.docs as { groups?: string[] }).groups ?? [];
const known = new Set(Object.keys(hints).flatMap((id) => groupsOf(id)));
const pick = (name: string): string[] => {
  const selectors = resolve(name, known) ?? [];
  return Object.keys(PLACEMENT).filter((id) =>
    selectors.some((s) => matches(s, { id, groups: groupsOf(id) })),
  );
};

describe('resolve', () => {
  it('reads a selector written with its kind', () => {
    expect(resolve('section:https', known)).toEqual([
      { kind: 'section', value: 'https' },
    ]);
    expect(resolve('tag:seo', known)).toEqual([{ kind: 'tag', value: 'seo' }]);
    expect(resolve('control:dns', known)).toEqual([
      { kind: 'control', value: 'dns' },
    ]);
    expect(resolve('tier:advanced', known)).toEqual([
      { kind: 'tier', value: 'advanced' },
    ]);
    expect(resolve('source:owasp', known)).toEqual([
      { kind: 'source', value: 'owasp' },
    ]);
    expect(resolve('target:mail', known)).toEqual([
      { kind: 'target', value: 'mail' },
    ]);
  });

  it('refuses an unknown kind or name', () => {
    expect(resolve('section:nope', known)).toBeUndefined();
    expect(resolve('colour:red', known)).toBeUndefined();
    expect(resolve('nope', known)).toBeUndefined();
  });

  it('reads a bare name as a tag first, then a section, target or tier', () => {
    expect(resolve('seo', known)).toEqual([{ kind: 'tag', value: 'seo' }]);
    expect(resolve('hardening', known)).toEqual([
      { kind: 'section', value: 'hardening' },
    ]);
    expect(resolve('mail', known)).toEqual([{ kind: 'target', value: 'mail' }]);
    expect(resolve('recommended', known)).toEqual([
      { kind: 'tier', value: 'recommended' },
    ]);
    expect(resolve('owasp', known)).toEqual([
      { kind: 'source', value: 'owasp' },
    ]);
  });

  it('keeps every old group name resolving to something', () => {
    for (const group of GROUPS) {
      expect({ group, found: pick(group).length > 0 }).toEqual({
        group,
        found: true,
      });
    }
    for (const alias of Object.keys(ALIASES)) {
      expect({ alias, found: pick(alias).length > 0 }).toEqual({
        alias,
        found: true,
      });
    }
  });

  it('keeps a source group as exact as it was', () => {
    const owasp = Object.keys(hints).filter((id) =>
      groupsOf(id).includes('owasp'),
    );
    expect(pick('owasp')).toEqual(owasp.toSorted((a, b) => a.localeCompare(b)));
  });

  it('lets tag:seo reach at least everything in section:seo', () => {
    const tagged = new Set(pick('tag:seo'));
    for (const id of pick('section:seo')) {
      expect(tagged.has(id)).toBe(true);
    }
  });

  it('maps an old alias to the sections that replaced it', () => {
    expect(pick('https-tls')).toEqual(pick('section:https'));
    expect(pick('site-protection')).toEqual(
      [
        ...pick('section:hardening'),
        ...pick('section:exposure'),
        ...pick('section:protocol'),
      ].toSorted((a, b) => a.localeCompare(b)),
    );
  });

  it('falls back to a group a hint lists that has no other meaning', () => {
    expect(resolve('custom-group', new Set(['custom-group']))).toEqual([
      { kind: 'group', value: 'custom-group' },
    ]);
  });
});

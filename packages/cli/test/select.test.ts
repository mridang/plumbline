import { describe, expect, it } from '@jest/globals';
import { PLACEMENT } from '@mridang/webhint-hint-plumbline/dist/core/taxonomy.js';
import { UsageError } from '../src/options.js';
import type { HintMeta } from '../src/scan.js';
import { filterByGroups, selectHints } from '../src/select.js';

function hint(id: string, groups: string[]): HintMeta {
  return { id, name: id, description: '', category: 'security', groups };
}

const CATALOGUE = [
  hint('csp', ['owasp', 'security-headers']),
  hint('hsts', ['owasp', 'tls']),
  hint('mail-spf', ['internetnl', 'email', 'dns']),
  hint('bimi', ['iab', 'email']),
  hint('custom', ['mine']),
];

const none = { only: [], skip: [], groups: [] };

describe('filterByGroups', () => {
  it('keeps every hint when no group is given', () => {
    expect(filterByGroups(CATALOGUE, [])).toEqual(CATALOGUE);
  });

  it('keeps the hints in any of the groups', () => {
    expect(
      filterByGroups(CATALOGUE, ['tls', 'email']).map((h) => h.id),
    ).toEqual(['hsts', 'mail-spf', 'bimi']);
  });

  it('reads a section, a tag, a target and a source', () => {
    const ids = (names: string[]) =>
      filterByGroups(CATALOGUE, names).map((h) => h.id);
    expect(ids(['section:hardening'])).toEqual(['csp']);
    expect(ids(['tag:deliverability'])).toEqual(['mail-spf', 'bimi']);
    expect(ids(['target:mail'])).toEqual(['mail-spf', 'bimi']);
    expect(ids(['source:owasp'])).toEqual(['csp', 'hsts']);
    expect(ids(['owasp'])).toEqual(['csp', 'hsts']);
  });

  it('reads an old group name through its alias', () => {
    expect(
      filterByGroups(CATALOGUE, ['security-headers']).map((h) => h.id),
    ).toEqual(['csp', 'hsts']);
    expect(filterByGroups(CATALOGUE, ['mine']).map((h) => h.id)).toEqual([
      'custom',
    ]);
  });

  it('keeps the hints of a tier and a target', () => {
    const ids = (tiers: string[], targets?: string[]) =>
      filterByGroups(CATALOGUE, [], { tiers, targets }).map((h) => h.id);
    const placementOf = (id: string): (typeof PLACEMENT)[string] | undefined =>
      PLACEMENT[id];
    const expected = (tiers: string[], target?: string) =>
      CATALOGUE.map((h) => h.id).filter((id) => {
        const placement = placementOf(id);
        return (
          placement !== undefined &&
          tiers.includes(placement.tier) &&
          (target === undefined || placement.target === target)
        );
      });
    expect(ids(['recommended'])).toEqual(expected(['recommended']));
    expect(ids(['recommended', 'advanced'], ['mail'])).toEqual(
      expected(['recommended', 'advanced'], 'mail'),
    );
    expect(expected(['recommended', 'advanced'], 'mail')).toContain('mail-spf');
  });

  it('drops a hint that has no placement when a tier is asked for', () => {
    expect(
      filterByGroups(CATALOGUE, [], { tiers: ['advanced'] }),
    ).not.toContain(CATALOGUE[4]);
  });

  it('refuses a group no hint belongs to', () => {
    expect(() => filterByGroups(CATALOGUE, ['tls', 'nope'])).toThrow(
      new UsageError(
        'unknown group: nope (run "plumbline checks" to list them)',
      ),
    );
  });

  it('refuses an unknown tier or target', () => {
    expect(() => filterByGroups(CATALOGUE, [], { tiers: ['loud'] })).toThrow(
      'unknown tier: loud',
    );
    expect(() => filterByGroups(CATALOGUE, [], { targets: ['moon'] })).toThrow(
      'unknown target: moon',
    );
  });
});

describe('selectHints', () => {
  it('selects every hint by default', () => {
    expect(selectHints(CATALOGUE, none)).toEqual([
      'csp',
      'hsts',
      'mail-spf',
      'bimi',
      'custom',
    ]);
  });

  it('selects only the given ids, in catalogue order', () => {
    expect(
      selectHints(CATALOGUE, { ...none, only: ['mail-spf', 'csp'] }),
    ).toEqual(['csp', 'mail-spf']);
  });

  it('accepts the extra/ prefix webhint reports', () => {
    expect(selectHints(CATALOGUE, { ...none, only: ['extra/hsts'] })).toEqual([
      'hsts',
    ]);
  });

  it('leaves out skipped ids', () => {
    expect(selectHints(CATALOGUE, { ...none, skip: ['hsts'] })).toEqual([
      'csp',
      'mail-spf',
      'bimi',
      'custom',
    ]);
  });

  it('keeps --only within --group', () => {
    expect(
      selectHints(CATALOGUE, {
        ...none,
        only: ['csp', 'mail-spf'],
        groups: ['email'],
      }),
    ).toEqual(['mail-spf']);
  });

  it('keeps --only within --tier and --target', () => {
    const only = ['csp', 'hsts', 'mail-spf'];
    expect(
      selectHints(CATALOGUE, {
        ...none,
        only,
        tiers: ['recommended', 'advanced'],
        targets: ['web'],
      }),
    ).toEqual(only.filter((id) => PLACEMENT[id]?.target === 'web'));
  });

  it('names every unknown id', () => {
    expect(() =>
      selectHints(CATALOGUE, { ...none, only: ['csp', 'a', 'b'] }),
    ).toThrow('unknown checks: a, b (run "plumbline checks" to list them)');
  });

  it('refuses an unknown skipped id', () => {
    expect(() => selectHints(CATALOGUE, { ...none, skip: ['zzz'] })).toThrow(
      'unknown check: zzz',
    );
  });

  it('refuses a selection that leaves nothing', () => {
    expect(() =>
      selectHints(CATALOGUE, { ...none, only: ['csp'], skip: ['csp'] }),
    ).toThrow(
      'the --only, --skip, --group, --tier and --target options leave no checks to run',
    );
  });
});

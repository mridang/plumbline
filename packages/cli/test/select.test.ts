import { describe, expect, it } from '@jest/globals';
import { UsageError } from '../src/options.js';
import type { HintMeta } from '../src/scan.js';
import { filterByGroups, selectHints } from '../src/select.js';

function hint(id: string, groups: string[]): HintMeta {
  return { id, name: id, description: '', category: 'security', groups };
}

const CATALOGUE = [
  hint('csp', ['owasp', 'security-headers']),
  hint('hsts', ['owasp', 'tls']),
  hint('spf', ['internetnl', 'email', 'dns']),
];

const none = { only: [], skip: [], groups: [] };

describe('filterByGroups', () => {
  it('keeps every hint when no group is given', () => {
    expect(filterByGroups(CATALOGUE, [])).toEqual(CATALOGUE);
  });

  it('keeps the hints in any of the groups', () => {
    expect(
      filterByGroups(CATALOGUE, ['tls', 'email']).map((h) => h.id),
    ).toEqual(['hsts', 'spf']);
  });

  it('refuses a group no hint belongs to', () => {
    expect(() => filterByGroups(CATALOGUE, ['tls', 'nope'])).toThrow(
      new UsageError(
        'unknown group: nope (run "plumbline checks" to list them)',
      ),
    );
  });
});

describe('selectHints', () => {
  it('selects every hint by default', () => {
    expect(selectHints(CATALOGUE, none)).toEqual(['csp', 'hsts', 'spf']);
  });

  it('selects only the given ids, in catalogue order', () => {
    expect(selectHints(CATALOGUE, { ...none, only: ['spf', 'csp'] })).toEqual([
      'csp',
      'spf',
    ]);
  });

  it('accepts the extra/ prefix webhint reports', () => {
    expect(selectHints(CATALOGUE, { ...none, only: ['extra/hsts'] })).toEqual([
      'hsts',
    ]);
  });

  it('leaves out skipped ids', () => {
    expect(selectHints(CATALOGUE, { ...none, skip: ['hsts'] })).toEqual([
      'csp',
      'spf',
    ]);
  });

  it('keeps --only within --group', () => {
    expect(
      selectHints(CATALOGUE, {
        ...none,
        only: ['csp', 'spf'],
        groups: ['dns'],
      }),
    ).toEqual(['spf']);
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
    ).toThrow('the --only, --skip and --group options leave no checks to run');
  });
});

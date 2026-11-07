import { describe, expect, it } from '@jest/globals';

import { globMatches, matchesAny } from '@/domain/suite/glob';

describe('globMatches', () => {
  it('matches a name written out, ignoring case', () => {
    expect(globMatches('production', 'Production')).toBe(true);
    expect(globMatches('production', 'prod')).toBe(false);
  });

  it('lets * stand for any run of characters, none included', () => {
    expect(globMatches('prd_*', 'prd_foo')).toBe(true);
    expect(globMatches('prd_*', 'prd_')).toBe(true);
    expect(globMatches('*-svc', 'micro-svc')).toBe(true);
    expect(globMatches('a*b*c', 'a-b-b-c')).toBe(true);
    expect(globMatches('*', '')).toBe(true);
    expect(globMatches('prd_*', 'xprd_foo')).toBe(false);
  });

  it('lets ? stand for exactly one character', () => {
    expect(globMatches('pr-?', 'pr-7')).toBe(true);
    expect(globMatches('pr-?', 'pr-12')).toBe(false);
    expect(globMatches('pr-?', 'pr-')).toBe(false);
  });

  it('takes everything else as itself, so no pattern can be invalid', () => {
    expect(globMatches('a.b', 'a.b')).toBe(true);
    expect(globMatches('a.b', 'axb')).toBe(false);
    expect(globMatches('[x', '[x')).toBe(true);
    expect(globMatches('(', '(')).toBe(true);
  });

  it('matches the whole name, not a part of it', () => {
    expect(globMatches('prod', 'production')).toBe(false);
    expect(globMatches('', 'x')).toBe(false);
    expect(globMatches('', '')).toBe(true);
  });

  it('backtracks, so a star that took too little tries again', () => {
    expect(globMatches('*ab', 'aab')).toBe(true);
    expect(globMatches('*a*b', 'xaxab')).toBe(true);
    expect(globMatches('*a*b', 'xaxac')).toBe(false);
  });
});

describe('matchesAny', () => {
  it('is true when one pattern matches', () => {
    expect(matchesAny(['production', 'prd_*'], 'prd_foo')).toBe(true);
    expect(matchesAny(['production', 'prd_*'], 'micro_svc')).toBe(false);
  });

  it('matches nothing for no patterns', () => {
    expect(matchesAny([], 'production')).toBe(false);
  });
});

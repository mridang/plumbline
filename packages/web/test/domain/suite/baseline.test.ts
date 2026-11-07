import { describe, expect, it } from '@jest/globals';

import {
  baselineHost,
  compareWithBaseline,
  comparisonConclusion,
  environmentKey,
  type Baseline,
} from '@/domain/suite/baseline';
import type { StoredFinding } from '@/domain/suite/diff';

const found = (
  id: string,
  severity: StoredFinding['severity'] = 'error',
  message = `${id} is wrong`,
): StoredFinding => ({ id, severity, message });

describe('environmentKey', () => {
  it('takes the words that only say it is a copy, and the numbers, away', () => {
    expect(environmentKey('prd_foo')).toBe('prd_foo');
    expect(environmentKey('Preview-prd_foo')).toBe('prd_foo');
    expect(environmentKey('pr-12-prd_foo')).toBe('prd_foo');
    expect(environmentKey('prd_foo-staging')).toBe('prd_foo');
    expect(environmentKey('review/prd.foo/7')).toBe('prd_foo');
  });

  it('is empty for a name that is only such words', () => {
    expect(environmentKey('Preview')).toBe('');
    expect(environmentKey('pull-request-42')).toBe('');
  });

  it('keeps a name that is a service, even when it says production', () => {
    expect(environmentKey('production')).toBe('production');
  });
});

describe('baselineHost', () => {
  const sites = [
    { host: 'api.example.com', environment: 'prd_api' },
    { host: 'app.example.com', environment: 'prd_app' },
  ];

  it('prefers the mapping of the file, the first pattern that matches', () => {
    expect(
      baselineHost({
        environment: 'pr-12',
        sites,
        mapping: [
          ['pr-*', 'app.example.com'],
          ['pr-1*', 'api.example.com'],
        ],
      }),
    ).toBe('app.example.com');
  });

  it('takes the mapped host even when it is not a site of the repository', () => {
    expect(
      baselineHost({
        environment: 'Preview',
        sites,
        mapping: [['preview', 'www.example.com']],
      }),
    ).toBe('www.example.com');
  });

  it('takes the only site of the repository', () => {
    expect(
      baselineHost({
        environment: 'Preview',
        sites: [{ host: 'only.example.com', environment: null }],
        mapping: [],
      }),
    ).toBe('only.example.com');
  });

  it('finds the site whose environment is the preview with the copy words taken away', () => {
    expect(
      baselineHost({ environment: 'preview_prd_app', sites, mapping: [] }),
    ).toBe('app.example.com');
    expect(
      baselineHost({ environment: 'pr-9-prd_api', sites, mapping: [] }),
    ).toBe('api.example.com');
  });

  it('has no baseline when two sites would match', () => {
    expect(
      baselineHost({
        environment: 'preview_prd_app',
        sites: [
          { host: 'a.example.com', environment: 'prd_app' },
          { host: 'b.example.com', environment: 'PRD-app' },
        ],
        mapping: [],
      }),
    ).toBeNull();
  });

  it('has no baseline when none matches, or the name says nothing but "preview"', () => {
    expect(
      baselineHost({ environment: 'preview_other', sites, mapping: [] }),
    ).toBeNull();
    expect(
      baselineHost({ environment: 'Preview', sites, mapping: [] }),
    ).toBeNull();
  });

  it('does not match a site no deployment reported', () => {
    expect(
      baselineHost({
        environment: 'preview_prd_app',
        sites: [
          { host: 'a.example.com', environment: null },
          { host: 'b.example.com', environment: 'prd_other' },
        ],
        mapping: [],
      }),
    ).toBeNull();
  });
});

describe('compareWithBaseline and comparisonConclusion', () => {
  const baseline = (
    findings: StoredFinding[],
    checks = ['a', 'b', 'c', 'd'],
  ): Baseline => ({
    host: 'live.example.com',
    findings,
    levels: new Set(checks),
  });
  const everything = new Set(['a', 'b', 'c', 'd', 'e']);

  it('passes a preview that has only the problems the live site has', () => {
    const live = [found('a'), found('b', 'warning')];
    const result = compareWithBaseline(live, baseline(live), everything);
    expect(result.added).toEqual([]);
    expect(result.existing).toEqual(live);
    expect(comparisonConclusion(result)).toBe('success');
  });

  it('fails a preview that adds an error', () => {
    const result = compareWithBaseline(
      [found('a'), found('c')],
      baseline([found('a')]),
      everything,
    );
    expect(result.added.map((f) => f.id)).toEqual(['c']);
    expect(result.existing.map((f) => f.id)).toEqual(['a']);
    expect(comparisonConclusion(result)).toBe('failure');
  });

  it('leaves a preview that adds only a warning neutral', () => {
    const result = compareWithBaseline(
      [found('c', 'warning')],
      baseline([]),
      everything,
    );
    expect(comparisonConclusion(result)).toBe('neutral');
  });

  it('ignores a hint the change adds', () => {
    const result = compareWithBaseline(
      [found('c', 'hint')],
      baseline([]),
      everything,
    );
    expect(result.added).toHaveLength(1);
    expect(comparisonConclusion(result)).toBe('success');
  });

  it('counts the same check as the same problem whatever its message or severity says', () => {
    const result = compareWithBaseline(
      [found('a', 'error', 'on pr-3.example.com the header is missing')],
      baseline([found('a', 'warning', 'on live.example.com it is missing')]),
      everything,
    );
    expect(result.added).toEqual([]);
    expect(comparisonConclusion(result)).toBe('success');
  });

  it('lists what the change fixed, once for each check', () => {
    const result = compareWithBaseline(
      [],
      baseline([found('a'), found('a', 'error', 'again'), found('b')]),
      everything,
    );
    expect(result.fixed.map((f) => f.id)).toEqual(['a', 'b']);
    expect(comparisonConclusion(result)).toBe('success');
  });

  it('does not call a problem fixed by a check the preview did not run', () => {
    const result = compareWithBaseline(
      [],
      baseline([found('a')]),
      new Set(['b']),
    );
    expect(result.fixed).toEqual([]);
  });

  it('does not fail on a finding of a check the live site does not run', () => {
    const result = compareWithBaseline(
      [found('e')],
      baseline([], ['a', 'b']),
      everything,
    );
    expect(result.added).toEqual([]);
    expect(result.uncompared.map((f) => f.id)).toEqual(['e']);
    expect(comparisonConclusion(result)).toBe('neutral');
  });
});

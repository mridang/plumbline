import { describe, expect, it } from '@jest/globals';

import {
  allOpen,
  countByStatus,
  isOpen,
  issuesByCheck,
  matches,
  openByDefault,
  sectionsOf,
  setAll,
} from '@/components/scan/results';
import type { IssueRef } from '@/domain/db/issue-history';
import type { HintOutcome } from '@/domain/scan/outcome';

/** A hint with the given id, outcome and section. */
function hint(
  id: string,
  status: HintOutcome['status'],
  section = 'security',
  order = 1,
): HintOutcome {
  return {
    id,
    name: id,
    description: '',
    section,
    sectionTitle: section.toUpperCase(),
    sectionOrder: order,
    groups: [],
    origins: [],
    status,
    findings: [],
  };
}

/** The outcomes of a scan of these hints. */
function scanOf(...hints: HintOutcome[]): readonly HintOutcome[] {
  return hints;
}

describe('countByStatus', () => {
  it('counts each outcome, zero for those that did not happen', () => {
    expect(
      countByStatus(
        scanOf(hint('a', 'failed'), hint('b', 'failed'), hint('c', 'passed')),
      ),
    ).toEqual({ failed: 2, warned: 0, passed: 1, skipped: 0 });
  });
});

describe('matches', () => {
  it.each([
    ['problems', 'failed', true],
    ['problems', 'warned', true],
    ['problems', 'passed', false],
    ['problems', 'skipped', false],
    ['all', 'skipped', true],
    ['passed', 'passed', true],
    ['passed', 'failed', false],
  ] as const)('under %s shows a %s hint: %s', (filter, status, shown) => {
    expect(matches(hint('a', status), filter)).toBe(shown);
  });
});

describe('sectionsOf', () => {
  it('groups by section in section order, worst first, then by name', () => {
    const scan = scanOf(
      hint('z-pass', 'passed', 'seo', 2),
      hint('b-pass', 'passed', 'security', 1),
      hint('a-skip', 'skipped', 'security', 1),
      hint('c-fail', 'failed', 'security', 1),
      hint('d-warn', 'warned', 'seo', 2),
    );
    expect(
      sectionsOf(scan, 'all').map((s) => [s.title, s.hints.map((h) => h.id)]),
    ).toEqual([
      ['SECURITY', ['c-fail', 'b-pass', 'a-skip']],
      ['SEO', ['d-warn', 'z-pass']],
    ]);
  });

  it('leaves out sections with nothing under the filter', () => {
    const scan = scanOf(hint('a', 'passed', 'seo'), hint('b', 'failed'));
    expect(sectionsOf(scan, 'problems').map((s) => s.id)).toEqual(['security']);
  });
});

describe('which checks are open', () => {
  it('starts only the checks that failed open', () => {
    expect(openByDefault(hint('a', 'failed'))).toBe(true);
    for (const status of ['warned', 'passed', 'skipped'] as const) {
      expect(openByDefault(hint('a', status))).toBe(false);
    }
  });

  it('goes by what the person did, then by how a check starts', () => {
    const failed = hint('a', 'failed');
    const passed = hint('b', 'passed');
    expect(isOpen(failed, {})).toBe(true);
    expect(isOpen(passed, {})).toBe(false);
    expect(isOpen(failed, { a: false })).toBe(false);
    expect(isOpen(passed, { b: true })).toBe(true);
  });

  it('says whether every check is open, and sets them all at once', () => {
    const hints = [hint('a', 'failed'), hint('b', 'warned')];
    expect(allOpen(hints, {})).toBe(false);
    expect(allOpen(hints, setAll(hints, true))).toBe(true);
    expect(allOpen(hints, setAll(hints, false))).toBe(false);
    expect(allOpen([], {})).toBe(true);
  });
});

describe('issuesByCheck', () => {
  const issue = (number: number, checks: string[]): IssueRef => ({
    number,
    state: 'open',
    opened_at: '2026-01-01T00:00:00.000Z',
    checks,
  });

  it('groups the issues under each check they reported, keeping their order', () => {
    const grouped = issuesByCheck([
      issue(3, ['csp', 'hsts']),
      issue(2, ['hsts']),
    ]);
    expect(grouped['hsts']?.map((i) => i.number)).toEqual([3, 2]);
    expect(grouped['csp']?.map((i) => i.number)).toEqual([3]);
    expect(grouped['other']).toBeUndefined();
  });

  it('is empty for no issues', () => {
    expect(issuesByCheck([])).toEqual({});
  });
});

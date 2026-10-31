import { describe, expect, it } from '@jest/globals';

import {
  countByStatus,
  matches,
  sectionsOf,
} from '@/app/(site)/_components/results';
import type { HintOutcome } from '@/domain/scan/engine';

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

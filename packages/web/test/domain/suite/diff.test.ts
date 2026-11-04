import { describe, expect, it } from '@jest/globals';

import { diffFindings, findingsOf } from '@/domain/suite/diff';

const found = (id: string, message: string) => ({
  id,
  severity: 'warning' as const,
  message,
});

describe('findingsOf', () => {
  it('flattens the findings and drops the checks that passed', () => {
    expect(
      findingsOf([
        { id: 'a', findings: [{ severity: 'error', message: 'bad' }] },
        { id: 'b', findings: [] },
      ]),
    ).toEqual([{ id: 'a', severity: 'error', message: 'bad' }]);
  });
});

describe('diffFindings', () => {
  it('reports what appeared and what went away', () => {
    const changes = diffFindings(
      [found('a', 'one'), found('b', 'two')],
      [found('b', 'two'), found('c', 'three')],
    );
    expect(changes.added).toEqual([found('c', 'three')]);
    expect(changes.fixed).toEqual([found('a', 'one')]);
  });

  it('treats the same check with a different message as a new finding', () => {
    const changes = diffFindings(
      [found('a', '3 images')],
      [found('a', '4 images')],
    );
    expect(changes.added).toEqual([found('a', '4 images')]);
    expect(changes.fixed).toEqual([found('a', '3 images')]);
  });

  it('reports nothing when the runs agree', () => {
    expect(diffFindings([found('a', 'x')], [found('a', 'x')])).toEqual({
      added: [],
      fixed: [],
    });
  });
});

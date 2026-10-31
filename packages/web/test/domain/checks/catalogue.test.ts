import { describe, expect, it } from '@jest/globals';

import {
  applyChoice,
  CHECKS,
  checksInGroup,
  enabledChecks,
  expandSelection,
  findCheck,
  GROUPS,
  isCheckId,
} from '@/domain/checks/catalogue';

const ALL = CHECKS.map((check) => check.id);

describe('CHECKS', () => {
  it('lists the checks of the hints package', () => {
    expect(CHECKS.length).toBeGreaterThan(50);
  });

  it('is sorted by id', () => {
    expect(ALL).toEqual(ALL.toSorted());
  });

  it('has no id twice', () => {
    expect(new Set(ALL).size).toBe(ALL.length);
  });

  it('gives every check a name, a description, a section and a group', () => {
    expect(
      CHECKS.filter(
        (check) =>
          check.name === '' ||
          check.description === '' ||
          check.section === '' ||
          check.groups.length === 0,
      ),
    ).toEqual([]);
  });

  it('says who usually fixes every check', () => {
    expect(CHECKS.filter((check) => !check.fixer)).toEqual([]);
  });

  it('gives every origin a source, a title, an address and a summary', () => {
    expect(
      CHECKS.flatMap((check) => check.origins).filter(
        (origin) =>
          origin.source === '' ||
          origin.title === '' ||
          !/^https?:\/\//.test(origin.url) ||
          origin.summary === '',
      ),
    ).toEqual([]);
  });

  it('keeps the upstream origins of the checks taken from elsewhere', () => {
    expect(CHECKS.some((check) => check.origins.length > 0)).toBe(true);
  });
});

describe('GROUPS', () => {
  it('is every group a check belongs to, sorted and once each', () => {
    expect(GROUPS).toEqual(
      [...new Set(CHECKS.flatMap((c) => c.groups))].toSorted(),
    );
  });

  it('includes the sources and topics', () => {
    expect(GROUPS).toEqual(expect.arrayContaining(['owasp', 'tls', 'dns']));
  });
});

describe('findCheck', () => {
  it('finds a check by its id', () => {
    expect(findCheck('csp')?.name).toBe('Content Security Policy');
  });

  it('finds nothing for an unknown id', () => {
    expect(findCheck('nope')).toBeUndefined();
  });

  it('does not mistake an inherited name for a check', () => {
    expect(findCheck('constructor')).toBeUndefined();
  });
});

describe('isCheckId', () => {
  it('knows a check', () => {
    expect(isCheckId('csp')).toBe(true);
  });

  it('does not take a group for a check', () => {
    expect(isCheckId('owasp')).toBe(false);
  });
});

describe('checksInGroup', () => {
  it('holds only checks of that group', () => {
    expect(checksInGroup('tls').every((c) => c.groups.includes('tls'))).toBe(
      true,
    );
  });

  it('holds every check of that group', () => {
    expect(checksInGroup('tls')).toHaveLength(
      CHECKS.filter((c) => c.groups.includes('tls')).length,
    );
  });

  it('is empty for a group that does not exist', () => {
    expect(checksInGroup('nope')).toEqual([]);
  });
});

describe('enabledChecks', () => {
  it('runs every check when none were chosen', () => {
    expect(enabledChecks(null)).toEqual(ALL);
  });

  it('runs the chosen checks', () => {
    expect(enabledChecks(['csp', 'etag'])).toEqual(['csp', 'etag']);
  });

  it('drops a chosen check that no longer exists', () => {
    expect(enabledChecks(['csp', 'gone'])).toEqual(['csp']);
  });

  it('runs nothing when an empty list was chosen', () => {
    expect(enabledChecks([])).toEqual([]);
  });
});

describe('applyChoice', () => {
  it('switches a check off from every check', () => {
    expect(applyChoice(null, { disable: ['csp'] })).toEqual(
      ALL.filter((id) => id !== 'csp'),
    );
  });

  it('switches a check on', () => {
    expect(applyChoice(['etag'], { enable: ['csp'] })).toEqual(['csp', 'etag']);
  });

  it('keeps the catalogue’s order', () => {
    expect(applyChoice([], { enable: ['etag', 'csp'] })).toEqual([
      'csp',
      'etag',
    ]);
  });

  it('stores every check as null, so checks added later run too', () => {
    expect(applyChoice(['csp'], { enable: ALL })).toBeNull();
  });

  it('keeps null when nothing changes', () => {
    expect(applyChoice(null, {})).toBeNull();
  });

  it('switches off what is both enabled and disabled', () => {
    expect(applyChoice([], { enable: ['csp'], disable: ['csp'] })).toEqual([]);
  });

  it('ignores ids that are not checks', () => {
    expect(applyChoice([], { enable: ['nope'] })).toEqual([]);
  });

  it('drops stored ids of checks that no longer exist', () => {
    expect(applyChoice(['gone', 'csp'], {})).toEqual(['csp']);
  });
});

describe('expandSelection', () => {
  it('keeps a check id', () => {
    expect(expandSelection(['csp'])).toEqual({ ids: ['csp'], unknown: [] });
  });

  it('expands a group into its checks', () => {
    expect(expandSelection(['tls']).ids).toEqual(
      checksInGroup('tls').map((c) => c.id),
    );
  });

  it('names what is neither a check nor a group', () => {
    expect(expandSelection(['csp', 'nope']).unknown).toEqual(['nope']);
  });

  it('lists a check once even when named twice or through a group', () => {
    const [first] = checksInGroup('tls');
    const { ids } = expandSelection([first?.id ?? '', 'tls', first?.id ?? '']);
    expect(ids.filter((id) => id === first?.id)).toHaveLength(1);
  });

  it('expands nothing from an empty list', () => {
    expect(expandSelection([])).toEqual({ ids: [], unknown: [] });
  });
});

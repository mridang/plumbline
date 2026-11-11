import { describe, expect, it } from '@jest/globals';

import {
  applyChoice,
  CHECKS,
  checksPerSection,
  checksInGroup,
  enabledChecks,
  CONTROLS,
  DISPLAY_GROUPS,
  expandSelection,
  findCheck,
  GROUPS,
  INTRO,
  isCheckId,
  isGroup,
  OPT_IN_NOTE,
  PROFILES,
  SECTIONS,
  TAGS,
  TARGETS,
  TIERS,
} from '@/domain/checks/catalogue';

const ALL = CHECKS.map((check) => check.id);

describe('CHECKS', () => {
  it('lists the checks of the hints package', () => {
    expect(CHECKS.length).toBeGreaterThan(50);
  });

  it('is sorted by id', () => {
    expect(ALL).toEqual(ALL.toSorted((a, b) => Number(a > b) - Number(a < b)));
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

describe('SECTIONS', () => {
  it('lists the sections in report order, each described and with who fixes it', () => {
    expect(SECTIONS.map((s) => s.order)).toEqual(SECTIONS.map((_, i) => i));
    expect(
      SECTIONS.filter(
        (s) => s.title === '' || s.description === '' || !s.fixer,
      ),
    ).toEqual([]);
  });

  it('holds the section of every check', () => {
    const ids = new Set(SECTIONS.map((s) => s.id));
    expect(CHECKS.filter((check) => !ids.has(check.section))).toEqual([]);
  });
});

describe('checksPerSection', () => {
  it('counts every check once, under its section', () => {
    const counts = checksPerSection();
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(CHECKS.length);
    const first = CHECKS[0];
    expect(counts.get(first?.section ?? '')).toBe(
      CHECKS.filter((check) => check.section === first?.section).length,
    );
  });
});

describe('GROUPS', () => {
  it('is sorted and has each name once', () => {
    expect(GROUPS).toEqual(
      [...new Set(GROUPS)].toSorted((a, b) => Number(a > b) - Number(a < b)),
    );
  });

  it('names the sections, tags, targets, tiers, sources and old groups', () => {
    expect(GROUPS).toEqual(
      expect.arrayContaining([
        ...SECTIONS.map((section) => section.id),
        ...TAGS,
        ...TARGETS,
        ...TIERS,
        'owasp',
        'tls',
        'security-headers',
      ]),
    );
  });
});

describe('the taxonomy of a check', () => {
  it('gives every check a display group, a tier, a target, a control and a month', () => {
    const groups = new Set(DISPLAY_GROUPS.map((group) => group.id));
    for (const check of CHECKS) {
      expect({ id: check.id, ok: groups.has(check.group) }).toEqual({
        id: check.id,
        ok: true,
      });
      expect(TIERS).toContain(check.tier);
      expect(TARGETS).toContain(check.target);
      expect(CONTROLS).toContain(check.control);
      expect(check.added).toMatch(/^\d{4}-\d{2}$/);
      expect(check.since).toBeGreaterThanOrEqual(1);
    }
  });

  it('lists every section under one display group', () => {
    const listed = DISPLAY_GROUPS.flatMap((group) => group.sections);
    expect(listed.toSorted((a, b) => Number(a > b) - Number(a < b))).toEqual(
      SECTIONS.map((s) => s.id).toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      ),
    );
    for (const section of SECTIONS) {
      expect(typeof section.default_on).toBe('boolean');
      expect(section.group_title.length).toBeGreaterThan(1);
    }
  });

  it('lists profile members that are checks', () => {
    for (const profile of PROFILES) {
      expect(profile.members.filter((id) => !isCheckId(id))).toEqual([]);
    }
  });

  it('says how to fix every recommended check', () => {
    for (const check of CHECKS.filter((c) => c.tier === 'recommended')) {
      expect({ id: check.id, fix: check.how_to_fix?.fix }).toEqual({
        id: check.id,
        fix: expect.any(String),
      });
    }
  });

  it('introduces every section and the rules', () => {
    for (const section of SECTIONS) {
      expect(section.intro.length).toBeGreaterThan(20);
    }
    expect(INTRO.length).toBeGreaterThan(0);
    expect(OPT_IN_NOTE).toContain('plumbline:');
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
  it('holds the checks of a source group', () => {
    const owasp = checksInGroup('owasp');
    expect(owasp.length).toBeGreaterThan(0);
    expect(owasp.every((c) => c.groups.includes('owasp'))).toBe(true);
    expect(owasp).toHaveLength(
      CHECKS.filter((c) => c.groups.includes('owasp')).length,
    );
  });

  it('reads a section, a tag, a target, a tier and a control', () => {
    expect(checksInGroup('section:hardening').map((c) => c.section)).toEqual(
      checksInGroup('hardening').map(() => 'hardening'),
    );
    expect(checksInGroup('tag:seo').every((c) => c.tags.includes('seo'))).toBe(
      true,
    );
    expect(checksInGroup('target:mail').every((c) => c.target === 'mail')).toBe(
      true,
    );
    expect(
      checksInGroup('tier:recommended').every((c) => c.tier === 'recommended'),
    ).toBe(true);
    expect(checksInGroup('control:dns').every((c) => c.control === 'dns')).toBe(
      true,
    );
  });

  it('reads a tag that is also a section as the larger tag', () => {
    expect(checksInGroup('seo').map((c) => c.id)).toEqual(
      checksInGroup('tag:seo').map((c) => c.id),
    );
    const section = new Set(checksInGroup('section:seo').map((c) => c.id));
    const tagged = new Set(checksInGroup('tag:seo').map((c) => c.id));
    expect([...section].every((id) => tagged.has(id))).toBe(true);
  });

  it('reads an old group name through its alias', () => {
    expect(checksInGroup('https-tls').map((c) => c.id)).toEqual(
      checksInGroup('section:https').map((c) => c.id),
    );
    expect(checksInGroup('security-headers').length).toBeGreaterThan(
      checksInGroup('section:https').length,
    );
  });

  it('is empty for a name that does not exist or a kind with a wrong name', () => {
    expect(checksInGroup('nope')).toEqual([]);
    expect(checksInGroup('section:nope')).toEqual([]);
    expect(checksInGroup('colour:red')).toEqual([]);
  });
});

describe('isGroup', () => {
  it('knows a selector and refuses anything else', () => {
    expect(isGroup('tag:seo')).toBe(true);
    expect(isGroup('owasp')).toBe(true);
    expect(isGroup('csp')).toBe(false);
    expect(isGroup('nope')).toBe(false);
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
    expect(expandSelection(['section:email']).ids).toEqual(
      checksInGroup('section:email').map((c) => c.id),
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

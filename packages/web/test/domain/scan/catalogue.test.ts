import { describe, expect, it } from '@jest/globals';

import { catalogue, entryOf, type HintClass } from '@/domain/scan/catalogue';

/** A hint class with the given docs. */
function classWith(docs?: Record<string, unknown>): HintClass {
  return class {
    public static readonly meta = docs ? { docs } : {};
  };
}

describe('entryOf', () => {
  it('reads what the page shows from the hint docs', () => {
    expect(
      entryOf(
        'csp',
        classWith({
          name: 'Content Security Policy',
          description: 'Checks the policy.',
          url: 'https://example.org/csp',
          section: 'site-protection',
          sectionTitle: 'Site protection',
          sectionOrder: 2,
          groups: ['observatory', 7],
          origins: [
            {
              source: 'observatory',
              upstreamId: 'csp',
              title: '',
              url: 'https://upstream.test/csp',
              docsUrl: 'https://upstream.test/docs',
              summary: 'Checks the CSP.',
            },
            { source: 'broken' },
            'not an origin',
          ],
        }),
      ).info,
    ).toEqual({
      id: 'csp',
      name: 'Content Security Policy',
      description: 'Checks the policy.',
      reference: 'https://example.org/csp',
      section: 'site-protection',
      sectionTitle: 'Site protection',
      sectionOrder: 2,
      groups: ['observatory'],
      fixer: 'web server or application config (response headers)',
      origins: [
        {
          source: 'observatory',
          title: 'csp',
          url: 'https://upstream.test/csp',
          docsUrl: 'https://upstream.test/docs',
          summary: 'Checks the CSP.',
        },
      ],
    });
  });

  it('fills in what a hint leaves out', () => {
    expect(entryOf('bare', classWith()).info).toEqual({
      id: 'bare',
      name: 'bare',
      description: '',
      section: 'other',
      sectionTitle: 'Other',
      sectionOrder: Number.MAX_SAFE_INTEGER,
      groups: [],
      origins: [],
    });
  });
});

describe('catalogue', () => {
  it('lists the given hints by id', () => {
    const one = classWith();
    expect(
      catalogue({ zeta: one, alpha: one }).map((entry) => entry.info.id),
    ).toEqual(['alpha', 'zeta']);
  });

  it('lists every hint the hints package ships, each with a name and section', () => {
    const entries = catalogue();
    expect(entries.length).toBeGreaterThan(200);
    entries.forEach(({ info }) => {
      expect(info.name).not.toBe(info.id);
      expect(info.section).not.toBe('other');
      expect(info.fixer).toBeTruthy();
    });
  });
});

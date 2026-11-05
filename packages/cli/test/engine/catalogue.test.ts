import { describe, expect, it } from '@jest/globals';
import {
  catalogue,
  entryOf,
  type HintClass,
} from '../../src/engine/catalogue.js';

/** A hint class with the given `meta.docs`. */
function hintWith(docs: Record<string, unknown> | undefined): HintClass {
  return class {
    public static readonly meta = docs ? { docs } : undefined;
  } as unknown as HintClass;
}

describe('entryOf', () => {
  it('reads the description of a hint from its docs', () => {
    const { info } = entryOf(
      'csp',
      hintWith({
        name: 'CSP',
        description: 'Checks the policy',
        url: 'https://example.com/csp',
        section: 'headers',
        sectionTitle: 'Headers',
        sectionOrder: 3,
        groups: ['owasp', 7, 'privacy'],
        origins: [
          {
            source: 'owasp',
            title: 'CSP rule',
            url: 'https://owasp.org/csp',
            docsUrl: 'https://owasp.org/docs',
            summary: 'Needs a policy',
          },
        ],
      }),
    );
    expect(info).toMatchObject({
      id: 'csp',
      name: 'CSP',
      description: 'Checks the policy',
      reference: 'https://example.com/csp',
      section: 'headers',
      sectionTitle: 'Headers',
      sectionOrder: 3,
      groups: ['owasp', 'privacy'],
      origins: [
        {
          source: 'owasp',
          title: 'CSP rule',
          url: 'https://owasp.org/csp',
          docsUrl: 'https://owasp.org/docs',
          summary: 'Needs a policy',
        },
      ],
    });
  });

  it('falls back for a hint with no docs', () => {
    expect(entryOf('plain', hintWith(undefined)).info).toEqual({
      id: 'plain',
      name: 'plain',
      description: '',
      section: 'other',
      sectionTitle: 'Other',
      sectionOrder: Number.MAX_SAFE_INTEGER,
      groups: [],
      origins: [],
    });
  });

  it('leaves out an origin with no source or no link, and titles one by its link', () => {
    const { info } = entryOf(
      'x',
      hintWith({
        origins: [
          'nope',
          null,
          { source: 'a' },
          { url: 'https://b.example' },
          { source: 'c', url: 'https://c.example' },
        ],
      }),
    );
    expect(info.origins).toEqual([
      {
        source: 'c',
        title: 'https://c.example',
        url: 'https://c.example',
        summary: '',
      },
    ]);
  });
});

describe('catalogue', () => {
  it('lists the given hints by id, in order', () => {
    expect(
      catalogue({ b: hintWith({}), a: hintWith({}) }).map((e) => e.info.id),
    ).toEqual(['a', 'b']);
  });

  it('lists every hint of the package, each with a section and a name', () => {
    const entries = catalogue();
    expect(entries.length).toBeGreaterThan(200);
    for (const { info } of entries) {
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.section).not.toBe('other');
    }
  });
});

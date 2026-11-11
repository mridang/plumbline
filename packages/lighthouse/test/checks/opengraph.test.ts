import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { SECTIONS } from '@mridang/webhint-hint-plumbline/dist/core/taxonomy.js';
import type { Finding } from '@mridang/webhint-hint-plumbline/dist/lib/headers/finding.js';
import {
  ogDescriptionCouldBeLonger,
  ogDescriptionIsUrl,
  ogDescriptionKeywordStuffing,
  ogDescriptionMissing,
  ogDescriptionSameAsTitle,
  ogDescriptionSlightlyLong,
  ogDescriptionTooLong,
  ogDescriptionTooShort,
  ogImageAltMissing,
  ogImageDimensionsMissing,
  ogImageMissing,
  ogImageNotHttps,
  ogLocaleMissing,
  ogSiteNameMissing,
  ogTitleMissing,
  ogTitleTooLong,
  ogTitleTooShort,
  ogTypeMissing,
  ogUrlMissing,
  twitterCardMissing,
  twitterCardNotLarge,
  twitterDescriptionMissing,
  twitterImageMissing,
  twitterSiteMissing,
  twitterTitleMissing,
} from '@mridang/webhint-hint-plumbline/dist/lib/opengraph/checks.js';
import { ogMetaReader } from '../../src/adapt-opengraph.js';
import { opengraphChecks } from '../../src/checks/opengraph.js';
import type { AuditCheck } from '../../src/checks/types.js';
import { HTTP_SCHEME } from '../helpers/data.js';

/**
 * One `<meta>` entry in the shape Lighthouse's `MetaElements` artifact uses.
 * Open Graph tags carry a `property`, Twitter tags a `name`; the reader accepts
 * either, so a fixture may set whichever the real tag would.
 */
interface Meta {
  property?: string;
  name?: string;
  content?: string;
}

/** Builds the artifacts an Open Graph check reads from a list of meta tags. */
function artifacts(metas: readonly Meta[]): Artifacts {
  return { MetaElements: metas } as unknown as Artifacts;
}

/** A fresh audit context; the checks never read it, but the signature wants it. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = opengraphChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

/** Runs a check over a synthetic meta set (the checks are synchronous). */
async function run(
  id: string,
  metas: readonly Meta[],
): Promise<
  | readonly import('@mridang/webhint-hint-plumbline/dist/lib/headers/finding.js').Finding[]
  | null
> {
  return check(id).run(artifacts(metas), context());
}

/** A fully-populated, well-formed Open Graph + Twitter meta set. */
const GOOD_METAS: readonly Meta[] = [
  { property: 'og:title', content: 'A clear, descriptive Open Graph title' },
  {
    property: 'og:description',
    content:
      'A well-written Open Graph description that sits comfortably inside the 110 to 160 character window so platforms show it in full.',
  },
  { property: 'og:url', content: 'https://example.com/page' },
  { property: 'og:type', content: 'website' },
  { property: 'og:site_name', content: 'Example' },
  { property: 'og:locale', content: 'en_US' },
  { property: 'og:image', content: 'https://example.com/og.png' },
  { property: 'og:image:width', content: '1200' },
  { property: 'og:image:height', content: '630' },
  { property: 'og:image:alt', content: 'A description of the image' },
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:title', content: 'A Twitter title' },
  { name: 'twitter:description', content: 'A Twitter description.' },
  { name: 'twitter:image', content: 'https://example.com/og.png' },
  { name: 'twitter:site', content: '@example' },
];

/** The ids the wrapper-file / section assertions iterate over. */
const EXPECTED_IDS = [
  'opengraph-title-missing',
  'opengraph-title-too-long',
  'opengraph-title-too-short',
  'opengraph-description-missing',
  'opengraph-description-too-long',
  'opengraph-description-slightly-long',
  'opengraph-description-too-short',
  'opengraph-description-could-be-longer',
  'opengraph-description-is-url',
  'opengraph-description-same-as-title',
  'opengraph-description-keyword-stuffing',
  'opengraph-url-missing',
  'opengraph-type-missing',
  'opengraph-site-name-missing',
  'opengraph-locale-missing',
  'opengraph-image-missing',
  'opengraph-image-not-https',
  'opengraph-image-dimensions-missing',
  'opengraph-image-alt-missing',
  'twitter-card-missing',
  'twitter-card-not-large',
  'twitter-title-missing',
  'twitter-description-missing',
  'twitter-image-missing',
  'twitter-site-missing',
] as const;

describe('the opengraph registry', () => {
  it('registers all twenty-five Open Graph/Twitter checks', () => {
    expect(opengraphChecks).toHaveLength(25);
    expect(
      [...opengraphChecks]
        .map((c) => c.id)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual([...EXPECTED_IDS].toSorted((a, b) => a.localeCompare(b)));
  });

  it('places every check in a real taxonomy section', () => {
    const sectionIds = new Set(SECTIONS.map((category) => category.id));
    for (const c of opengraphChecks) {
      // Every Open Graph/Twitter hint lives under 'sharing'.
      expect(c.section).toBe('sharing');
      expect(sectionIds.has(c.section)).toBe(true);
    }
  });

  it('reads only the MetaElements artifact', () => {
    for (const c of opengraphChecks) {
      expect(c.requiredArtifacts).toEqual(['MetaElements']);
    }
  });

  it('has a thin wrapper module for every check', async () => {
    for (const c of opengraphChecks) {
      const wrapper = fileURLToPath(
        new URL(`../../src/audits/${c.id}.ts`, import.meta.url),
      );
      const exists = await access(wrapper)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }
  });

  it('marks the info-level (Severity.hint) checks informative, the rest scored', () => {
    const informative = opengraphChecks
      .filter((c) => c.scoreMode === 'informative')
      .map((c) => c.id)
      .toSorted((a, b) => a.localeCompare(b));
    expect(informative).toEqual(
      [
        'opengraph-description-could-be-longer',
        'opengraph-description-slightly-long',
        'opengraph-description-too-short',
        'opengraph-image-alt-missing',
        'opengraph-locale-missing',
        'opengraph-site-name-missing',
        'opengraph-title-too-short',
        'opengraph-type-missing',
        'twitter-card-not-large',
        'twitter-site-missing',
      ].toSorted((a, b) => a.localeCompare(b)),
    );
    // The remaining checks are all graded.
    for (const c of opengraphChecks) {
      if (!informative.includes(c.id)) {
        expect(c.scoreMode).toBe('numeric');
      }
    }
  });

  it('borrows a title and description from every hint', () => {
    for (const c of opengraphChecks) {
      expect(c.title).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.reference).toContain('opengraph.to');
    }
  });
});

describe('the opengraph checks run() over a complete, well-formed meta set', () => {
  it('reports nothing for any check', async () => {
    for (const c of opengraphChecks) {
      await expect(run(c.id, GOOD_METAS)).resolves.toEqual([]);
    }
  });

  it('is not applicable when the MetaElements artifact is absent', async () => {
    const empty = {} as unknown as Artifacts;
    for (const c of opengraphChecks) {
      expect(await c.run(empty, context())).toBeNull();
    }
  });
});

describe('the missing-tag checks run()', () => {
  it('errors when og:title is absent', async () => {
    const findings = await run('opengraph-title-missing', []);
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.severity).toBe('error');
    expect(findings?.[0]?.message).toContain('og:title');
  });

  it('errors when og:description is absent', async () => {
    const findings = await run('opengraph-description-missing', []);
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('errors when og:image is absent', async () => {
    const findings = await run('opengraph-image-missing', []);
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('warns (not errors) when og:url is absent', async () => {
    const findings = await run('opengraph-url-missing', []);
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('gives an informative hint when og:type is absent', async () => {
    const findings = await run('opengraph-type-missing', []);
    expect(findings?.[0]?.severity).toBe('hint');
    expect(check('opengraph-type-missing').scoreMode).toBe('informative');
  });
});

describe('the title and description length checks run()', () => {
  it('warns when og:title exceeds 60 characters', async () => {
    const title = 'x'.repeat(61);
    const findings = await run('opengraph-title-too-long', [
      { property: 'og:title', content: title },
    ]);
    expect(findings?.[0]?.severity).toBe('warning');
    expect(findings?.[0]?.message).toContain('61 characters');
  });

  it('flags a short og:title but never for an absent one', async () => {
    expect(
      await run('opengraph-title-too-short', [
        { property: 'og:title', content: 'short' },
      ]),
    ).toHaveLength(1);
    // Absent title is the missing check's business, not this one's.
    expect(await run('opengraph-title-too-short', [])).toEqual([]);
  });

  it('flags a description of 161 to 200 as slightly long, 201+ as too long', async () => {
    const slightly = 'x'.repeat(180);
    const tooLong = 'x'.repeat(220);
    expect(
      await run('opengraph-description-slightly-long', [
        { property: 'og:description', content: slightly },
      ]),
    ).toHaveLength(1);
    // Beyond 200 the "slightly long" band no longer applies.
    expect(
      await run('opengraph-description-slightly-long', [
        { property: 'og:description', content: tooLong },
      ]),
    ).toEqual([]);
    expect(
      await run('opengraph-description-too-long', [
        { property: 'og:description', content: tooLong },
      ]),
    ).toHaveLength(1);
  });

  it('flags a description under 50 as too short and 50 to 70 as could-be-longer', async () => {
    expect(
      await run('opengraph-description-too-short', [
        { property: 'og:description', content: 'x'.repeat(40) },
      ]),
    ).toHaveLength(1);
    expect(
      await run('opengraph-description-could-be-longer', [
        { property: 'og:description', content: 'x'.repeat(60) },
      ]),
    ).toHaveLength(1);
  });
});

describe('the description-quality checks run()', () => {
  it('flags a description that starts with a URL', async () => {
    const findings = await run('opengraph-description-is-url', [
      { property: 'og:description', content: 'https://example.com is great' },
    ]);
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('flags a description identical to the title', async () => {
    const same = 'The Exact Same Words';
    const findings = await run('opengraph-description-same-as-title', [
      { property: 'og:title', content: same },
      { property: 'og:description', content: same },
    ]);
    expect(findings).toHaveLength(1);
  });

  it('flags keyword-stuffed descriptions', async () => {
    const stuffed =
      'widgets widgets widgets widgets premium widgets cheap widgets';
    const findings = await run('opengraph-description-keyword-stuffing', [
      { property: 'og:description', content: stuffed },
    ]);
    expect(findings).toHaveLength(1);
  });
});

describe('the image checks run()', () => {
  it('warns when og:image is not served over HTTPS', async () => {
    const findings = await run('opengraph-image-not-https', [
      { property: 'og:image', content: `${HTTP_SCHEME}example.com/og.png` },
    ]);
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('warns when og:image dimensions are missing', async () => {
    const findings = await run('opengraph-image-dimensions-missing', [
      { property: 'og:image', content: 'https://example.com/og.png' },
    ]);
    expect(findings?.[0]?.message).toContain('og:image:width');
  });

  it('does not fire the dimension or alt checks when there is no image', async () => {
    expect(await run('opengraph-image-dimensions-missing', [])).toEqual([]);
    expect(await run('opengraph-image-alt-missing', [])).toEqual([]);
  });

  it('gives an informative hint when og:image:alt is missing', async () => {
    const findings = await run('opengraph-image-alt-missing', [
      { property: 'og:image', content: 'https://example.com/og.png' },
    ]);
    expect(findings?.[0]?.severity).toBe('hint');
  });
});

describe('the twitter checks run()', () => {
  it('warns when twitter:card is absent', async () => {
    const twitterFindings = await run('twitter-card-missing', []);
    expect(twitterFindings?.[0]?.severity).toBe('warning');
  });

  it('suggests the large card only when summary is used with an image', async () => {
    // summary with an og:image fallback -> suggest the large card.
    expect(
      await run('twitter-card-not-large', [
        { name: 'twitter:card', content: 'summary' },
        { property: 'og:image', content: 'https://example.com/og.png' },
      ]),
    ).toHaveLength(1);
    // summary with no image at all -> a summary card is fine, no finding.
    expect(
      await run('twitter-card-not-large', [
        { name: 'twitter:card', content: 'summary' },
      ]),
    ).toEqual([]);
  });

  it('fires twitter-image-missing only when og:image cannot stand in', async () => {
    expect(await run('twitter-image-missing', [])).toHaveLength(1);
    // An og:image is an acceptable fallback, so no finding.
    expect(
      await run('twitter-image-missing', [
        { property: 'og:image', content: 'https://example.com/og.png' },
      ]),
    ).toEqual([]);
  });

  it('gives an informative hint when twitter:site is absent', async () => {
    const findings = await run('twitter-site-missing', []);
    expect(findings?.[0]?.severity).toBe('hint');
  });
});

/**
 * Each check calls one shared `src/lib/opengraph/checks.ts` function. This maps
 * a check id to the same function, so the equivalence test below can run the
 * function itself and the Lighthouse check side by side and assert they agree.
 */
const LIB_FN: Readonly<
  Record<
    string,
    (input: { meta: (key: string) => string | null }) => readonly Finding[]
  >
> = {
  'opengraph-title-missing': ogTitleMissing,
  'opengraph-title-too-long': ogTitleTooLong,
  'opengraph-title-too-short': ogTitleTooShort,
  'opengraph-description-missing': ogDescriptionMissing,
  'opengraph-description-too-long': ogDescriptionTooLong,
  'opengraph-description-slightly-long': ogDescriptionSlightlyLong,
  'opengraph-description-too-short': ogDescriptionTooShort,
  'opengraph-description-could-be-longer': ogDescriptionCouldBeLonger,
  'opengraph-description-is-url': ogDescriptionIsUrl,
  'opengraph-description-same-as-title': ogDescriptionSameAsTitle,
  'opengraph-description-keyword-stuffing': ogDescriptionKeywordStuffing,
  'opengraph-url-missing': ogUrlMissing,
  'opengraph-type-missing': ogTypeMissing,
  'opengraph-site-name-missing': ogSiteNameMissing,
  'opengraph-locale-missing': ogLocaleMissing,
  'opengraph-image-missing': ogImageMissing,
  'opengraph-image-not-https': ogImageNotHttps,
  'opengraph-image-dimensions-missing': ogImageDimensionsMissing,
  'opengraph-image-alt-missing': ogImageAltMissing,
  'twitter-card-missing': twitterCardMissing,
  'twitter-card-not-large': twitterCardNotLarge,
  'twitter-title-missing': twitterTitleMissing,
  'twitter-description-missing': twitterDescriptionMissing,
  'twitter-image-missing': twitterImageMissing,
  'twitter-site-missing': twitterSiteMissing,
};

/**
 * A representative, deliberately-flawed meta set that trips several rules at
 * once: a too-long title, a too-short description that starts with a URL, an
 * http:// image with no dimensions or alt, a plain summary Twitter card and
 * missing Twitter title/description/site. Other rules pass on it. Every check
 * must still agree with its library function, finding or no finding.
 */
const FLAWED_METAS: readonly Meta[] = [
  { property: 'og:title', content: 'x'.repeat(61) },
  { property: 'og:description', content: 'https://example.com' },
  { property: 'og:image', content: `${HTTP_SCHEME}example.com/og.png` },
  { name: 'twitter:card', content: 'summary' },
];

describe('the opengraph checks never drift from their library function', () => {
  it('yields exactly what the shared lib function yields, for every check', async () => {
    const meta = ogMetaReader(FLAWED_METAS);
    for (const c of opengraphChecks) {
      const libFn = LIB_FN[c.id];
      expect(libFn).toBeDefined();
      // Both sides read the same tags; the Lighthouse check is a pure
      // pass-through to the library function, so their findings must match.
      const viaCheck = await run(c.id, FLAWED_METAS);
      const viaLib = [...libFn({ meta })];
      expect(viaCheck).toEqual(viaLib);
    }
  });
});

import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { i18nChecks } from '../../src/checks/i18n.js';
import type { AuditCheck } from '../../src/checks/types.js';
// The single-source rules the webhint hints call. The equivalence test runs the
// Lighthouse check through its own HTML parser and asserts the findings match
// these exactly, proving the check and the hint cannot diverge.
import {
  hreflangReturn,
  hreflangValidCodes,
} from '@mridang/webhint-hint-plumbline/dist/lib/i18n/checks.js';
import type { DocumentLike } from '@mridang/webhint-hint-plumbline/dist/lib/i18n/read.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line sonarjs/no-require-or-define -- @hint/utils-dom is CJS-only with no ESM entry point
const { createHTMLDocument } = require('@hint/utils-dom');

/** Parses markup with the same DOM implementation the webhint hints use. */
const parse = (html: string): DocumentLike =>
  createHTMLDocument(html, 'https://x.test/') as DocumentLike;

/** Wraps a head fragment into a full document. */
function doc(head: string): string {
  return `<!doctype html><html lang="en"><head>${head}</head><body></body></html>`;
}

/** Builds the artifacts an i18n check reads. */
function artifacts(overrides: { html?: string; url?: string }): Artifacts {
  const url = overrides.url ?? 'https://x.test/';
  return {
    MainDocumentContent: overrides.html ?? '',
    URL: { mainDocumentUrl: url, finalDisplayedUrl: url },
  } as Artifacts;
}

/** A fresh audit context. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = i18nChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

/** Runs a check and returns its findings (never the `null` sentinel). */
async function run(
  id: string,
  given: Parameters<typeof artifacts>[0],
): Promise<readonly { severity: string; message: string }[]> {
  const findings = await check(id).run(artifacts(given), context());
  if (findings === null) {
    throw new Error(`check '${id}' was unexpectedly not applicable`);
  }
  return findings;
}

describe('the i18n registry', () => {
  it('registers all seven checks under the seo section', () => {
    expect(i18nChecks).toHaveLength(7);
    for (const c of i18nChecks) {
      expect(c.id).toBeTruthy();
      expect(c.section).toBe('seo');
    }
  });

  it('grades the warning rules and leaves x-default informative', () => {
    const numeric = i18nChecks
      .filter((c) => c.scoreMode === 'numeric')
      .map((c) => c.id)
      .toSorted((a, b) => a.localeCompare(b));
    expect(numeric).toEqual([
      'alternate-media',
      'hreflang-duplicate',
      'hreflang-return',
      'hreflang-self',
      'hreflang-valid-codes',
      'pagination-rel',
    ]);
    expect(
      i18nChecks.filter((c) => c.scoreMode === 'informative').map((c) => c.id),
    ).toEqual(['hreflang-x-default']);
  });

  it('borrows its title, description and reference from the webhint hint', () => {
    const c = check('hreflang-return');
    expect(c.title).toBe('hreflang alternates use absolute URLs');
    expect(c.description).toBe(
      'Flags hreflang alternates that use a non-absolute URL.',
    );
    expect(c.reference).toContain('developers.google.com');
  });

  it('is not applicable when the main document is absent', async () => {
    expect(
      await check('hreflang-return').run(artifacts({}), context()),
    ).toBeNull();
  });
});

describe('the hreflang checks', () => {
  it('flags non-absolute alternates and matches the library exactly', async () => {
    const head =
      '<link rel="alternate" hreflang="en" href="/en">' +
      '<link rel="alternate" hreflang="fr" href="https://x.test/fr">';
    const findings = await run('hreflang-return', { html: doc(head) });
    expect(findings).toEqual(hreflangReturn(parse(doc(head))));
    expect(findings).toHaveLength(1);
  });

  it('flags invalid codes and matches the library exactly', async () => {
    const head =
      '<link rel="alternate" hreflang="en_US" href="https://x.test/">';
    const findings = await run('hreflang-valid-codes', { html: doc(head) });
    expect(findings).toEqual(hreflangValidCodes(parse(doc(head))));
  });

  it('reports a missing self-reference against the page URL', async () => {
    const head =
      '<link rel="alternate" hreflang="fr" href="https://x.test/fr">';
    const findings = await run('hreflang-self', {
      html: doc(head),
      url: 'https://x.test/',
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('https://x.test/');
  });

  it('surfaces a missing x-default as informative', async () => {
    const head = '<link rel="alternate" hreflang="en" href="https://x.test/">';
    const findings = await run('hreflang-x-default', { html: doc(head) });
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('hint');
  });

  it('reports duplicated values', async () => {
    const head =
      '<link rel="alternate" hreflang="en" href="https://x.test/a">' +
      '<link rel="alternate" hreflang="en" href="https://x.test/b">';
    const findings = await run('hreflang-duplicate', { html: doc(head) });
    expect(findings).toHaveLength(1);
  });
});

describe('the alternate and pagination checks', () => {
  it('flags a malformed media alternate', async () => {
    const head = '<link rel="alternate" media="print" href="/print">';
    const findings = await run('alternate-media', { html: doc(head) });
    expect(findings).toHaveLength(1);
  });

  it('flags a non-absolute pagination link', async () => {
    const head =
      '<link rel="prev" href="https://x.test/1">' +
      '<link rel="next" href="/3">';
    const findings = await run('pagination-rel', { html: doc(head) });
    expect(findings).toHaveLength(1);
  });
});

import { createHTMLDocument } from '@hint/utils-dom';
import { describe, expect, it } from '@jest/globals';
import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { richresultsChecks } from '../../src/checks/richresults.js';
import { PLACEMENT } from '@mridang/webhint-hint-plumbline/dist/core/taxonomy.js';
import type { AuditCheck } from '../../src/checks/types.js';
import { readJsonLd } from '@mridang/webhint-hint-plumbline/dist/lib/geo/json-ld.js';
import { recipeFindings } from '@mridang/webhint-hint-plumbline/dist/lib/richresults/checks.js';

// The same DOM parser webhint feeds its hints: the equivalence test builds the "webhint side" of the check with it, exactly as the hint does.

/** Builds the artifact bag a richresults check reads: only the served HTML. */
function artifacts(html: string): Artifacts {
  return {
    URL: {
      mainDocumentUrl: 'https://x.test/',
      finalDisplayedUrl: 'https://x.test/',
    },
    MainDocumentContent: html,
  } as Artifacts;
}

/** A richresults check reads no computed artifact, but run() takes a context. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Wraps a parsed object as one JSON-LD block of HTML. */
function jsonLd(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = richresultsChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

describe('the richresults registry', () => {
  it('registers all ten checks in the section the taxonomy gives them', () => {
    expect(richresultsChecks).toHaveLength(10);
    for (const c of richresultsChecks) {
      expect(c.id).toMatch(/^richresults-/);
      expect(c.section).toBe(PLACEMENT[c.id]?.section);
      expect(c.section).toBe('seo');
    }
  });

  it('grades the required-field checks and keeps Article informative', () => {
    const modes = Object.fromEntries(
      richresultsChecks.map((c) => [c.id, c.scoreMode]),
    );
    expect(modes['richresults-article']).toBe('informative');
    expect(modes['richresults-recipe']).toBe('numeric');
    expect(modes['richresults-event']).toBe('numeric');
  });
});

describe('a richresults check run()', () => {
  it('errors on an invalid Recipe', async () => {
    const findings = await check('richresults-recipe').run(
      artifacts(jsonLd({ '@type': 'Recipe' })),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes a valid Event', async () => {
    const findings = await check('richresults-event').run(
      artifacts(
        jsonLd({
          '@type': 'Event',
          name: 'Gig',
          startDate: '2026-01-01',
          location: { '@type': 'Place' },
          endDate: '2026-01-02',
        }),
      ),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('is not applicable when the run captured no document content', async () => {
    expect(
      await check('richresults-product').run(artifacts(''), context()),
    ).toBeNull();
  });
});

describe('the richresults check matches the webhint hint for a fixture', () => {
  // The two surfaces call the same shared validator on the same parsed
  // document, so the Lighthouse findings must equal the webhint-side findings.
  const fixture =
    '<!doctype html><html><head>' +
    jsonLd({ '@type': 'Recipe', name: 'Pie' }) +
    '</head><body></body></html>';

  it('recipe yields the hint findings', async () => {
    const doc = createHTMLDocument(fixture, 'https://x.test/');
    const hintFindings = recipeFindings(readJsonLd(doc));
    const lhFindings = await check('richresults-recipe').run(
      artifacts(fixture),
      context(),
    );
    expect(lhFindings).toEqual(hintFindings);
    expect(hintFindings.length).toBeGreaterThan(0);
  });
});

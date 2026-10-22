import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { seoChecks } from '../../src/checks/seo.js';
import type { AuditCheck } from '../../src/checks/types.js';
// The single-source rules the webhint hints call. The equivalence test runs the
// Lighthouse check through its `adapt-seo` parser and asserts the findings match
// these exactly, proving the check and the hint cannot diverge.
import {
  faviconSvgMissing,
  h1Multiple,
  structuredDataMissing,
  titleMissing,
} from '@mridang/webhint-hint-extra/dist/lib/seo/checks.js';
import type { DocumentLike } from '@mridang/webhint-hint-extra/dist/lib/seo/read.js';

const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom');

/** Parses markup with the same DOM implementation the webhint hints use. */
const parse = (html: string): DocumentLike =>
  createHTMLDocument(html, 'https://x.test/') as DocumentLike;

/**
 * A minimal meta-element artifact entry. Only the fields the SEO readers touch
 * are populated; the rest of Lighthouse's `MetaElement` shape is irrelevant to
 * these checks, so the cast keeps the fixtures small.
 */
function meta(entry: {
  name?: string;
  content?: string;
}): LH.Artifacts['MetaElements'][number] {
  return entry as LH.Artifacts['MetaElements'][number];
}

/** A minimal link-element artifact entry (only `rel` and `href` are read). */
function link(rel: string, href: string): LH.Artifacts['LinkElements'][number] {
  return { rel, href } as LH.Artifacts['LinkElements'][number];
}

/**
 * Builds the artifacts a SEO check reads. Every field a check might require is
 * supplied with a harmless default so one fixture drives every check; a test
 * overrides only the slice its check inspects.
 */
function artifacts(overrides: {
  html?: string;
  metas?: LH.Artifacts['MetaElements'];
  links?: LH.Artifacts['LinkElements'];
  url?: string;
  xRobotsTag?: string;
}): LH.Artifacts {
  const url = overrides.url ?? 'https://x.test/';
  return {
    MainDocumentContent: overrides.html ?? '',
    MetaElements: overrides.metas ?? [],
    LinkElements: overrides.links ?? [],
    URL: { mainDocumentUrl: url, finalDisplayedUrl: url },
    DevtoolsLog: devtoolsLog(url, overrides.xRobotsTag),
  } as unknown as LH.Artifacts;
}

/**
 * The minimal devtools log Lighthouse's `NetworkRecords` computed artifact
 * needs to reconstruct one main-document response, optionally carrying an
 * `X-Robots-Tag` header (the only response header the robots checks read).
 */
function devtoolsLog(
  url: string,
  xRobotsTag?: string,
): LH.Artifacts['DevtoolsLog'] {
  const requestId = '1';
  const headers = xRobotsTag ? { 'x-robots-tag': xRobotsTag } : {};
  const events = [
    {
      method: 'Network.requestWillBeSent',
      params: {
        requestId,
        loaderId: 'LOADER',
        documentURL: url,
        request: { url, method: 'GET' },
        timestamp: 1,
        wallTime: 1,
        initiator: { type: 'other' },
        type: 'Document',
      },
    },
    {
      method: 'Network.responseReceived',
      params: {
        requestId,
        loaderId: 'LOADER',
        timestamp: 2,
        type: 'Document',
        response: {
          url,
          status: 200,
          statusText: 'OK',
          headers,
          mimeType: 'text/html',
          connectionReused: false,
          connectionId: 1,
          fromDiskCache: false,
          fromServiceWorker: false,
          encodedDataLength: 100,
          securityState: 'secure',
          protocol: 'h2',
        },
      },
    },
    {
      method: 'Network.loadingFinished',
      params: { requestId, timestamp: 3, encodedDataLength: 100 },
    },
  ];
  return events as unknown as LH.Artifacts['DevtoolsLog'];
}

/** A fresh audit context; the empty cache makes NetworkRecords recompute. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = seoChecks.find((c) => c.id === id);
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

describe('the seo registry', () => {
  it('registers all eighteen checks under a known SEO section', () => {
    expect(seoChecks).toHaveLength(18);
    for (const c of seoChecks) {
      expect(c.id).toBeTruthy();
      expect(['search', 'social-previews']).toContain(c.section);
    }
  });

  it('places the title/description/robots rules in the search section', () => {
    expect(check('seo-title-missing').section).toBe('search');
    expect(check('seo-robots-noindex').section).toBe('search');
  });

  it('places the favicon rules in the social-previews section', () => {
    for (const id of [
      'icons-favicon-missing',
      'icons-favicon-ico-or-png-missing',
      'icons-favicon-32-missing',
      'icons-favicon-svg-missing',
    ]) {
      expect(check(id).section).toBe('social-previews');
    }
  });

  it('grades only the reproducible error/warning rules, rest informative', () => {
    const numeric = seoChecks
      .filter((c) => c.scoreMode === 'numeric')
      .map((c) => c.id)
      .sort();
    expect(numeric).toEqual([
      'seo-h1-missing',
      'seo-html-lang-missing',
      'seo-meta-description-missing',
      'seo-robots-noindex',
      'seo-title-missing',
      'seo-title-too-long',
    ]);
    // Every other check is surfaced but never scored.
    expect(seoChecks.filter((c) => c.scoreMode === 'informative')).toHaveLength(
      12,
    );
  });

  it('borrows its title, description and reference from the webhint hint', () => {
    const c = check('seo-title-missing');
    expect(c.title).toBe('Page has a title');
    expect(c.description).toBe(
      'Requires a non-empty <title> element in the head.',
    );
    expect(c.reference).toContain('opengraph.to');
  });
});

describe('the title checks', () => {
  it('reports a missing title as an error and passes a present one', async () => {
    const missing = await run('seo-title-missing', {
      html: '<html><head></head><body></body></html>',
    });
    expect(missing[0]?.severity).toBe('error');

    const present = await run('seo-title-missing', {
      html: '<html><head><title>A good descriptive title</title></head></html>',
    });
    expect(present).toEqual([]);
  });

  it('warns on a title longer than seventy characters', async () => {
    const long = 'x'.repeat(71);
    const findings = await run('seo-title-too-long', {
      html: `<title>${long}</title>`,
    });
    expect(findings[0]?.severity).toBe('warning');
    expect(findings[0]?.message).toContain('71 characters');

    expect(
      await run('seo-title-too-long', { html: '<title>A fine title</title>' }),
    ).toEqual([]);
  });

  it('flags a title shorter than ten characters as information', async () => {
    const findings = await run('seo-title-too-short', {
      html: '<title>Short</title>',
    });
    expect(findings[0]?.severity).toBe('hint');

    // An empty title is the missing-title error, not a too-short finding.
    expect(
      await run('seo-title-too-short', { html: '<title></title>' }),
    ).toEqual([]);
  });

  it('is not applicable when no HTML was captured', async () => {
    expect(
      await check('seo-title-missing').run(artifacts({}), context()),
    ).toBeNull();
  });
});

describe('the meta-description checks', () => {
  it('reports a missing description and passes a present one', async () => {
    expect((await run('seo-meta-description-missing', {}))[0]?.severity).toBe(
      'error',
    );
    expect(
      await run('seo-meta-description-missing', {
        metas: [meta({ name: 'description', content: 'A summary.' })],
      }),
    ).toEqual([]);
  });

  it('flags a description over 160 characters', async () => {
    const findings = await run('seo-meta-description-too-long', {
      metas: [meta({ name: 'description', content: 'y'.repeat(161) })],
    });
    expect(findings[0]?.severity).toBe('hint');
    expect(findings[0]?.message).toContain('161 characters');
  });

  it('flags a description under 50 characters', async () => {
    const findings = await run('seo-meta-description-too-short', {
      metas: [meta({ name: 'description', content: 'too short' })],
    });
    expect(findings[0]?.severity).toBe('hint');
    expect(
      await run('seo-meta-description-too-short', {
        metas: [meta({ name: 'description', content: 'z'.repeat(80) })],
      }),
    ).toEqual([]);
  });
});

describe('the heading checks', () => {
  it('warns when there is no h1 and passes with one', async () => {
    expect(
      (
        await run('seo-h1-missing', { html: '<body><p>no heading</p></body>' })
      )[0]?.severity,
    ).toBe('warning');
    expect(
      await run('seo-h1-missing', { html: '<body><h1>Topic</h1></body>' }),
    ).toEqual([]);
  });

  it('flags more than one h1 as information', async () => {
    const findings = await run('seo-h1-multiple', {
      html: '<body><h1>One</h1><h1>Two</h1></body>',
    });
    expect(findings[0]?.severity).toBe('hint');
    expect(findings[0]?.message).toContain('2 <h1>');
    expect(
      await run('seo-h1-multiple', { html: '<body><h1>Only one</h1></body>' }),
    ).toEqual([]);
  });
});

describe('the html-lang check', () => {
  it('warns when lang is absent and passes when present', async () => {
    expect(
      (
        await run('seo-html-lang-missing', {
          html: '<html><head></head></html>',
        })
      )[0]?.severity,
    ).toBe('warning');
    expect(
      await run('seo-html-lang-missing', {
        html: '<html lang="en"><head></head></html>',
      }),
    ).toEqual([]);
  });
});

describe('the robots checks', () => {
  it('warns on a noindex robots meta tag', async () => {
    const findings = await run('seo-robots-noindex', {
      metas: [meta({ name: 'robots', content: 'noindex, nofollow' })],
    });
    expect(findings[0]?.severity).toBe('warning');
    expect(
      await run('seo-robots-noindex', {
        metas: [meta({ name: 'robots', content: 'index, follow' })],
      }),
    ).toEqual([]);
  });

  it('flags nofollow from the X-Robots-Tag header as information', async () => {
    const findings = await run('seo-robots-nofollow', {
      xRobotsTag: 'nofollow',
    });
    expect(findings[0]?.severity).toBe('hint');
    expect(await run('seo-robots-nofollow', {})).toEqual([]);
  });
});

describe('the canonical checks', () => {
  it('flags a missing canonical and passes when one is declared', async () => {
    expect((await run('seo-canonical-missing', {}))[0]?.severity).toBe('hint');
    expect(
      await run('seo-canonical-missing', {
        links: [link('canonical', 'https://x.test/')],
      }),
    ).toEqual([]);
  });

  it('flags a canonical that points at a different URL', async () => {
    const findings = await run('seo-canonical-mismatch', {
      url: 'https://x.test/page',
      links: [link('canonical', 'https://x.test/other')],
    });
    expect(findings[0]?.severity).toBe('hint');
    expect(findings[0]?.message).toContain('https://x.test/other');

    // A self-referencing canonical is fine.
    expect(
      await run('seo-canonical-mismatch', {
        url: 'https://x.test/page',
        links: [link('canonical', 'https://x.test/page')],
      }),
    ).toEqual([]);
  });
});

describe('the structured-data check', () => {
  it('flags a page with no JSON-LD and passes one with it', async () => {
    expect(
      (await run('seo-structured-data-missing', { html: '<html></html>' }))[0]
        ?.severity,
    ).toBe('hint');
    expect(
      await run('seo-structured-data-missing', {
        html: '<script type="application/ld+json">{"@type":"WebPage"}</script>',
      }),
    ).toEqual([]);
  });
});

describe('the favicon checks', () => {
  it('flags a page that declares no icon at all', async () => {
    expect(
      (await run('icons-favicon-missing', { html: '<head></head>' }))[0]
        ?.severity,
    ).toBe('hint');
    expect(
      await run('icons-favicon-missing', {
        html: '<head><link rel="icon" href="/favicon.ico"></head>',
      }),
    ).toEqual([]);
  });

  it('warns when no .ico or .png icon is declared (svg does not count)', async () => {
    const svgOnly = await run('icons-favicon-ico-or-png-missing', {
      html: '<head><link rel="icon" type="image/svg+xml" href="/f.svg"></head>',
    });
    expect(svgOnly[0]?.severity).toBe('warning');
    expect(
      await run('icons-favicon-ico-or-png-missing', {
        html: '<head><link rel="icon" href="/favicon.ico"></head>',
      }),
    ).toEqual([]);
  });

  it('flags a missing 32x32 png icon and passes when present', async () => {
    expect(
      (
        await run('icons-favicon-32-missing', {
          html: '<head><link rel="icon" href="/favicon.ico"></head>',
        })
      )[0]?.severity,
    ).toBe('hint');
    expect(
      await run('icons-favicon-32-missing', {
        html: '<head><link rel="icon" type="image/png" sizes="32x32" href="/f.png"></head>',
      }),
    ).toEqual([]);
  });

  it('flags a missing svg icon and passes when present', async () => {
    expect(
      (
        await run('icons-favicon-svg-missing', {
          html: '<head><link rel="icon" href="/favicon.ico"></head>',
        })
      )[0]?.severity,
    ).toBe('hint');
    expect(
      await run('icons-favicon-svg-missing', {
        html: '<head><link rel="icon" href="/f.svg"></head>',
      }),
    ).toEqual([]);
  });
});

describe('equivalence with the webhint rule functions', () => {
  // A page that trips several HTML-backed rules at once. Running the Lighthouse
  // checks over it (through the `adapt-seo` parser) must yield exactly what the
  // single-source rule functions return for the same HTML parsed directly, so
  // the plugin and the webhint hints can never report different things.
  const html =
    '<html lang="en"><head></head>' +
    '<body><h1>One</h1><h1>Two</h1><p>No icon, no title, no JSON-LD.</p></body></html>';

  it('matches titleMissing for a page with no title', async () => {
    expect(await run('seo-title-missing', { html })).toEqual(
      titleMissing(parse(html)),
    );
  });

  it('matches h1Multiple for a page with two h1s', async () => {
    expect(await run('seo-h1-multiple', { html })).toEqual(
      h1Multiple(parse(html)),
    );
  });

  it('matches structuredDataMissing for a page with no JSON-LD', async () => {
    expect(await run('seo-structured-data-missing', { html })).toEqual(
      structuredDataMissing(parse(html)),
    );
  });

  it('matches faviconSvgMissing for a page with no icon', async () => {
    expect(await run('icons-favicon-svg-missing', { html })).toEqual(
      faviconSvgMissing(parse(html)),
    );
  });
});

describe('the adapt-seo parser on a large, script-heavy page', () => {
  // Guards against the parser-hang class of bug: the old hand-rolled regex
  // scanner could backtrack quadratically on many <script> tags and large
  // inline bodies. The real DOM parser must handle such a page quickly and
  // still return correct findings. The content is sized to be large but to keep
  // the test fast; a regression that reintroduces quadratic scanning blows well
  // past the generous time bound.
  const inlineScript = `<script>${'var x=1;'.repeat(200)}</script>`;
  const bigPage =
    '<html lang="en"><head><title>A properly sized page title</title>' +
    // One valid JSON-LD block the reader must still find among the noise.
    '<script type="application/ld+json">{"@type":"WebPage"}</script>' +
    // Hundreds of ordinary inline scripts with large bodies.
    inlineScript.repeat(300) +
    '</head><body><h1>Heading</h1></body></html>';

  it('parses and runs the HTML-backed checks quickly and correctly', async () => {
    const started = Date.now();

    // The title is present and well-sized: both title rules pass.
    expect(await run('seo-title-missing', { html: bigPage })).toEqual([]);
    expect(await run('seo-title-too-long', { html: bigPage })).toEqual([]);
    // The single <h1> passes the heading rules.
    expect(await run('seo-h1-missing', { html: bigPage })).toEqual([]);
    expect(await run('seo-h1-multiple', { html: bigPage })).toEqual([]);
    // The one valid JSON-LD block is found despite the surrounding scripts.
    expect(await run('seo-structured-data-missing', { html: bigPage })).toEqual(
      [],
    );

    // Parsing this page is near-instant; the bound only needs to catch a
    // quadratic blow-up, so it is deliberately loose.
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

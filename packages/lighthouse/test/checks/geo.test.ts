import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { geoChecks } from '../../src/checks/geo.js';
import type { AuditCheck } from '../../src/checks/types.js';
import {
  readJsonLd,
  type JsonLdDocument,
} from '@mridang/webhint-hint-plumbline/dist/lib/geo/json-ld.js';
import {
  measureContent,
  type ContentDocument,
} from '@mridang/webhint-hint-plumbline/dist/lib/geo/content.js';
import {
  contentExtractionFindings,
  structuredDataInvalidFindings,
} from '@mridang/webhint-hint-plumbline/dist/lib/geo/checks.js';

// The same DOM parser webhint feeds its hints: the equivalence tests build the
// "webhint side" of each check with it, exactly as the hint does.
const require = createRequire(import.meta.url);
// eslint-disable-next-line sonarjs/no-require-or-define -- @hint/utils-dom is CJS-only with no ESM entry point
const { createHTMLDocument } = require('@hint/utils-dom') as {
  createHTMLDocument: (
    html: string,
    url: string,
  ) => JsonLdDocument & ContentDocument;
};

/** Builds the artifact bag a geo check reads: only the served HTML. */
function artifacts(html: string): Artifacts {
  return {
    URL: {
      mainDocumentUrl: 'https://x.test/',
      finalDisplayedUrl: 'https://x.test/',
    },
    MainDocumentContent: html,
  } as Artifacts;
}

/** A geo check reads no computed artifact, but run() still takes a context. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Wraps a parsed object as one JSON-LD block of HTML. */
function jsonLd(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = geoChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

describe('the geo registry', () => {
  it('registers all five geo checks, every one graded', () => {
    expect(geoChecks).toHaveLength(5);
    for (const c of geoChecks) {
      expect(c.id).toBeTruthy();
      expect(c.scoreMode).toBe('numeric');
    }
  });

  it('places every geo check in the seo section', () => {
    for (const c of geoChecks) {
      expect(c.section).toBe('seo');
    }
  });
});

describe('the geo-structured-data-invalid check run()', () => {
  const invalid = check('geo-structured-data-invalid');

  it('errors on a JSON-LD block that does not parse', async () => {
    const findings = await invalid.run(
      artifacts('<script type="application/ld+json">{not json</script>'),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes valid JSON-LD', async () => {
    const findings = await invalid.run(
      artifacts(
        jsonLd({ '@context': 'https://schema.org', '@type': 'WebPage' }),
      ),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('is not applicable when the run captured no document content', async () => {
    expect(await invalid.run(artifacts(''), context())).toBeNull();
  });
});

describe('the geo-faq-schema check run()', () => {
  const faq = check('geo-faq-schema');

  it('warns when no FAQPage node is present', async () => {
    const findings = await faq.run(
      artifacts(jsonLd({ '@type': 'WebPage' })),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('passes when a FAQPage node is present', async () => {
    const findings = await faq.run(
      artifacts(jsonLd({ '@type': 'FAQPage' })),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the geo-speakable-schema check run()', () => {
  const speakable = check('geo-speakable-schema');

  it('warns when no speakable markup is present', async () => {
    const findings = await speakable.run(
      artifacts(jsonLd({ '@type': 'WebPage' })),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('passes when a speakable property is present', async () => {
    const findings = await speakable.run(
      artifacts(
        jsonLd({
          '@type': 'WebPage',
          speakable: { '@type': 'SpeakableSpecification' },
        }),
      ),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the geo-organization-schema check run()', () => {
  const org = check('geo-organization-schema');

  it('warns when no Organization/Person node is present', async () => {
    const findings = await org.run(
      artifacts(jsonLd({ '@type': 'WebPage' })),
      context(),
    );
    expect(findings?.[0]?.message).toContain('No');
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('warns when the entity has no sameAs', async () => {
    const findings = await org.run(
      artifacts(jsonLd({ '@type': 'Organization', name: 'Acme' })),
      context(),
    );
    expect(findings?.[0]?.message).toContain('no sameAs');
  });

  it('passes an Organization node with a sameAs array', async () => {
    const findings = await org.run(
      artifacts(
        jsonLd({
          '@type': 'Organization',
          name: 'Acme',
          sameAs: ['https://x.test/'],
        }),
      ),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the geo-content-extraction check run()', () => {
  const content = check('geo-content-extraction');

  it('warns when the body has no heading or paragraph structure', async () => {
    const findings = await content.run(
      artifacts('<body><div>a short unstructured line</div></body>'),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('warns on an oversized unstructured block', async () => {
    const block = 'x'.repeat(900);
    const findings = await content.run(
      artifacts(`<body><h2>Title</h2><div>${block}</div></body>`),
      context(),
    );
    expect(findings?.[0]?.message).toContain('character block of text');
  });

  it('passes a well-structured body', async () => {
    const findings = await content.run(
      artifacts(
        '<body><h2>Title</h2><p>This is a paragraph with well over thirty characters of text.</p></body>',
      ),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('is not applicable when the run captured no document content', async () => {
    // The `!html` guard returns null before anything is parsed; with content,
    // the real parser always has a body to measure (a fragment gets one), the
    // same document the webhint hint sees.
    expect(await content.run(artifacts(''), context())).toBeNull();
  });
});

/**
 * A page with many `<script>` tags and large inline SVG/JSON. The hand-rolled
 * parser this adapter replaced searched for a raw-text element's closing tag
 * with a non-global RegExp that ignored the cursor, so a second `<script>`
 * rewound the tokenizer onto an earlier `</script>` and it looped forever. A
 * real parser handles exactly this shape in linear time.
 */
function multiScriptPage(): string {
  const blob = 'y'.repeat(2000);
  const inlineJs = `var payload = ${JSON.stringify({ data: 'x'.repeat(5000) })};`;
  const scripts = Array.from(
    { length: 50 },
    (_unused, i) =>
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Thing',
        id: i,
        blob,
      })}</script>` + `<script>${inlineJs}</script>`,
  ).join('');
  const svg = `<svg viewBox="0 0 10 10">${'<path d="M0 0 L10 10"/>'.repeat(1000)}</svg>`;
  return `<!doctype html><html><head>${scripts}</head><body><h1>Title</h1><p>${'This is a real paragraph with plenty of readable text. '.repeat(3)}</p>${svg}</body></html>`;
}

describe('the geo checks on a page with many <script> tags', () => {
  // The guard for the hang that this change removes: these must finish quickly.
  it('counts the JSON-LD blocks without hanging', async () => {
    const html = multiScriptPage();
    const started = Date.now();
    const findings = await check('geo-structured-data-invalid').run(
      artifacts(html),
      context(),
    );
    expect(Date.now() - started).toBeLessThan(5000);
    // All 50 ld+json blocks are valid, so the check reports nothing; the
    // interleaved executable <script> tags are not counted.
    expect(findings).toEqual([]);
    const blocks = readJsonLd(createHTMLDocument(html, 'https://x.test/'));
    expect(blocks.total).toBe(50);
    expect(blocks.invalid).toBe(0);
  });

  it('measures the content without hanging', async () => {
    const html = multiScriptPage();
    const started = Date.now();
    const findings = await check('geo-content-extraction').run(
      artifacts(html),
      context(),
    );
    expect(Date.now() - started).toBeLessThan(5000);
    // A heading and a long paragraph make the body well structured; the inline
    // SVG is not a text <div>, so it raises no unstructured-block warning.
    expect(findings).toEqual([]);
  });
});

describe('the geo checks match the webhint hint for a fixture', () => {
  // The two surfaces call the same shared checks on the same parsed document,
  // so the Lighthouse findings must equal the webhint-side findings exactly.
  const fixture =
    '<!doctype html><html><head>' +
    '<script type="application/ld+json">{ not json</script>' +
    '</head><body><div>' +
    'z'.repeat(900) +
    '</div></body></html>';

  it('structured-data-invalid yields the hint findings', async () => {
    const doc = createHTMLDocument(fixture, 'https://x.test/');
    const hintFindings = structuredDataInvalidFindings(readJsonLd(doc));
    const lhFindings = await check('geo-structured-data-invalid').run(
      artifacts(fixture),
      context(),
    );
    expect(lhFindings).toEqual(hintFindings);
    expect(hintFindings).toHaveLength(1);
  });

  it('content-extraction yields the hint findings', async () => {
    const doc = createHTMLDocument(fixture, 'https://x.test/');
    const stats = measureContent(doc);
    const hintFindings = stats ? contentExtractionFindings(stats) : null;
    const lhFindings = await check('geo-content-extraction').run(
      artifacts(fixture),
      context(),
    );
    expect(lhFindings).toEqual(hintFindings);
  });
});

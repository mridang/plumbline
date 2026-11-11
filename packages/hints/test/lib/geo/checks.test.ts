import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import {
  contentExtractionFindings,
  faqSchemaFindings,
  organizationSchemaFindings,
  speakableSchemaFindings,
  structuredDataInvalidFindings,
} from '../../../src/lib/geo/checks.js';
import {
  readJsonLd,
  type JsonLdDocument,
} from '../../../src/lib/geo/json-ld.js';
import {
  measureContent,
  type ContentDocument,
  type ContentStats,
} from '../../../src/lib/geo/content.js';

// Build the shared checks' inputs from a real parse, the way both the webhint
// hint and the Lighthouse check do, rather than hand-rolling the shapes.
const require = createRequire(import.meta.url);
// eslint-disable-next-line sonarjs/no-require-or-define -- @hint/utils-dom is CommonJS only, loaded through createRequire
const { createHTMLDocument } = require('@hint/utils-dom') as {
  createHTMLDocument: (
    html: string,
    url: string,
  ) => JsonLdDocument & ContentDocument;
};

const blocksOf = (html: string) =>
  // eslint-disable-next-line unicorn/prefer-https -- test fixture
  readJsonLd(createHTMLDocument(html, 'http://x.test/'));
const statsOf = (html: string): ContentStats | null =>
  // eslint-disable-next-line unicorn/prefer-https -- test fixture
  measureContent(createHTMLDocument(html, 'http://x.test/'));

/** Wraps a parsed object as one JSON-LD block of HTML. */
const jsonLd = (value: unknown): string =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

describe('structuredDataInvalidFindings', () => {
  it('is empty when every block parses', () => {
    expect(
      structuredDataInvalidFindings(blocksOf(jsonLd({ '@type': 'WebPage' }))),
    ).toEqual([]);
  });
  it('is empty when there are no JSON-LD blocks', () => {
    expect(structuredDataInvalidFindings(blocksOf('<p>hi</p>'))).toEqual([]);
  });
  it('errors, counting the blocks, when one does not parse', () => {
    const [f] = structuredDataInvalidFindings(
      blocksOf(
        '<script type="application/ld+json">{ bad</script>' +
          jsonLd({ '@type': 'WebPage' }),
      ),
    );
    expect(f.severity).toBe('error');
    expect(f.message).toContain('1 of 2 JSON-LD block(s) contain invalid JSON');
    expect(f.message).toContain(
      'Read more: https://github.com/RudrenduPaul/LLMScout',
    );
  });
});

describe('faqSchemaFindings', () => {
  it('is empty when a FAQPage node is present', () => {
    expect(faqSchemaFindings(blocksOf(jsonLd({ '@type': 'FAQPage' })))).toEqual(
      [],
    );
  });
  it('warns when no FAQPage node is present', () => {
    const [f] = faqSchemaFindings(blocksOf(jsonLd({ '@type': 'WebPage' })));
    expect(f.severity).toBe('warning');
    expect(f.message).toContain('No FAQPage structured data found');
  });
});

describe('speakableSchemaFindings', () => {
  it('is empty when a speakable property is present', () => {
    expect(
      speakableSchemaFindings(
        blocksOf(
          jsonLd({
            '@type': 'WebPage',
            speakable: { '@type': 'SpeakableSpecification' },
          }),
        ),
      ),
    ).toEqual([]);
  });
  it('warns when no speakable markup is present', () => {
    const [f] = speakableSchemaFindings(
      blocksOf(jsonLd({ '@type': 'WebPage' })),
    );
    expect(f.message).toContain('No Speakable structured data found');
  });
});

describe('organizationSchemaFindings', () => {
  it('is empty for an entity with a non-empty sameAs', () => {
    expect(
      organizationSchemaFindings(
        blocksOf(
          jsonLd({
            '@type': 'Organization',
            name: 'Acme',
            sameAs: ['https://x.test/'],
          }),
        ),
      ),
    ).toEqual([]);
  });
  it('warns when there is no entity node', () => {
    const [f] = organizationSchemaFindings(
      blocksOf(jsonLd({ '@type': 'WebPage' })),
    );
    expect(f.message).toContain(
      'No Organization/Corporation/LocalBusiness/Person',
    );
  });
  it('warns when the entity has no sameAs', () => {
    const [f] = organizationSchemaFindings(
      blocksOf(jsonLd({ '@type': 'Organization', name: 'Acme' })),
    );
    expect(f.message).toContain('has no sameAs property');
  });
});

describe('contentExtractionFindings', () => {
  const findings = (html: string) => {
    const stats = statsOf(html);
    return stats ? contentExtractionFindings(stats) : null;
  };

  it('is empty for a well-structured body', () => {
    expect(
      findings(
        '<body><h2>Title</h2><p>This is a paragraph well over thirty characters long.</p></body>',
      ),
    ).toEqual([]);
  });
  it('warns when there is no heading or paragraph structure', () => {
    const [f] =
      findings('<body><div>short unstructured line</div></body>') ?? [];
    expect(f.message).toContain('No headings or paragraph-level structure');
  });
  it('warns on an oversized unstructured block', () => {
    const block = 'z'.repeat(900);
    const [f] =
      findings(`<body><h2>Title</h2><div>${block}</div></body>`) ?? [];
    expect(f.message).toContain('900-character block of text');
  });
});

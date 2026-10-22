import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { technicalChecks } from '../../src/checks/technical.js';
import type { AuditCheck } from '../../src/checks/types.js';
import {
  altCoverage,
  firstSkippedLevel,
  headingLevels,
  type TechDocumentLike,
} from '@mridang/webhint-hint-extra/dist/lib/technical/read.js';
import {
  headingHierarchyFindings,
  imageAltCoverageFindings,
} from '@mridang/webhint-hint-extra/dist/lib/technical/checks.js';

// The same DOM parser webhint feeds its hints: the equivalence tests build the
// "webhint side" of each check with it, exactly as the hint does.
const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom') as {
  createHTMLDocument: (html: string, url: string) => TechDocumentLike;
};

/** One resource (besides the main document) to seed into the devtools log. */
interface Resource {
  url: string;
  type: string;
  status: number;
  headers: Record<string, string>;
}

/**
 * Builds a devtools log Lighthouse's `NetworkRecords` computed artifact can
 * reconstruct: one main-document response (200) plus any extra resources. This
 * is the only seam the redirect and image-weight checks read through, so a
 * synthetic log exercises their `run()` without a browser.
 */
function devtoolsLog(
  mainUrl: string,
  resources: readonly Resource[] = [],
): LH.Artifacts['DevtoolsLog'] {
  const requestEvents = (
    id: string,
    url: string,
    type: string,
    status: number,
    headers: Record<string, string>,
  ) => [
    {
      method: 'Network.requestWillBeSent',
      params: {
        requestId: id,
        loaderId: 'LOADER',
        documentURL: mainUrl,
        request: { url, method: 'GET' },
        timestamp: 1,
        wallTime: 1,
        initiator: { type: 'other' },
        type,
      },
    },
    {
      method: 'Network.responseReceived',
      params: {
        requestId: id,
        loaderId: 'LOADER',
        timestamp: 2,
        type,
        response: {
          url,
          status,
          statusText: 'OK',
          headers,
          mimeType: type === 'Document' ? 'text/html' : 'image/png',
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
      params: { requestId: id, timestamp: 3, encodedDataLength: 100 },
    },
  ];

  const events = [
    ...requestEvents('0', mainUrl, 'Document', 200, {}),
    ...resources.flatMap((resource, index) =>
      requestEvents(
        String(index + 1),
        resource.url,
        resource.type,
        resource.status,
        resource.headers,
      ),
    ),
  ];
  return events as unknown as LH.Artifacts['DevtoolsLog'];
}

/** Builds the artifact bag a technical check reads, over the given fields. */
function artifacts(fields: Partial<LH.Artifacts>): LH.Artifacts {
  return {
    URL: {
      mainDocumentUrl: 'https://x.test/',
      finalDisplayedUrl: 'https://x.test/',
    },
    MainDocumentContent: '',
    MetaElements: [],
    LinkElements: [],
    ImageElements: [],
    ...fields,
  } as unknown as LH.Artifacts;
}

/** A fresh audit context; the empty cache makes NetworkRecords recompute. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = technicalChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

describe('the technical registry', () => {
  it('registers all seven technical checks, every one graded', () => {
    expect(technicalChecks).toHaveLength(7);
    for (const c of technicalChecks) {
      expect(c.id).toBeTruthy();
      expect(c.scoreMode).toBe('numeric');
    }
  });

  it('places each check in the section its hint declares', () => {
    const sections = Object.fromEntries(
      technicalChecks.map((c) => [c.id, c.section]),
    );
    expect(sections['technical-heading-hierarchy']).toBe('search');
    expect(sections['technical-image-alt-coverage']).toBe('search');
    expect(sections['technical-robots-meta-advanced']).toBe('search');
    expect(sections['technical-canonical-invalid']).toBe('search');
    expect(sections['technical-redirect-chain']).toBe('search');
    expect(sections['technical-image-weight']).toBe('search');
    // The twitter-card check lands in social-previews per the taxonomy.
    expect(sections['technical-twitter-card-type']).toBe('social-previews');
  });
});

describe('the technical-heading-hierarchy check run()', () => {
  const headings = check('technical-heading-hierarchy');

  it('warns when a heading level is skipped', async () => {
    const findings = await headings.run(
      artifacts({ MainDocumentContent: '<h1>a</h1><h3>b</h3>' }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('passes a well-ordered heading outline', async () => {
    const findings = await headings.run(
      artifacts({ MainDocumentContent: '<h1>a</h1><h2>b</h2><h3>c</h3>' }),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('is not applicable when the run captured no document content', async () => {
    expect(
      await headings.run(artifacts({ MainDocumentContent: '' }), context()),
    ).toBeNull();
  });
});

describe('the technical-image-alt-coverage check run()', () => {
  const alt = check('technical-image-alt-coverage');

  it('errors when coverage falls below the threshold', async () => {
    const findings = await alt.run(
      artifacts({ MainDocumentContent: '<img src=a><img src=b alt="x">' }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes when every image has an alt attribute', async () => {
    const findings = await alt.run(
      artifacts({
        MainDocumentContent: '<img src=a alt=""><img src=b alt="x">',
      }),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the technical-robots-meta-advanced check run()', () => {
  const robots = check('technical-robots-meta-advanced');

  it('warns when the robots meta tag is absent', async () => {
    const findings = await robots.run(
      artifacts({ MetaElements: [] }),
      context(),
    );
    expect(findings?.[0]?.message).toContain('No meta robots directives found');
  });

  it('warns when the advanced directives are missing', async () => {
    const findings = await robots.run(
      artifacts({
        MetaElements: [{ name: 'robots', content: 'index, follow' }],
      } as Partial<LH.Artifacts>),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('passes when all advanced directives are present', async () => {
    const findings = await robots.run(
      artifacts({
        MetaElements: [
          {
            name: 'robots',
            content:
              'max-snippet:-1, max-image-preview:large, max-video-preview:-1',
          },
        ],
      } as Partial<LH.Artifacts>),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('skips a noindex page', async () => {
    const findings = await robots.run(
      artifacts({
        MetaElements: [{ name: 'robots', content: 'noindex' }],
      } as Partial<LH.Artifacts>),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the technical-twitter-card-type check run()', () => {
  const twitter = check('technical-twitter-card-type');

  it('errors on an unrecognised card type', async () => {
    const findings = await twitter.run(
      artifacts({
        MetaElements: [{ name: 'twitter:card', content: 'bogus' }],
      } as Partial<LH.Artifacts>),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes a recognised card type', async () => {
    const findings = await twitter.run(
      artifacts({
        MetaElements: [
          { name: 'twitter:card', content: 'summary_large_image' },
        ],
      } as Partial<LH.Artifacts>),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the technical-canonical-invalid check run()', () => {
  const canonical = check('technical-canonical-invalid');

  it('errors when the canonical href is not a URL', async () => {
    const findings = await canonical.run(
      artifacts({
        LinkElements: [{ rel: 'canonical', href: null, hrefRaw: 'http://' }],
      } as unknown as Partial<LH.Artifacts>),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes a valid canonical href', async () => {
    const findings = await canonical.run(
      artifacts({
        LinkElements: [
          {
            rel: 'canonical',
            href: 'https://x.test/',
            hrefRaw: 'https://x.test/',
          },
        ],
      } as unknown as Partial<LH.Artifacts>),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the technical-redirect-chain check run()', () => {
  const redirect = check('technical-redirect-chain');

  it('passes when the document loaded without a redirect', async () => {
    const findings = await redirect.run(
      artifacts({ DevtoolsLog: devtoolsLog('https://x.test/') }),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('is not applicable when the run captured no document', async () => {
    const findings = await redirect.run(
      artifacts({ DevtoolsLog: [] as unknown as LH.Artifacts['DevtoolsLog'] }),
      context(),
    );
    expect(findings).toBeNull();
  });
});

describe('the technical-image-weight check run()', () => {
  const weight = check('technical-image-weight');

  it('errors on an image over 500 KB', async () => {
    const url = 'https://x.test/huge.png';
    const findings = await weight.run(
      artifacts({
        ImageElements: [
          { src: url },
        ] as unknown as LH.Artifacts['ImageElements'],
        DevtoolsLog: devtoolsLog('https://x.test/', [
          {
            url,
            type: 'Image',
            status: 200,
            headers: { 'content-length': '600000' },
          },
        ]),
      }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes a light image', async () => {
    const url = 'https://x.test/small.png';
    const findings = await weight.run(
      artifacts({
        ImageElements: [
          { src: url },
        ] as unknown as LH.Artifacts['ImageElements'],
        DevtoolsLog: devtoolsLog('https://x.test/', [
          {
            url,
            type: 'Image',
            status: 200,
            headers: { 'content-length': '1024' },
          },
        ]),
      }),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

/**
 * A page with many `<script>` tags and large inline JSON, plus the images and
 * headings the technical parser reads. The hand-rolled tag reader this adapter
 * replaced could rewind onto an earlier tag and loop forever on a page with
 * several `<script>` blocks; a real parser handles it in linear time.
 */
function multiScriptPage(): string {
  const inlineJs = `var payload = ${JSON.stringify({ data: 'x'.repeat(5000) })};`;
  const scripts = Array.from(
    { length: 50 },
    () => `<script>${inlineJs}</script>`,
  ).join('');
  // Ten images, two of them missing their alt attribute (80% coverage).
  const images = Array.from({ length: 10 }, (_unused, i) =>
    i < 8
      ? `<img src="/i${i}.png" alt="image ${i}">`
      : `<img src="/i${i}.png">`,
  ).join('');
  return `<!doctype html><html><head>${scripts}</head><body><h1>Title</h1><h2>Section</h2>${images}</body></html>`;
}

describe('the technical checks on a page with many <script> tags', () => {
  // The guard for the hang that this change removes: these must finish quickly.
  it('reads the heading outline without hanging', async () => {
    const html = multiScriptPage();
    const started = Date.now();
    const findings = await check('technical-heading-hierarchy').run(
      artifacts({ MainDocumentContent: html }),
      context(),
    );
    expect(Date.now() - started).toBeLessThan(5000);
    // h1 then h2 is a well-ordered outline, so nothing is reported.
    expect(findings).toEqual([]);
    expect(headingLevels(createHTMLDocument(html, 'https://x.test/'))).toEqual([
      1, 2,
    ]);
  });

  it('reads image alt coverage without hanging', async () => {
    const html = multiScriptPage();
    const started = Date.now();
    const findings = await check('technical-image-alt-coverage').run(
      artifacts({ MainDocumentContent: html }),
      context(),
    );
    expect(Date.now() - started).toBeLessThan(5000);
    // Two of ten images lack alt: 80% coverage is at the warn threshold.
    expect(findings?.[0]?.severity).toBe('warning');
    expect(findings?.[0]?.message).toContain('2 of 10');
  });
});

describe('the technical checks match the webhint hint for a fixture', () => {
  // The two surfaces call the same shared checks on the same parsed document,
  // so the Lighthouse findings must equal the webhint-side findings exactly.
  it('heading-hierarchy yields the hint findings', async () => {
    const html = '<h1>a</h1><h3>b</h3>';
    const doc = createHTMLDocument(html, 'https://x.test/');
    const hintFindings = headingHierarchyFindings(
      firstSkippedLevel(headingLevels(doc)),
    );
    const lhFindings = await check('technical-heading-hierarchy').run(
      artifacts({ MainDocumentContent: html }),
      context(),
    );
    expect(lhFindings).toEqual(hintFindings);
    expect(hintFindings).toHaveLength(1);
  });

  it('image-alt-coverage yields the hint findings', async () => {
    const html = '<img src=a><img src=b alt="x">';
    const doc = createHTMLDocument(html, 'https://x.test/');
    const hintFindings = imageAltCoverageFindings(altCoverage(doc));
    const lhFindings = await check('technical-image-alt-coverage').run(
      artifacts({ MainDocumentContent: html }),
      context(),
    );
    expect(lhFindings).toEqual(hintFindings);
    expect(hintFindings).toHaveLength(1);
  });
});

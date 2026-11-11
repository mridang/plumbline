import { describe, expect, it } from '@jest/globals';
import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { privacyChecks } from '../../src/checks/privacy.js';
import type { AuditCheck } from '../../src/checks/types.js';
import { HTTP_SCHEME } from '../helpers/data.js';

/** One request to synthesise into the devtools log. */
interface RequestSpec {
  url: string;
  /** Lighthouse `RESOURCE_TYPES` value, e.g. `Document`, `Script`, `Image`. */
  type: string;
  headers?: Record<string, string>;
}

/**
 * Builds the minimal devtools log Lighthouse's `NetworkRecords` computed
 * artifact needs to reconstruct the given requests (the first is the main
 * document). This is the only seam the privacy checks read through, so a
 * synthetic log exercises `run()` without a browser, as in headers.test.ts.
 */
function devtoolsLog(
  requests: readonly RequestSpec[],
): Artifacts['DevtoolsLog'] {
  const events = requests.flatMap((request, index) => {
    const requestId = String(index + 1);
    return [
      {
        method: 'Network.requestWillBeSent',
        params: {
          requestId,
          loaderId: 'LOADER',
          documentURL: requests[0]?.url ?? request.url,
          request: { url: request.url, method: 'GET' },
          timestamp: index + 1,
          wallTime: index + 1,
          initiator: { type: 'other' },
          type: request.type,
        },
      },
      {
        method: 'Network.responseReceived',
        params: {
          requestId,
          loaderId: 'LOADER',
          timestamp: index + 1,
          type: request.type,
          response: {
            url: request.url,
            status: 200,
            statusText: 'OK',
            headers: request.headers ?? {},
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
        params: { requestId, timestamp: index + 1, encodedDataLength: 100 },
      },
    ];
  });
  return events as unknown as Artifacts['DevtoolsLog'];
}

/** Builds the artifacts a privacy check reads over the given requests. */
function artifacts(requests: readonly RequestSpec[]): Artifacts {
  const pageUrl = requests[0]?.url ?? '';
  return {
    DevtoolsLog: devtoolsLog(requests),
    URL: { mainDocumentUrl: pageUrl, finalDisplayedUrl: pageUrl },
  } as unknown as Artifacts;
}

/** A fresh audit context; the empty cache makes NetworkRecords recompute. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = privacyChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

/** The main document request, served over https with optional headers. */
function doc(headers?: Record<string, string>): RequestSpec {
  return { url: 'https://x.test/', type: 'Document', headers };
}

describe('the privacy registry', () => {
  it('registers all four privacy checks with their taxonomy section', () => {
    expect(privacyChecks).toHaveLength(4);
    for (const c of privacyChecks) {
      expect(c.id).toBeTruthy();
      expect(c.requiredArtifacts).toEqual(['DevtoolsLog', 'URL']);
    }
    // Sections follow `src/core/taxonomy.ts` PLACEMENT: the cookie and
    // third-party inventories sit under privacy, while mixed content
    // and insecure first-party requests are TLS concerns (https).
    const sections = Object.fromEntries(
      privacyChecks.map((c) => [c.id, c.section]),
    );
    expect(sections).toEqual({
      'privacy-cookies': 'privacy',
      'privacy-third-party-requests': 'privacy',
      'privacy-mixed-content': 'https',
      'privacy-insecure-first-party': 'https',
    });
  });

  it('scores the security checks and leaves the inventories informative', () => {
    const informative = privacyChecks
      .filter((c) => c.scoreMode === 'informative')
      .map((c) => c.id)
      .toSorted((a, b) => a.localeCompare(b));
    expect(informative).toEqual([
      'privacy-cookies',
      'privacy-third-party-requests',
    ]);
    const numeric = privacyChecks
      .filter((c) => c.scoreMode === 'numeric')
      .map((c) => c.id)
      .toSorted((a, b) => a.localeCompare(b));
    expect(numeric).toEqual([
      'privacy-insecure-first-party',
      'privacy-mixed-content',
    ]);
  });

  it('is not applicable when the run captured no document', async () => {
    const empty = {
      DevtoolsLog: [] as unknown as Artifacts['DevtoolsLog'],
      URL: { mainDocumentUrl: '', finalDisplayedUrl: '' },
    } as unknown as Artifacts;
    for (const c of privacyChecks) {
      expect(await c.run(empty, context())).toBeNull();
    }
  });
});

describe('the privacy-cookies check run()', () => {
  const cookies = check('privacy-cookies');

  it('warns and lists the domains when a third-party cookie is set', async () => {
    const findings = await cookies.run(
      artifacts([
        doc({ 'set-cookie': 'id=1; Domain=x.test' }),
        {
          url: 'https://cdn.other.test/a.js',
          type: 'Script',
          headers: { 'set-cookie': 't=2' },
        },
      ]),
      context(),
    );
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.severity).toBe('warning');
    expect(findings?.[0]?.message).toContain(
      '1 first-party and 1 third-party cookies were set',
    );
    expect(findings?.[0]?.message).toContain('cdn.other.test');
  });

  it('is a hint when only first-party cookies are set', async () => {
    const findings = await cookies.run(
      artifacts([doc({ 'set-cookie': 'id=1; Domain=x.test' })]),
      context(),
    );
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.severity).toBe('hint');
  });

  it('reports nothing when no cookies are set', async () => {
    const findings = await cookies.run(artifacts([doc()]), context());
    expect(findings).toEqual([]);
  });
});

describe('the privacy-third-party-requests check run()', () => {
  const thirdParty = check('privacy-third-party-requests');

  it('lists the third-party hosts and is a hint when all are secure', async () => {
    const findings = await thirdParty.run(
      artifacts([
        doc(),
        { url: 'https://cdn.other.test/a.js', type: 'Script' },
        { url: 'https://x.test/self.js', type: 'Script' },
      ]),
      context(),
    );
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.severity).toBe('hint');
    expect(findings?.[0]?.message).toContain('1 third-party request');
    expect(findings?.[0]?.message).toContain('cdn.other.test');
  });

  it('warns when a third-party request is insecure', async () => {
    const findings = await thirdParty.run(
      artifacts([
        doc(),
        { url: `${HTTP_SCHEME}cdn.other.test/a.js`, type: 'Script' },
      ]),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('warning');
    expect(findings?.[0]?.message).toContain('0 secure, 1 insecure');
  });

  it('reports nothing when every request is first party', async () => {
    const findings = await thirdParty.run(
      artifacts([doc(), { url: 'https://x.test/self.js', type: 'Script' }]),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the privacy-mixed-content check run()', () => {
  const mixed = check('privacy-mixed-content');

  it('errors on active and warns on passive insecure subresources', async () => {
    const findings = await mixed.run(
      artifacts([
        doc(),
        { url: `${HTTP_SCHEME}x.test/a.js`, type: 'Script' },
        { url: `${HTTP_SCHEME}x.test/a.png`, type: 'Image' },
      ]),
      context(),
    );
    const bySeverity = Object.fromEntries(
      (findings ?? []).map((f) => [f.severity, f.message]),
    );
    expect(bySeverity.error).toContain('active mixed content');
    expect(bySeverity.warning).toContain('passive mixed content');
  });

  it('reports nothing when the page itself is http', async () => {
    const findings = await mixed.run(
      artifacts([
        { url: `${HTTP_SCHEME}x.test/`, type: 'Document' },
        { url: `${HTTP_SCHEME}x.test/a.js`, type: 'Script' },
      ]),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the privacy-insecure-first-party check run()', () => {
  const insecure = check('privacy-insecure-first-party');

  it('errors on a plain-http request to the page’s own domain', async () => {
    const findings = await insecure.run(
      artifacts([doc(), { url: `${HTTP_SCHEME}x.test/a.js`, type: 'Script' }]),
      context(),
    );
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.severity).toBe('error');
    expect(findings?.[0]?.message).toContain(`${HTTP_SCHEME}x.test/a.js`);
  });

  it('reports nothing when first-party requests use https', async () => {
    const findings = await insecure.run(
      artifacts([doc(), { url: 'https://x.test/a.js', type: 'Script' }]),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

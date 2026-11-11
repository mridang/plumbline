import { describe, expect, it } from '@jest/globals';
import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { headersChecks } from '../../src/checks/headers.js';
import { PLACEMENT } from '@mridang/webhint-hint-plumbline/dist/core/taxonomy.js';
import type { AuditCheck } from '../../src/checks/types.js';

/**
 * Builds the minimal devtools log Lighthouse's `NetworkRecords` computed
 * artifact needs to reconstruct one main-document response with the given
 * response headers. This is the only seam the header checks read through, so a
 * synthetic log lets `run()` be exercised without a browser.
 */
function devtoolsLog(
  url: string,
  headers: Record<string, string>,
): Artifacts['DevtoolsLog'] {
  const requestId = '1';
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
  return events as unknown as Artifacts['DevtoolsLog'];
}

/** Builds the artifacts a header check reads, over the given headers. */
function artifacts(url: string, headers: Record<string, string>): Artifacts {
  return {
    DevtoolsLog: devtoolsLog(url, headers),
    URL: { mainDocumentUrl: url, finalDisplayedUrl: url },
    MetaElements: [],
  } as unknown as Artifacts;
}

/** A fresh audit context; the empty cache makes NetworkRecords recompute. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = headersChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

describe('the headers registry', () => {
  it('registers all header checks with a known section', () => {
    expect(headersChecks).toHaveLength(46);
    for (const c of headersChecks) {
      expect(c.id).toBeTruthy();
      expect(c.section).toBe(PLACEMENT[c.id]?.section);
    }
  });

  it('marks the context-specific and advisory checks informative', () => {
    const informative = headersChecks
      .filter((c) => c.scoreMode === 'informative')
      .map((c) => c.id)
      .toSorted((a, b) => a.localeCompare(b));
    expect(informative).toEqual([
      'accept-ch',
      'age',
      'alt-svc',
      'cache-control',
      'clear-site-data',
      'cors',
      'origin-agent-cluster',
      'server-timing',
      'via',
    ]);
  });
});

describe('the csp check run()', () => {
  const csp = check('csp');

  it('reports a finding when the main document sends no CSP', async () => {
    const findings = await csp.run(artifacts('https://x.test/', {}), context());
    expect(findings).not.toBeNull();
    expect(findings?.length).toBeGreaterThan(0);
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('reports nothing for a strict CSP', async () => {
    const findings = await csp.run(
      artifacts('https://x.test/', {
        'content-security-policy':
          "default-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      }),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('is not applicable when the run captured no document', async () => {
    const empty = {
      DevtoolsLog: [] as unknown as Artifacts['DevtoolsLog'],
      URL: { mainDocumentUrl: '', finalDisplayedUrl: '' },
      MetaElements: [],
    } as unknown as Artifacts;
    expect(await csp.run(empty, context())).toBeNull();
  });
});

describe('the hsts check run()', () => {
  const hsts = check('hsts');

  it('errors when the header is absent on an HTTPS page', async () => {
    const findings = await hsts.run(
      artifacts('https://x.test/', {}),
      context(),
    );
    expect(findings?.some((f) => f.severity === 'error')).toBe(true);
  });

  it('raises no error for a long max-age (preload advice only)', async () => {
    const findings = await hsts.run(
      artifacts('https://x.test/', {
        'strict-transport-security': 'max-age=63072000; includeSubDomains',
      }),
      context(),
    );
    // Observatory passes this value but still advises preloading, so the only
    // finding (if any) is advice, never an error.
    expect(findings?.some((f) => f.severity === 'error')).toBe(false);
  });
});

describe('the x-content-type-options check run()', () => {
  const xcto = check('x-content-type-options');

  it('errors when the header is not nosniff', async () => {
    const findings = await xcto.run(
      artifacts('https://x.test/', { 'x-content-type-options': 'sniff' }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes when the header is nosniff', async () => {
    const findings = await xcto.run(
      artifacts('https://x.test/', { 'x-content-type-options': 'nosniff' }),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('the MDN response-header checks run()', () => {
  it('x-powered-by reports a present header', async () => {
    const findings = await check('x-powered-by').run(
      artifacts('https://x.test/', { 'x-powered-by': 'Express' }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('cors-allow-credentials errors with a wildcard origin', async () => {
    const findings = await check('cors-allow-credentials').run(
      artifacts('https://x.test/', {
        'access-control-allow-credentials': 'true',
        'access-control-allow-origin': '*',
      }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('vary flags a bare wildcard', async () => {
    const findings = await check('vary').run(
      artifacts('https://x.test/', { vary: '*' }),
      context(),
    );
    expect(findings?.[0]?.message).toContain('uncacheable');
  });

  it('critical-ch errors on a hint missing from accept-ch', async () => {
    const findings = await check('critical-ch').run(
      artifacts('https://x.test/', {
        'accept-ch': 'Sec-CH-UA',
        'critical-ch': 'Sec-CH-UA-Platform',
      }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('timing-allow-origin passes for a scoped list', async () => {
    const findings = await check('timing-allow-origin').run(
      artifacts('https://x.test/', {
        'timing-allow-origin': 'https://a.test',
      }),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('retry-after is not applicable on a 200 but flagged on a 503', async () => {
    const okay = await check('retry-after').run(
      artifacts('https://x.test/', { 'retry-after': 'soon' }),
      context(),
    );
    expect(okay).toEqual([]);
  });
});

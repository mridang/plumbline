import { describe, expect, it } from '@jest/globals';
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { secplusChecks } from '../../src/checks/secplus.js';
import type { AuditCheck } from '../../src/checks/types.js';

/**
 * Builds the minimal devtools log Lighthouse's `NetworkRecords` computed
 * artifact needs to reconstruct one main-document response with the given
 * response headers, so the header checks run without a browser.
 */
function devtoolsLog(
  url: string,
  headers: Record<string, string>,
): LH.Artifacts['DevtoolsLog'] {
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
  return events as unknown as LH.Artifacts['DevtoolsLog'];
}

/** Header-check artifacts over the given response headers. */
function headerArtifacts(
  url: string,
  headers: Record<string, string>,
): LH.Artifacts {
  return {
    DevtoolsLog: devtoolsLog(url, headers),
    URL: { mainDocumentUrl: url, finalDisplayedUrl: url },
    MetaElements: [],
  } as unknown as LH.Artifacts;
}

/** DOM-check artifacts over the given HTML and page URL. */
function domArtifacts(url: string, html: string): LH.Artifacts {
  return {
    MainDocumentContent: html,
    URL: { mainDocumentUrl: url, finalDisplayedUrl: url },
  } as unknown as LH.Artifacts;
}

/** A fresh audit context; the empty cache makes NetworkRecords recompute. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = secplusChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

describe('the secplus registry', () => {
  it('registers the four plugin-able checks with a known section', () => {
    expect(secplusChecks).toHaveLength(4);
    for (const c of secplusChecks) {
      expect(c.id).toBeTruthy();
      expect(c.section).toBe('site-protection');
      expect(c.title).toBeTruthy();
    }
  });

  it('does not register the webhint-only http-methods check', () => {
    expect(secplusChecks.some((c) => c.id === 'http-methods')).toBe(false);
  });
});

describe('tabnabbing check', () => {
  it('flags a cross-origin _blank link without rel=noopener', async () => {
    const findings = await check('tabnabbing').run(
      domArtifacts(
        'https://x.test/',
        '<a target="_blank" href="https://evil.test/">go</a>',
      ),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes a safe page', async () => {
    const findings = await check('tabnabbing').run(
      domArtifacts('https://x.test/', '<a href="/local">go</a>'),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('csp-strength check', () => {
  it('flags a missing object-src', async () => {
    const findings = await check('csp-strength').run(
      headerArtifacts('https://x.test/', {
        'content-security-policy': "script-src 'self'; base-uri 'none'",
      }),
      context(),
    );
    expect(findings?.some((f) => f.message.includes('object-src'))).toBe(true);
  });

  it('passes a strict policy', async () => {
    const findings = await check('csp-strength').run(
      headerArtifacts('https://x.test/', {
        'content-security-policy':
          "script-src 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'",
      }),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('cookie-prefixes check', () => {
  it('flags a __Host- cookie without Secure', async () => {
    const findings = await check('cookie-prefixes').run(
      headerArtifacts('https://x.test/', {
        'set-cookie': '__Host-id=abc; Path=/',
      }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes a correct cookie', async () => {
    const findings = await check('cookie-prefixes').run(
      headerArtifacts('https://x.test/', {
        'set-cookie': '__Host-id=abc; Secure; Path=/',
      }),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

describe('form-action-secure check', () => {
  it('flags an http form action on an https page', async () => {
    const findings = await check('form-action-secure').run(
      domArtifacts(
        'https://x.test/',
        '<form action="http://x.test/submit"></form>',
      ),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('error');
  });

  it('passes a relative form action', async () => {
    const findings = await check('form-action-secure').run(
      domArtifacts('https://x.test/', '<form action="/submit"></form>'),
      context(),
    );
    expect(findings).toEqual([]);
  });
});

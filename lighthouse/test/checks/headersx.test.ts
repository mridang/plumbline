import { describe, expect, it } from '@jest/globals';
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { headersxChecks } from '../../src/checks/headersx.js';
import type { AuditCheck } from '../../src/checks/types.js';

/**
 * Builds the minimal devtools log Lighthouse's `NetworkRecords` computed
 * artifact needs to reconstruct one main-document response with the given
 * headers, so each check's `run()` can be exercised without a browser.
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

function artifacts(url: string, headers: Record<string, string>): LH.Artifacts {
  return {
    DevtoolsLog: devtoolsLog(url, headers),
    URL: { mainDocumentUrl: url, finalDisplayedUrl: url },
    MetaElements: [],
  } as unknown as LH.Artifacts;
}

function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

function check(id: string): AuditCheck {
  const found = headersxChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

describe('the headersx registry', () => {
  it('registers all eleven checks with a known section', () => {
    expect(headersxChecks).toHaveLength(11);
    for (const c of headersxChecks) {
      expect(c.id).toBeTruthy();
      expect(['site-protection', 'visitor-privacy']).toContain(c.section);
    }
  });

  it('marks the Privacy Sandbox checks informative', () => {
    const informative = headersxChecks
      .filter((c) => c.scoreMode === 'informative')
      .map((c) => c.id)
      .sort();
    expect(informative).toEqual([
      'attribution-reporting',
      'observe-browsing-topics',
    ]);
  });
});

describe('the set-login check run()', () => {
  const setLogin = check('set-login');

  it('passes for a valid status', async () => {
    const findings = await setLogin.run(
      artifacts('https://x.test/', { 'set-login': 'logged-in' }),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('warns on an invalid status', async () => {
    const findings = await setLogin.run(
      artifacts('https://x.test/', { 'set-login': 'maybe' }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('warning');
  });

  it('is not applicable when the document is missing', async () => {
    const findings = await setLogin.run(
      { DevtoolsLog: [], URL: {} } as unknown as LH.Artifacts,
      context(),
    );
    expect(findings).toBeNull();
  });
});

describe('the content-digest check run()', () => {
  it('warns on a malformed digest', async () => {
    const findings = await check('content-digest').run(
      artifacts('https://x.test/', { 'content-digest': 'sha-256=abc' }),
      context(),
    );
    expect(findings?.[0]?.severity).toBe('warning');
  });
});

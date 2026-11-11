import { describe, expect, it } from '@jest/globals';
import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import { agentChecks } from '../../src/checks/agent.js';
import type { AuditCheck } from '../../src/checks/types.js';

/**
 * Builds the minimal devtools log Lighthouse's `NetworkRecords` computed
 * artifact needs to reconstruct the main-document response with the given
 * response headers — the only seam `agent-link-headers` reads through, so a
 * synthetic log exercises `run()` without a browser (as in headers.test.ts).
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
  return events as Artifacts['DevtoolsLog'];
}

/** Builds the artifacts the agent check reads, over the given headers. */
function artifacts(url: string, headers: Record<string, string>): Artifacts {
  return {
    DevtoolsLog: devtoolsLog(url, headers),
    URL: { mainDocumentUrl: url, finalDisplayedUrl: url },
  } as Artifacts;
}

/** A fresh audit context; the empty cache makes NetworkRecords recompute. */
function context(): AuditNS.Context {
  return { computedCache: new Map() } as unknown as AuditNS.Context;
}

/** Looks a check up by id, failing loudly if the registry drops it. */
function check(id: string): AuditCheck {
  const found = agentChecks.find((c) => c.id === id);
  if (!found) {
    throw new Error(`missing check '${id}'`);
  }
  return found;
}

describe('the agent registry', () => {
  it('registers only agent-link-headers, graded, in ai', () => {
    expect(agentChecks).toHaveLength(1);
    const only = agentChecks[0];
    expect(only?.id).toBe('agent-link-headers');
    expect(only?.section).toBe('ai');
    expect(only?.scoreMode).toBe('numeric');
    expect(only?.requiredArtifacts).toEqual(['DevtoolsLog', 'URL']);
  });
});

describe('the agent-link-headers check run()', () => {
  const linkHeaders = check('agent-link-headers');

  it('advises when the home page sends no Link header', async () => {
    const findings = await linkHeaders.run(
      artifacts('https://x.test/', {}),
      context(),
    );
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.severity).toBe('warning');
    expect(findings?.[0]?.message).toContain('no Link header');
  });

  it('advises when the Link header has no agent-useful relation', async () => {
    const findings = await linkHeaders.run(
      artifacts('https://x.test/', {
        link: '</style.css>; rel="preload"',
      }),
      context(),
    );
    expect(findings).toHaveLength(1);
    expect(findings?.[0]?.severity).toBe('warning');
    expect(findings?.[0]?.message).toContain('no agent-useful relation');
  });

  it('passes when the Link header advertises an agent relation', async () => {
    const findings = await linkHeaders.run(
      artifacts('https://x.test/', {
        link: '</.well-known/api-catalog>; rel="api-catalog"',
      }),
      context(),
    );
    expect(findings).toEqual([]);
  });

  it('is not applicable when the run captured no document', async () => {
    const empty = {
      DevtoolsLog: [] as Artifacts['DevtoolsLog'],
      URL: { mainDocumentUrl: '', finalDisplayedUrl: '' },
    } as Artifacts;
    expect(await linkHeaders.run(empty, context())).toBeNull();
  });
});

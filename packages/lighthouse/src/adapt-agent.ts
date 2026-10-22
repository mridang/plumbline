/**
 * Adapter for the `agent` check set. The only agent-readiness check a
 * Lighthouse plugin can run is `agent-link-headers`, which reads the home
 * page's `Link` response header. The reused `src/lib/agent/link-headers.ts`
 * `checkLinkHeaders` takes an {@link AgentEnv} and calls `env.probe('/')`, so
 * this module builds an `AgentEnv` whose single probe returns the main
 * document's response (the only document a plugin can see).
 *
 * The other agent checks fetch other paths, resolve DNS or negotiate content,
 * none of which a plugin can do, so this `AgentEnv`'s `probe` always answers
 * with the main document and its `dns` client throws. Nothing here calls those.
 */
import { NetworkRecords } from 'lighthouse';
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import type {
  AgentEnv,
  Probe,
} from '@mridang/webhint-hint-extra/dist/lib/agent/types.js';
import { findMainDocument, headerBagFromRecord } from './adapt.js';

/** The artifacts an agent check reads: the devtools log and the URL set. */
export interface AgentArtifacts {
  DevtoolsLog: LH.Artifacts['DevtoolsLog'];
  URL: LH.Artifacts['URL'];
}

/**
 * Builds the {@link AgentEnv} `checkLinkHeaders` runs against from the main
 * document's response. Returns null when no document was captured, so the audit
 * falls back to "not applicable".
 */
export async function agentEnv(
  artifacts: AgentArtifacts,
  context: AuditNS.Context,
): Promise<AgentEnv | null> {
  const records = await NetworkRecords.request(artifacts.DevtoolsLog, context);
  const mainDocumentUrl =
    artifacts.URL.mainDocumentUrl || artifacts.URL.finalDisplayedUrl;
  const document = findMainDocument(records, mainDocumentUrl);
  if (!document) {
    return null;
  }

  const url = document.url || mainDocumentUrl || '';
  let origin = '';
  let host = '';
  try {
    const parsed = new URL(url);
    origin = parsed.origin;
    host = parsed.hostname;
  } catch {
    return null;
  }

  // Collapse the header bag (which keeps repeated headers as an array) into the
  // single-value `Record<string, string>` a `Probe` carries; a `Link` sent
  // twice is joined with a comma, which `parseLinkHeader` splits again.
  const bag = headerBagFromRecord(document);
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(bag)) {
    headers[name] = Array.isArray(value) ? value.join(', ') : (value ?? '');
  }

  const probe: Probe = {
    url,
    status: document.statusCode ?? 200,
    headers,
    contentType: headers['content-type'] ?? '',
    body: '',
  };

  return {
    origin,
    host,
    // A plugin can only read the main document, so every probe path resolves to
    // it; `checkLinkHeaders` only ever probes `/`, the home page.
    probe: () => Promise.resolve(probe),
    dns: {
      query: () =>
        Promise.reject(new Error('DNS is unavailable in a Lighthouse plugin.')),
    },
  };
}

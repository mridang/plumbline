/**
 * Adapters for the `privacy` check set. The shared `adapt.ts` only ever
 * resolves the *main document* response (that is all the header checks need);
 * the privacy checks instead need the whole request list of the page load —
 * every subresource host, scheme and `Set-Cookie` header — so this module
 * reshapes the `NetworkRecords` computed artifact (built from `DevtoolsLog`)
 * into the two structural inputs the reused `src/lib/privacy/**` functions
 * already accept: a {@link RequestRecord} list and a {@link CookieRecord} list.
 *
 * Nothing here re-implements a check: `classifyRequests` and `summarizeCookies`
 * do the actual work in `privacy.ts`. This file only turns artifacts into their
 * inputs, exactly as `adapt.ts` does for the header analysers.
 */
import { NetworkRecords } from 'lighthouse';
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import type { Artifacts } from 'lighthouse/types/artifacts.js';
import type { RequestRecord } from '@mridang/webhint-hint-extra/dist/lib/privacy/requests.js';
import type { CookieRecord } from '@mridang/webhint-hint-extra/dist/lib/privacy/cookies.js';
import { cookiesFromHeaders } from '@mridang/webhint-hint-extra/dist/lib/privacy/cookies.js';
import { findMainDocument, headerBagFromRecord } from './adapt.js';

type NetworkRequest = Artifacts.NetworkRequest;

/** The artifacts a privacy check reads: the devtools log and the URL set. */
export interface PrivacyArtifacts {
  DevtoolsLog: LH.Artifacts['DevtoolsLog'];
  URL: LH.Artifacts['URL'];
}

/**
 * Maps Lighthouse's `resourceType` (a `RESOURCE_TYPES` value such as `Script`,
 * `Stylesheet`, `Image`) onto the lower-cased webhint resource type the privacy
 * library keys on. Only the types that matter to `classifyRequests` need an
 * explicit entry: its `ACTIVE_TYPES` set (which decides active vs. passive
 * mixed content) uses `script`, `css`, `html`, `font` and `manifest`. Anything
 * else is lower-cased as-is and treated as passive, which is the safe default
 * for an advisory hint.
 */
const TYPE_MAP: Readonly<Record<string, string>> = {
  Document: 'html',
  Script: 'script',
  Stylesheet: 'css',
  Image: 'image',
  Font: 'font',
  Media: 'media',
  Manifest: 'manifest',
  Fetch: 'fetch',
  XHR: 'xhr',
};

/** The webhint resource type for one network record. */
function requestType(record: NetworkRequest): string {
  const type = record.resourceType ?? '';
  return TYPE_MAP[type] ?? (type.toLowerCase() || 'unknown');
}

/**
 * The privacy inputs read from one page load: the page URL, the subresource
 * requests (the page's own document and its redirect hops are *navigation*, not
 * requests the page made, so `Document` records are excluded — just as the
 * webhint `collect.ts` keeps the page document apart), and the cookies set by
 * every response, keyed by the host that sent each one.
 */
export interface PrivacyNetwork {
  pageUrl: string;
  requests: RequestRecord[];
  cookies: CookieRecord[];
}

/**
 * Resolves the privacy inputs from the devtools log. Returns null when no main
 * document was captured (so the audit renders "not applicable" rather than
 * throwing), mirroring `network.ts`'s `mainResponse`.
 */
export async function privacyNetwork(
  artifacts: PrivacyArtifacts,
  context: AuditNS.Context,
): Promise<PrivacyNetwork | null> {
  const records = await NetworkRecords.request(artifacts.DevtoolsLog, context);
  const mainDocumentUrl =
    artifacts.URL.mainDocumentUrl || artifacts.URL.finalDisplayedUrl;
  const mainDocument = findMainDocument(records, mainDocumentUrl);
  const pageUrl = artifacts.URL.finalDisplayedUrl || mainDocumentUrl || '';
  if (!mainDocument || !pageUrl) {
    return null;
  }

  const requests: RequestRecord[] = [];
  const cookies: CookieRecord[] = [];
  for (const record of records) {
    // Cookies are read from every response (the page and its subresources),
    // each keyed by the host that sent it, as `summarizeCookies` expects.
    let host = '';
    try {
      host = new URL(record.url).hostname;
    } catch {
      host = '';
    }
    if (host) {
      const bag = headerBagFromRecord(record);
      cookies.push(...cookiesFromHeaders(bag['set-cookie'], host));
    }
    // Subresource requests only: the navigation document(s) are not requests
    // the page made, and `classifyRequests` requires the document be absent.
    if (record.resourceType === 'Document') {
      continue;
    }
    requests.push({ url: record.url, type: requestType(record) });
  }
  return { pageUrl, requests, cookies };
}

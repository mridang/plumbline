/**
 * Shared network plumbing for the header audits. A Lighthouse plugin cannot add
 * a gatherer, so the response headers the header checks need are read out of the
 * `devtoolsLogs` artifact through Lighthouse's own `NetworkRecords` computed
 * artifact. This module resolves the main document once and hands back the
 * {@link HeaderBag} and the "served over HTTPS" flag the checks take.
 */
import { NetworkRecords } from 'lighthouse';
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import type { HeaderBag } from '@mridang/webhint-hint-extra/dist/lib/headers/http-headers.js';
import { findMainDocument, headerBagFromRecord } from './adapt.js';

/** The artifacts a header audit requires: the devtools log and the URL set. */
export interface HeaderArtifacts {
  DevtoolsLog: LH.Artifacts['DevtoolsLog'];
  URL: LH.Artifacts['URL'];
}

/** The main document's headers, HTTP status, and whether it used HTTPS. */
export interface MainResponse {
  headers: HeaderBag;
  secure: boolean;
  status: number;
}

/**
 * Resolves the main document response from the devtools log. Returns null when
 * no document record is present (for example a run that never loaded a page),
 * so audits can fall back to "not applicable" rather than throwing.
 */
export async function mainResponse(
  artifacts: HeaderArtifacts,
  context: AuditNS.Context,
): Promise<MainResponse | null> {
  const records = await NetworkRecords.request(artifacts.DevtoolsLog, context);
  const mainDocumentUrl =
    artifacts.URL.mainDocumentUrl || artifacts.URL.finalDisplayedUrl;
  const document = findMainDocument(records, mainDocumentUrl);
  if (!document) {
    return null;
  }
  return {
    headers: headerBagFromRecord(document),
    secure: (document.url || mainDocumentUrl || '')
      .toLowerCase()
      .startsWith('https:'),
    status: document.statusCode ?? 200,
  };
}

import type { HintContext } from 'hint';
import type { HttpHeaders } from '@hint/utils-types';
import type { RequestRecord } from '../../lib/privacy/requests.js';

/** A request together with the headers of its response. */
interface CollectedRequest extends RequestRecord {
  headers: HttpHeaders;
}

/** Everything the privacy hints share about the scan, filled while it runs. */
export interface Collected {
  /** URL of the scanned page. */
  pageUrl: string;
  /** Headers of the page's own response. */
  pageHeaders: HttpHeaders;
  /** Subresource requests (the page document itself is not included). */
  requests: CollectedRequest[];
}

/** Resource types webhint emits `fetch::end::<type>` events for. */
const TYPES = [
  'css',
  'font',
  'html',
  'image',
  'json',
  'manifest',
  'script',
  'txt',
  'unknown',
  'xml',
] as const;

/**
 * Subscribes to every completed fetch of the scan and records it. The result
 * is filled in as events arrive, so read it from a `scan::end` handler. A
 * redirected subresource appears under the URL that was finally fetched.
 */
export function collectRequests(context: HintContext): Collected {
  const collected: Collected = {
    pageUrl: '',
    pageHeaders: {},
    requests: [],
  };
  context.on('scan::start', (event) => {
    collected.pageUrl = event.resource;
  });
  for (const type of TYPES) {
    context.on(`fetch::end::${type}`, (event) => {
      const headers = event.response.headers ?? {};
      // The page document is by definition first party and is not a request
      // made by the page, so it is kept apart.
      if (type === 'html' && event.resource === collected.pageUrl) {
        collected.pageHeaders = headers;
        return;
      }
      collected.requests.push({
        url: event.resource,
        type,
        headers,
      });
    });
  }
  return collected;
}

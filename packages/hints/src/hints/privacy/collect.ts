import type { HintContext } from 'hint';
import type { HTMLElement } from '@hint/utils-dom';
import type { HttpHeaders } from '@hint/utils-types';
import type { RequestRecord } from '../../lib/privacy/requests.js';

/** Elements that load a subresource and the attribute holding its URL. */
const REFERENCES: readonly [
  selector: string,
  attribute: string,
  type: string,
][] = [
  ['script[src]', 'src', 'script'],
  ['link[rel~="stylesheet"][href]', 'href', 'css'],
  ['iframe[src]', 'src', 'html'],
  ['img[src]', 'src', 'image'],
  ['audio[src], video[src], source[src]', 'src', 'media'],
];

/** A subresource URL written in the HTML, with the element that holds it. */
interface DeclaredReference extends RequestRecord {
  element: HTMLElement;
}

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
  /** Subresource URLs written in the HTML, filled once the DOM is built. */
  declared: DeclaredReference[];
}

/** Finds the first element that declared `url`, if the DOM has one. */
function elementFor(
  collected: Collected,
  url: string,
): HTMLElement | undefined {
  return collected.declared.find((reference) => reference.url === url)?.element;
}

/**
 * What a finding about the request for `url` shows: the tag that loaded it
 * when the DOM has one (webhint then shows the tag and its location), else
 * the URL itself.
 */
export function evidence(
  collected: Collected,
  url: string,
): { element: HTMLElement } | { codeSnippet: string } {
  const element = elementFor(collected, url);
  return element ? { element } : { codeSnippet: url };
}

/** Resolves a URL written in the HTML, or null when it is malformed. */
function resolveUrl(value: string, base: string): string | null {
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
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
    declared: [],
  };
  context.on('scan::start', (event) => {
    collected.pageUrl = event.resource;
  });
  context.on('traverse::end', (event) => {
    for (const [selector, attribute, type] of REFERENCES) {
      for (const element of event.document.querySelectorAll(selector)) {
        const value = element.getAttribute(attribute);
        const url = value ? resolveUrl(value, collected.pageUrl) : null;
        if (url) {
          collected.declared.push({ url, type, element });
        }
      }
    }
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

import type { HintContext, NetworkData, ReportOptions } from 'hint';
import type { HTMLDocument } from '@hint/utils-dom';
import { Severity, type HttpHeaders } from '@hint/utils-types';

/** The page that was scanned, once its DOM is available. */
export interface Page {
  url: string;
  headers: HttpHeaders;
  document: HTMLDocument;
  content: string;
  /** Reports a problem against the page URL. */
  report(message: string, options?: Partial<ReportOptions>): void;
}

/**
 * Runs `check` once the scanned page has been parsed. Use it for hints that
 * read the HTML or the response headers of the page itself.
 */
export function onPage(
  context: HintContext,
  check: (page: Page) => void | Promise<void>,
): void {
  let url = '';
  context.on('scan::start', (event) => {
    url = event.resource;
  });
  context.on('traverse::end', async (event) => {
    await check({
      url: url || event.resource,
      headers: context.pageHeaders ?? {},
      document: event.document,
      content: context.pageContent ?? '',
      report: (message, options = {}) =>
        context.report(url || event.resource, message, {
          severity: Severity.error,
          ...options,
        }),
    });
  });
}

/** The site that was scanned and a way to fetch other files from it. */
export interface Site {
  url: URL;
  origin: string;
  /** Fetches a path or URL from the site; null when the request fails. */
  fetch(target: string, headers?: object): Promise<NetworkData | null>;
  /** Reports a problem against a resource of the site. */
  report(
    resource: string,
    message: string,
    options?: Partial<ReportOptions>,
  ): void;
}

/**
 * Runs `check` once the scan has finished. Use it for hints that probe other
 * URLs of the site, such as `/robots.txt` or `/.well-known/*`, or that look
 * at DNS and TLS.
 */
export function onSite(
  context: HintContext,
  check: (site: Site) => void | Promise<void>,
): void {
  let target = '';
  context.on('scan::start', (event) => {
    target = event.resource;
  });
  context.on('scan::end', async (event) => {
    const url = new URL(target || event.resource);
    await check({
      url,
      origin: url.origin,
      fetch: async (path, headers) => {
        try {
          return await context.fetchContent(new URL(path, url), headers);
        } catch {
          return null;
        }
      },
      report: (resource, message, options = {}) =>
        context.report(resource, message, {
          severity: Severity.error,
          ...options,
        }),
    });
  });
}

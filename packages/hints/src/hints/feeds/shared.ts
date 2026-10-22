import type { HintContext } from 'hint';
import type { HTMLDocument } from '@hint/utils-dom';
import { Severity } from '@hint/utils-types';
import type { Finding } from '../../lib/headers/finding.js';
import { isAbsoluteUrl } from '../../lib/files/issue.js';
import { toSeverity } from './to-severity.js';

/**
 * Shared plumbing for the webhint-only `*-valid` hints. Unlike the DOM-only
 * discovery hints, these must both read the page (to learn which documents are
 * linked) and fetch those documents after the scan, so they cannot use the
 * `onPage`/`onSite` helpers alone. This captures the parsed document as it is
 * traversed, then at `scan::end` fetches every absolute URL the `select`
 * function pulled from it, validates the body and reports what the validator
 * returns against the fetched URL.
 */
export interface ValidateLinkedOptions {
  /**
   * Pulls the URLs to fetch from the parsed page document, resolving any
   * relative href against `baseUrl` so the result is absolute.
   */
  select(document: HTMLDocument, baseUrl: string): readonly string[];
  /** Validates one fetched body and returns its findings. */
  validate(body: string): readonly Finding[];
  /** The human label used in the "could not be fetched" message. */
  label: string;
}

/** Wires a `*-valid` hint: capture the document, then fetch and validate. */
export function validateLinkedDocuments(
  context: HintContext,
  options: ValidateLinkedOptions,
): void {
  let document: HTMLDocument | null = null;
  let baseUrl = '';
  context.on('scan::start', (event) => {
    baseUrl = event.resource;
  });
  context.on('traverse::end', (event) => {
    document = event.document;
    baseUrl = baseUrl || event.resource;
  });
  context.on('scan::end', async (event) => {
    if (!document) {
      return;
    }
    const base = baseUrl || event.resource;
    // Only absolute URLs can be fetched; relative or empty hrefs are a
    // discovery-level problem reported by the matching discovery hint.
    const targets = [...new Set(options.select(document, base))].filter((url) =>
      isAbsoluteUrl(url),
    );
    for (const target of targets) {
      let body: string | null = null;
      let statusCode = 0;
      try {
        const data = await context.fetchContent(new URL(target));
        statusCode = data.response.statusCode;
        body = data.response.body.content;
      } catch {
        body = null;
      }
      if (body === null || statusCode !== 200) {
        const status = statusCode ? ` (HTTP ${statusCode})` : '';
        context.report(
          target,
          `The ${options.label} could not be fetched${status}.`,
          {
            severity: Severity.error,
          },
        );
        continue;
      }
      for (const finding of options.validate(body)) {
        context.report(target, finding.message, {
          severity: toSeverity(finding.severity),
        });
      }
    }
  });
}

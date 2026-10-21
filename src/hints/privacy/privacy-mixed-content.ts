import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  classifyRequests,
  type RequestRecord,
} from '../../lib/privacy/requests.js';
import { collectRequests } from './collect.js';

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

/**
 * Webbkoll, "HTTPS by default, but with issues": an https page must not load
 * subresources over http (mixed content,
 * https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content).
 * Scripts, stylesheets, frames and fonts are active content and an error;
 * images and media are passive content and a warning. Both the requests that
 * were made and the URLs written in the HTML are checked.
 */
export default defineHint({
  id: 'privacy-mixed-content',
  name: 'Mixed content',
  description:
    'Finds insecure subresources loaded by a page served over https.',
  category: Category.security,
  groups: ['webbkoll', 'privacy', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content',
  setup(context) {
    const collected = collectRequests(context);
    const declared: RequestRecord[] = [];
    context.on('traverse::end', (event) => {
      for (const [selector, attribute, type] of REFERENCES) {
        for (const element of event.document.querySelectorAll(selector)) {
          const value = element.getAttribute(attribute);
          const url = value ? resolveUrl(value, collected.pageUrl) : null;
          if (url) {
            declared.push({ url, type });
          }
        }
      }
    });
    context.on('scan::end', () => {
      // Requests win over declarations: they carry the real resource type.
      const all = [...collected.requests, ...declared];
      const unique = all.filter(
        (request, index) =>
          all.findIndex((other) => other.url === request.url) === index,
      );
      const { mixedContent } = classifyRequests(collected.pageUrl, unique);
      const groups = [
        [mixedContent.active, Severity.error, 'active'],
        [mixedContent.passive, Severity.warning, 'passive'],
      ] as const;
      for (const [requests, severity, kind] of groups) {
        for (const request of requests) {
          context.report(
            collected.pageUrl,
            `The page contains ${kind} mixed content: ${request.type} loaded over http from ${request.url}`,
            { severity },
          );
        }
      }
    });
  },
});

/** Resolves a URL written in the HTML, or null when it is malformed. */
function resolveUrl(value: string, base: string): string | null {
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
}

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import type { HintDefinition } from '../../core/define-hint.js';
import {
  httpMethodsFindings,
  parseAllowedMethods,
} from '../../lib/secplus/http-methods.js';
import { reportSiteFindings } from '../headers/shared.js';

/**
 * The result of an `OPTIONS` probe: the raw `Allow` header, or null when the
 * request failed or the server sent no `Allow`.
 */
interface OptionsResult {
  allow: string | null;
}

/** Sends an `OPTIONS` request and returns the `Allow` header. */
export type OptionsRequester = (url: URL) => Promise<OptionsResult | null>;

/**
 * The default requester: a real `OPTIONS` request over node's HTTP(S) client,
 * reading the `Allow` header of the response. Returns null on any error so a
 * probe failure is simply "not applicable" rather than a thrown scan.
 */
const defaultOptionsRequester: OptionsRequester = (url) =>
  new Promise((resolve) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = send(url, { method: 'OPTIONS' }, (res) => {
      const allow = res.headers['allow'];
      // Drain and discard the body so the socket is freed.
      res.resume();
      resolve({
        allow: Array.isArray(allow) ? allow.join(', ') : (allow ?? null),
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });

/**
 * Builds the `http-methods` hint with an injectable {@link OptionsRequester}.
 * Tests pass a fake requester (or point the default one at a local server);
 * the default export uses {@link defaultOptionsRequester}.
 */
export function httpMethodsHint(
  requester: OptionsRequester = defaultOptionsRequester,
): HintDefinition {
  return defineHint({
    id: 'http-methods',
    name: 'Safe HTTP methods',
    description:
      'Probes OPTIONS on the root and flags TRACE (XST) and unsafe write methods.',
    category: Category.security,
    groups: ['owasp', 'security-headers'],
    reference:
      'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/06-Test_HTTP_Methods',
    setup(context) {
      onSite(context, async (site) => {
        const result = await requester(site.url);
        const allowed = parseAllowedMethods(result?.allow ?? null);
        reportSiteFindings(site, site.url.href, httpMethodsFindings(allowed), {
          lines: [`Allow: ${allowed.join(', ')}`],
        });
      });
    },
  });
}

/**
 * The `http-methods` hint.
 *
 * Sends an `OPTIONS` request to the site root and reports when `TRACE`/`TRACK`
 * is enabled (Cross-Site Tracing) or when write methods (`PUT`, `DELETE`, …)
 * are advertised on the root. The rules, messages and severities live in
 * `src/lib/secplus/http-methods.ts`. Webhint-only: a Lighthouse plugin cannot
 * issue an `OPTIONS` request, so there is no plugin check for this.
 *
 * Source: OWASP Testing Guide — Test HTTP Methods.
 */
export default httpMethodsHint();

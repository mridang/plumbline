import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  cookiesFromDocument,
  cookiesFromHeaders,
  cookieLine,
  describeCookie,
  summarizeCookies,
} from '../../lib/privacy/cookies.js';
import { collectRequests } from './collect.js';
import type { CookieRecord } from '../../lib/privacy/cookies.js';

/**
 * Webbkoll, "Cookies": counts the cookies set while loading the page and
 * splits them into first party (same registrable domain as the page) and
 * third party, listing the third-party domains (GDPR rec. 60, 61, 69, 70, 75
 * and 78; ePrivacy art. 5.3). Cookies come from the `Set-Cookie` headers of
 * every response and from `document.cookie`, read in the browser. Each cookie
 * is listed with the fields Webbkoll tabulates (domain, name, session or
 * expiry, Secure, HttpOnly, SameSite); values are left out and a header can
 * show expiry only, so `document.cookie` entries have an unknown lifetime.
 * Cookies a server deletes (`Max-Age=0`) are not counted. Third-party cookies
 * are a warning; first-party cookies are information.
 */
export default defineHint({
  id: 'privacy-cookies',
  name: 'Cookies',
  description:
    'Counts first-party and third-party cookies set by responses and by script.',
  category: Category.security,
  groups: ['webbkoll', 'privacy'],
  reference: 'https://github.com/andersju/webbkoll',
  setup(context) {
    const collected = collectRequests(context);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- webhint's context.on types its listener as returning void, but the engine awaits it; dropping the async would stop the scan waiting for this handler
    context.on('scan::end', async () => {
      const pageHost = new URL(collected.pageUrl).hostname;
      // No browser to ask (for example a plain HTTP connector): only the
      // cookies seen in headers are counted.
      const script: unknown = await context
        .evaluate('document.cookie')
        .catch(() => null);
      const fromScript: CookieRecord[] =
        typeof script === 'string' ? cookiesFromDocument(script, pageHost) : [];
      const cookies: CookieRecord[] = [
        ...cookiesFromHeaders(rawHeader(collected.pageHeaders), pageHost),
        ...collected.requests.flatMap((request) =>
          cookiesFromHeaders(
            rawHeader(request.headers),
            new URL(request.url).hostname,
          ),
        ),
        ...fromScript,
      ];
      const summary = summarizeCookies(cookies, pageHost);
      const first = summary.firstParty.length;
      const third = summary.thirdParty.length;
      if (first + third === 0) {
        return;
      }
      const domains = summary.thirdPartyDomains;
      context.report(
        collected.pageUrl,
        `${first} first-party and ${third} third-party cookies were set${
          third > 0
            ? `; third-party cookie domains (${domains.length}): ${domains.join(', ')}`
            : ''
        }.${list(
          'First-party cookies',
          summary.firstParty,
        )}${list('Third-party cookies', summary.thirdParty)}`,
        {
          severity: third > 0 ? Severity.warning : Severity.hint,
          codeSnippet: [...summary.firstParty, ...summary.thirdParty]
            .map((cookie) => cookieLine(cookie))
            .join('\n'),
          codeLanguage: 'http',
        },
      );
    });
  },
});

/** A sentence listing cookies with their attributes, empty for none. */
function list(label: string, cookies: readonly CookieRecord[]): string {
  return cookies.length === 0
    ? ''
    : ` ${label}: ${cookies.map((cookie) => describeCookie(cookie)).join('; ')}.`;
}

/** The raw `Set-Cookie` value(s), which may be a string or a list. */
function rawHeader(
  headers: Record<string, string | string[] | undefined>,
): string | string[] | undefined {
  return Object.entries(headers).find(
    ([key]) => key.toLowerCase() === 'set-cookie',
  )?.[1];
}

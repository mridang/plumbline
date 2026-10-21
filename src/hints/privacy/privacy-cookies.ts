import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  cookiesFromDocument,
  cookiesFromHeaders,
  cookieLine,
  describeCookie,
  summarizeCookies,
  type CookieRecord,
} from '../../lib/privacy/cookies.js';
import { collectRequests } from './collect.js';

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
    context.on('scan::end', async () => {
      const pageHost = new URL(collected.pageUrl).hostname;
      const cookies: CookieRecord[] = cookiesFromHeaders(
        rawHeader(collected.pageHeaders),
        pageHost,
      );
      for (const request of collected.requests) {
        cookies.push(
          ...cookiesFromHeaders(
            rawHeader(request.headers),
            new URL(request.url).hostname,
          ),
        );
      }
      try {
        const script: unknown = await context.evaluate('document.cookie');
        if (typeof script === 'string') {
          cookies.push(...cookiesFromDocument(script, pageHost));
        }
      } catch {
        // No browser to ask (for example a plain HTTP connector): only the
        // cookies seen in headers are counted.
      }
      const summary = summarizeCookies(cookies, pageHost);
      const first = summary.firstParty.length;
      const third = summary.thirdParty.length;
      if (first + third === 0) {
        return;
      }
      const domains = summary.thirdPartyDomains;
      context.report(
        collected.pageUrl,
        `${first} first-party and ${third} third-party cookies were set` +
          (third > 0
            ? `; third-party cookie domains (${domains.length}): ${domains.join(', ')}`
            : '') +
          '.' +
          list('First-party cookies', summary.firstParty) +
          list('Third-party cookies', summary.thirdParty),
        {
          severity: third > 0 ? Severity.warning : Severity.hint,
          codeSnippet: [...summary.firstParty, ...summary.thirdParty]
            .map(cookieLine)
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
    : ` ${label}: ${cookies.map(describeCookie).join('; ')}.`;
}

/** The raw `Set-Cookie` value(s), which may be a string or a list. */
function rawHeader(
  headers: Record<string, string | string[] | undefined>,
): string | string[] | undefined {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'set-cookie') {
      return value;
    }
  }
  return undefined;
}

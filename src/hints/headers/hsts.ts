import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage, onSite } from '../../core/page.js';
import {
  baseDomainHstsFindings,
  hstsFindings,
} from '../../lib/headers/hsts.js';
import { hstsClient } from '../../lib/headers/hsts-client.js';
import { registrableDomain } from '../../lib/headers/registrable-domain.js';
import {
  PROFILE_SCHEMA,
  isSecure,
  readProfile,
  reportFindings,
  reportSiteFindings,
} from './shared.js';

/**
 * Strict-Transport-Security.
 *
 * `observatory` profile (default), from Mozilla Observatory: the page must be
 * served over HTTPS (the header is ignored over HTTP), the header must be
 * valid and not contain repeated or malformed directives, `max-age` must be
 * at least six months (15552000), unknown directives are warned about, and
 * `includeSubDomains` plus `preload` are suggested. As Webbkoll does, when
 * the page is on a subdomain the header of its registrable domain is looked
 * at too, since only that header's `includeSubDomains` covers every subdomain.
 *
 * `owasp` profile: the header must be exactly
 * `max-age=63072000; includeSubDomains`, optionally followed by `; preload`.
 *
 * HSTS makes browsers refuse plain HTTP for the site, which defeats
 * downgrade and cookie hijacking attacks.
 */
/** The header to add when the site sends none. */
const HSTS_SUGGESTION = 'max-age=31536000; includeSubDomains';

export default defineHint({
  id: 'hsts',
  name: 'Strict-Transport-Security',
  description:
    'Checks the Strict-Transport-Security header: HTTPS only, max-age and subdomain coverage.',
  category: Category.security,
  groups: [
    'observatory',
    'owasp',
    'webbkoll',
    'internetnl',
    'security-headers',
  ],
  reference:
    'https://developer.mozilla.org/docs/Web/Security/Practical_implementation_guides/TLS#http_strict_transport_security_implementation',
  schema: PROFILE_SCHEMA,
  setup(context) {
    const profile = readProfile(context.hintOptions);
    onPage(context, (page) => {
      const header = headerValue(page.headers, 'strict-transport-security');
      reportFindings(
        page,
        hstsFindings({ header, secure: isSecure(page.url), profile }),
        {
          name: 'Strict-Transport-Security',
          value: header,
          suggest: HSTS_SUGGESTION,
        },
      );
    });

    if (profile !== 'observatory') {
      return;
    }
    onSite(context, async (site) => {
      const host = site.url.hostname;
      if (site.url.protocol !== 'https:') {
        return;
      }
      const base = registrableDomain(host);
      // Hosts that are their own registrable domain (or IPs) need no lookup.
      if (base === host.toLowerCase() || !host.includes('.')) {
        return;
      }
      const baseHeader = await hstsClient.fetchHeader(`https://${base}/`);
      reportSiteFindings(
        site,
        `https://${base}/`,
        baseDomainHstsFindings(host, baseHeader),
        {
          name: 'Strict-Transport-Security',
          value: baseHeader ?? null,
          suggest: HSTS_SUGGESTION,
        },
      );
    });
  },
});

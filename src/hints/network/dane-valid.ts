import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import {
  daneExistence,
  daneValidity,
  formatTlsa,
} from '../../lib/network/dane.js';

/**
 * Internet.nl `dane-valid`: the TLSA data must match the certificate the
 * web server presents (RFC 6698). Only tested when `dane-exists` passes. A
 * mismatch makes the site unreachable for clients that check DANE.
 */
export default defineHint({
  id: 'dane-valid',
  name: 'DANE validity',
  description:
    'Requires the DANE TLSA record of the website domain to match the web certificate.',
  category: Category.security,
  groups: ['internetnl', 'dns', 'tls'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const existence = await daneExistence(host);
      if (existence.state !== 'exists') {
        return;
      }
      if ((await daneValidity(host, existence.records)) === 'invalid') {
        site.report(
          site.url.href,
          'The DANE fingerprint on your domain is not valid for your web certificate. Either someone manipulated the response from your name server, or your domain has a serious DANE configuration error. The latter makes your website unreachable for any user who checks DANE fingerprints. You should contact your name server operator and/or your hosting provider as soon as possible.',
          {
            severity: Severity.error,
            codeSnippet: existence.records
              .map((record) => formatTlsa(record, `_443._tcp.${host}`))
              .join('\n'),
          },
        );
      }
    });
  },
});

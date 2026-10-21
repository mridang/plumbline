import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import {
  followRedirects,
  redirectionFindings,
} from '../../lib/headers/redirection.js';
import { reportSiteFindings } from './shared.js';

/**
 * HTTP to HTTPS redirection.
 *
 * Starting at the `http://` address of the site, redirects are followed hop
 * by hop and judged as Mozilla Observatory's `redirection.js` does (the same
 * check exists in Internet.nl's HTTPS test): the site must redirect to HTTPS,
 * the first redirect must stay on the same host so that HSTS can be learned
 * (browsers ignore HSTS sent over HTTP), and the final URL must be HTTPS. A
 * site that does not answer on HTTP needs no redirect.
 *
 * Without a redirect, visitors who type the plain address stay on an
 * unencrypted connection.
 */
export default defineHint({
  id: 'redirection',
  name: 'HTTP to HTTPS redirection',
  description:
    'Checks that http:// redirects to https:// on the same host before any other redirect.',
  category: Category.security,
  groups: ['observatory', 'internetnl', 'security-headers'],
  reference:
    'https://developer.mozilla.org/docs/Web/Security/Practical_implementation_guides/TLS#http_redirection',
  setup(context) {
    onSite(context, async (site) => {
      // An HTTPS site is probed on port 80; an HTTP target as it was given.
      const start =
        site.url.protocol === 'https:'
          ? new URL(`http://${site.url.hostname}/`)
          : new URL('/', site.url);
      const route = await followRedirects(start);
      reportSiteFindings(site, start.href, redirectionFindings(route));
    });
  },
});

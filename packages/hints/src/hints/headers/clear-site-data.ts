import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onSite } from '../../core/page.js';
import { exactHeaderFindings } from '../../lib/headers/exact-header.js';
import { finding } from '../../lib/headers/finding.js';
import { reportSiteFindings } from './shared.js';

/** The value OWASP expects, without spaces and in lower case. */
const EXPECTED = '"cache","cookies","storage"';

/**
 * OWASP Secure Headers Project: the logout response should send
 * `Clear-Site-Data: "cache","cookies","storage"` so the browser drops
 * everything stored for the site when the user signs out.
 *
 * OSHP tests this on the logout URL, not the home page, so the hint needs the
 * `logoutUrl` option (a path or URL of the site) and does nothing without it.
 * The logout URL must answer 200.
 */
export default defineHint({
  id: 'clear-site-data',
  name: 'Clear-Site-Data on logout',
  description:
    'Requires the logout response to send Clear-Site-Data for cache, cookies and storage.',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference: 'https://owasp.org/www-project-secure-headers/',
  schema: [
    {
      additionalProperties: false,
      properties: { logoutUrl: { type: 'string' } },
      type: 'object',
    },
  ],
  setup(context) {
    const logoutUrl = (
      context.hintOptions as { logoutUrl?: string } | undefined
    )?.logoutUrl;
    if (!logoutUrl) {
      return;
    }
    onSite(context, async (site) => {
      const target = new URL(logoutUrl, site.url).href;
      const data = await site.fetch(target);
      if (!data) {
        reportSiteFindings(site, target, [
          finding('error', `The logout URL '${target}' could not be fetched.`),
        ]);
        return;
      }
      if (data.response.statusCode !== 200) {
        reportSiteFindings(site, target, [
          finding(
            'error',
            `The logout URL '${target}' answered ${data.response.statusCode} instead of 200.`,
          ),
        ]);
        return;
      }
      const value = headerValue(data.response.headers, 'clear-site-data');
      const normalised = value?.replaceAll(/\s+/g, '').toLowerCase() ?? null;
      reportSiteFindings(
        site,
        target,
        exactHeaderFindings('Clear-Site-Data', normalised, [EXPECTED]),
        { name: 'Clear-Site-Data', value, suggest: EXPECTED },
      );
    });
  },
});

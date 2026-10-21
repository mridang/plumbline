import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { corsFindings, PROBE_ORIGIN } from '../../lib/headers/cors.js';
import { headerValue } from '../../core/http.js';
import { reportSiteFindings } from './shared.js';

/**
 * Cross-origin resource sharing.
 *
 * After the scan the home page is requested again with an `Origin` header of
 * a foreign site (the one Mozilla Observatory uses) and the
 * `Access-Control-Allow-Origin` answer is classified as Observatory's
 * `cors.js` does. A site that echoes the requesting origin and allows
 * credentials lets any website make authenticated requests as the visitor,
 * which is reported as an error. `*` (public content) is reported as
 * information, restricted access and no CORS at all pass.
 */
export default defineHint({
  id: 'cors',
  name: 'Cross-origin resource sharing',
  description:
    'Checks that Access-Control-Allow-Origin does not let any site make credentialed requests.',
  category: Category.security,
  groups: ['observatory', 'security-headers'],
  reference:
    'https://developer.mozilla.org/docs/Web/Security/Practical_implementation_guides/CORS',
  setup(context) {
    onSite(context, async (site) => {
      const data = await site.fetch(site.url.href, { Origin: PROBE_ORIGIN });
      if (!data) {
        return;
      }
      const headers = data.response.headers;
      const allowOrigin = headerValue(headers, 'access-control-allow-origin');
      reportSiteFindings(
        site,
        site.url.href,
        corsFindings({
          allowOrigin,
          allowCredentials: headerValue(
            headers,
            'access-control-allow-credentials',
          ),
          origin: PROBE_ORIGIN,
        }),
        { name: 'Access-Control-Allow-Origin', value: allowOrigin },
      );
    });
  },
});

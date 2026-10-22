import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';

const PATH = '/.well-known/change-password';

/**
 * Checks /.well-known/change-password against the W3C "A Well-Known URL for
 * Changing Passwords" specification. A site that lets users change their
 * password should serve this URL so password managers can send users straight
 * to the change-password page. The spec expects the URL to resolve (a 200, or
 * a redirect to the real page), not a 404. The underlying fetch follows
 * redirects, so a reachable final response is treated as support and a 4xx or
 * 5xx (or an unreachable URL) is reported.
 */
export default defineHint({
  id: 'change-password',
  name: 'Well-known change-password URL',
  description:
    'Checks that /.well-known/change-password resolves to a password-change page.',
  category: Category.security,
  groups: ['w3c', 'security-headers'],
  reference: 'https://w3c.github.io/webappsec-change-password-url/',
  setup(context) {
    onSite(context, async (site) => {
      const url = new URL(PATH, site.url).href;
      const data = await site.fetch(PATH);
      // No response at all means the URL could not be reached.
      if (!data) {
        site.report(url, 'The change-password URL could not be fetched.', {
          severity: Severity.warning,
        });
        return;
      }
      // After redirects are followed, a client-error or server-error status
      // means the site does not expose a change-password page here.
      const status = data.response.statusCode;
      if (status >= 400) {
        site.report(
          url,
          `The change-password URL returned HTTP ${status}; it should redirect to, or serve, a password-change page.`,
          {
            severity: Severity.warning,
            codeSnippet: `${PATH} -> /settings/password`,
          },
        );
      }
    });
  },
});

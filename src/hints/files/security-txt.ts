import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { validateSecurityTxt } from '../../lib/files/security-txt.js';
import { checkFile } from './shared.js';

const EXPECTED = '/.well-known/security.txt';
const LEGACY = '/security.txt';

/**
 * Checks security.txt against RFC 9116: the file belongs at
 * /.well-known/security.txt (section 3), with /security.txt allowed only as
 * a legacy location, and must be served over HTTPS as text/plain UTF-8 with
 * the required Contact and Expires fields. Internet.nl also flags a file that
 * is only at the legacy location, so this hint does too.
 */
export default defineHint({
  id: 'security-txt',
  name: 'Valid security.txt',
  description: 'Checks that /.well-known/security.txt follows RFC 9116.',
  category: Category.security,
  groups: ['files', 'security-headers'],
  reference: 'https://www.rfc-editor.org/rfc/rfc9116',
  setup(context) {
    onSite(context, async (site) => {
      // RFC 9116 section 3: the file must be served over HTTPS. Loopback
      // hosts are exempt so local scans are not flagged.
      const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(
        site.url.hostname,
      );
      if (site.url.protocol !== 'https:' && !loopback) {
        site.report(
          new URL(EXPECTED, site.url).href,
          'security.txt must be served over HTTPS.',
        );
      }
      // Fall back to the legacy path only when the preferred one is absent.
      let path = EXPECTED;
      const preferred = await site.fetch(EXPECTED);
      if (preferred?.response.statusCode !== 200) {
        const legacy = await site.fetch(LEGACY);
        if (legacy?.response.statusCode === 200) {
          path = LEGACY;
          site.report(
            new URL(LEGACY, site.url).href,
            `security.txt was found only at the legacy location ${LEGACY}; it should be served at ${EXPECTED}.`,
          );
        }
      }
      await checkFile(site, {
        path,
        label: 'security.txt',
        mediaTypes: ['text/plain'],
        missing: 'warning',
        validate: (text, url) => validateSecurityTxt(text, { url }),
      });
    });
  },
});

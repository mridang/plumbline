import { checkServerIdentity } from 'node:tls';
import { Category, defineHint } from '../../core/define-hint.js';
import { fetchCertificate } from '../../lib/tls/client.js';
import { onTlsSite } from './on-tls-site.js';

/**
 * Internet.nl "Domain name on certificate": the host name of the website
 * must match a name on its certificate (subject alternative names, or the
 * common name when there are none). Matching is done by Node's
 * `checkServerIdentity`, which follows RFC 6125 including wildcards.
 */
export default defineHint({
  id: 'cert-hostname',
  name: 'Certificate host name',
  description:
    'Requires the host name of the website to match a name on its HTTPS certificate.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, async ({ target, report, couldNotTest }) => {
      const result = await fetchCertificate(target);
      if (result === null) {
        couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
        return;
      }
      const mismatch = checkServerIdentity(target.host, result.peerCertificate);
      if (mismatch) {
        const names = [
          result.peerCertificate.subject?.CN,
          ...(result.peerCertificate.subjectaltname ?? '').split(/,\s*/),
        ].filter((name) => name);
        report(
          `The domain name of your website does *not* match the domain name on your website certificate (${names.join(', ')}).`,
        );
      }
    });
  },
});

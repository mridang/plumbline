import { Severity } from '@hint/utils-types';
import { daneExistence } from '../../lib/network/dane.js';
import { checkCertHostname } from '../tls/cert-hostname.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * The severity of a name mismatch on the certificate of a mail server. As
 * Internet.nl does, it is only information, unless the server publishes a
 * DANE-TA(2) record: DANE-TA authenticates the issuer, not the key, so the
 * name on the certificate is then what ties the certificate to the server and
 * a mismatch is an error.
 */
async function mismatchSeverity(host: string): Promise<Severity> {
  const existence = await daneExistence(host, 25);
  return existence.state === 'exists' &&
    existence.records.some((record) => record.usage === 2)
    ? Severity.error
    : Severity.hint;
}

/**
 * Internet.nl, email test, subtest MailTlsCertHostmatch: the host name of a
 * receiving mail server (MX) must match a name on its certificate.
 *
 * It is the check of the website hint `cert-hostname`, run over SMTP STARTTLS
 * on port 25. Many mail servers present a certificate for another name and
 * rely on DANE-EE, so Internet.nl rates a mismatch as information, and as a
 * failure only when a DANE-TA(2) record is published. A server that cannot be
 * reached is reported as information too, and the hint stays silent when the
 * domain has no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-cert-hostname',
  name: 'Mail server certificates match the host name',
  description:
    'Checks that the host names of the mail servers (MX) match a name on their certificates.',
  check: (site) => checkCertHostname(site, mismatchSeverity),
});

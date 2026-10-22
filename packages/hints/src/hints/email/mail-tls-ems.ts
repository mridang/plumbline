import { checkTlsEms } from '../tls/tls-ems.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTLSExtendedMasterSecret: RFC 7627 prevents triple handshake attacks on TLS 1.2. It uses `openssl s_client -starttls smtp` when `openssl` is on the PATH, otherwise the hint says it could not test.
 *
 * It is the check of the website hint `tls-ems`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-ems',
  name: 'Mail servers support the Extended Master Secret',
  description:
    'Requires the mail servers (MX) of the site domain to support the TLS 1.2 Extended Master Secret (RFC 7627).',
  check: checkTlsEms,
});

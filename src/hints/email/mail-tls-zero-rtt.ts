import { checkTlsZeroRtt } from '../tls/tls-zero-rtt.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsZeroRTT: TLS 1.3 early data has no replay protection, so servers should not accept it. It uses `openssl s_client -starttls smtp` when `openssl` is on the PATH, otherwise the hint says it could not test.
 *
 * It is the check of the website hint `tls-zero-rtt`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-zero-rtt',
  name: 'Mail servers reject TLS 0-RTT',
  description:
    'Requires the mail servers (MX) of the site domain not to accept TLS 1.3 0-RTT early data.',
  check: checkTlsZeroRtt,
});

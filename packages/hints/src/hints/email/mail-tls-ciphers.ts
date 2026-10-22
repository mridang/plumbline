import { checkTlsCiphers } from '../tls/tls-ciphers.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsCiphers: the server may only accept cipher suites rated good or sufficient (NCSC appendix B). The suites are enumerated by iterative removal for the highest legacy version and for TLS 1.3.
 *
 * It is the check of the website hint `tls-ciphers`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-ciphers',
  name: 'Mail servers accept only secure cipher suites',
  description:
    'Requires the mail servers (MX) of the site domain to accept only secure (good or sufficient) cipher suites over STARTTLS.',
  check: checkTlsCiphers,
});

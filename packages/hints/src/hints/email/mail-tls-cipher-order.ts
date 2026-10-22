import { checkTlsCipherOrder } from '../tls/tls-cipher-order.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsCipherOrder: the server must enforce its own cipher preference and prefer good and sufficient suites over phase out ones.
 *
 * It is the check of the website hint `tls-cipher-order`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-cipher-order',
  name: 'Mail servers enforce their cipher suite order',
  description:
    'Requires the mail servers (MX) of the site domain to enforce their own preference for the most secure cipher suites.',
  check: checkTlsCipherOrder,
});

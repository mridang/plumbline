import { checkCertSignature } from '../tls/cert-signature.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsCertSignature: every certificate in the chain, except the root, must be signed with a secure algorithm and hash (NCSC 3.3.2 and 3.3.5).
 *
 * It is the check of the website hint `cert-signature`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-cert-signature',
  name: 'Mail server certificates use a secure signature',
  description:
    'Requires every certificate in the chain of the mail servers (MX) to be signed with a secure algorithm and hash function.',
  check: checkCertSignature,
});

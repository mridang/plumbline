import { checkCertPubkey } from '../tls/cert-pubkey.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsCertPubkey: the public key of the certificate and of every intermediate must use a secure algorithm with secure parameters (NCSC 3.3.2.1).
 *
 * It is the check of the website hint `cert-pubkey`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-cert-pubkey',
  name: 'Mail server certificates use a secure public key',
  description:
    'Requires every certificate in the chain of the mail servers (MX) to use a secure public key type and size.',
  check: checkCertPubkey,
});

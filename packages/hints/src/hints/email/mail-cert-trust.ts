import { Severity } from '@hint/utils-types';
import { checkCertTrust } from '../tls/cert-trust.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsCertTrust: the certificate a mail
 * server presents should chain to a publicly trusted root (Mozilla's, as
 * bundled with Node), with every intermediate sent.
 *
 * It is the check of the website hint `cert-trust`, run against every
 * receiving mail server (MX) over SMTP STARTTLS on port 25. Internet.nl only
 * rates this as information for mail, because senders usually authenticate a
 * mail server with DANE instead of the public CA system, so a failure is a
 * hint, not an error. A server that cannot be reached is reported as
 * information too, and the hint stays silent when the domain has no MX
 * records.
 */
export default defineMailTlsHint({
  id: 'mail-cert-trust',
  name: 'Mail server certificates chain to a trusted root',
  description:
    'Checks that the certificates of the mail servers (MX) chain to a trusted root, with all intermediates sent.',
  check: (site) => checkCertTrust(site, Severity.hint),
});

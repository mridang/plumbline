import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import { mailTargetFor } from '../../lib/tls/client.js';
import { MAIL_SUBJECT } from '../tls/on-tls-site.js';
import type { HintDefinition } from '../../core/define-hint.js';
import type { TlsSite } from '../tls/on-tls-site.js';
import type { HintContext } from 'hint';

/**
 * Runs a TLS check once for every receiving mail server (MX) of the site's
 * registrable domain, over SMTP STARTTLS on port 25 as Internet.nl does. The
 * check is the very same function the website hint uses; only the target (a
 * STARTTLS upgrade of the plain connection) and the wording differ. Findings
 * are reported per mail server, with its host name in front of the message.
 * Nothing is reported when the domain has no MX records.
 */
function onMailTls(
  context: HintContext,
  check: (site: TlsSite) => void | Promise<void>,
): void {
  onMailDomain(context, async (mail) => {
    // The mail servers are tested at once, not one after another: a session with a mail
    // server takes seconds to open and a check opens many. What each says is kept and
    // reported in the order of the servers.
    const said = await Promise.all(
      mail.hosts.map(async (host) => {
        const target = mailTargetFor(host);
        const reports: (() => void)[] = [];
        await check({
          target,
          subject: MAIL_SUBJECT,
          report: (message, codeSnippet, severity = Severity.error) =>
            // eslint-disable-next-line functional/immutable-data -- the reports are collected here so they can be sent in the order of the servers
            reports.push(() =>
              mail.report(`${host}: ${message}`, { severity, codeSnippet }),
            ),
          couldNotTest: (reason) =>
            // eslint-disable-next-line functional/immutable-data -- the reports are collected here so they can be sent in the order of the servers
            reports.push(() =>
              mail.report(`${host}: Could not test: ${reason}.`, {
                severity: Severity.hint,
                codeSnippet: `${target.host}:${target.port}`,
              }),
            ),
        });
        return reports;
      }),
    );
    // eslint-disable-next-line functional/no-loop-statements -- sends the collected reports, in the order of the servers
    for (const report of said.flat()) {
      report();
    }
  });
}

interface MailTlsHintSpec {
  id: string;
  name: string;
  description: string;
  check: (site: TlsSite) => void | Promise<void>;
}

/**
 * Defines a hint of the email set that runs a TLS check against every MX
 * host. They all share the groups (`internetnl`, `email`, `tls`), the
 * `domain` option and the reference.
 */
export function defineMailTlsHint(spec: MailTlsHintSpec): HintDefinition {
  return defineHint({
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: Category.security,
    groups: ['internetnl', 'email', 'tls'],
    reference: 'https://internet.nl/',
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: DOMAIN_OPTION_SCHEMA,
      },
    ],
    setup(context) {
      onMailTls(context, spec.check);
    },
  });
}

import type { HintContext, ReportOptions } from 'hint';
import { dns } from '../../core/dns.js';
import { onSite } from '../../core/page.js';
import { registrableDomain } from './domain.js';
import { lookupMailServers } from './mx.js';

/** What a mail hint's check receives. */
export interface MailDomain {
  /** The registrable domain of the scanned site. */
  domain: string;
  /** The receiving mail servers (MX hosts), sorted, at most ten. */
  hosts: string[];
  /** Options the hint was configured with. */
  options: Record<string, unknown>;
  /** Reports a problem against the scanned site. */
  report(message: string, options?: Partial<ReportOptions>): void;
}

/** The option every mail hint accepts to check another domain than the site's. */
export const DOMAIN_OPTION_SCHEMA = {
  domain: {
    type: 'string',
    description:
      'The domain whose mail setup is checked, instead of the registrable domain of the scanned site.',
  },
} as const;

/**
 * Runs `check` after the scan for the mail setup of the site's registrable
 * domain. The hint does nothing at all, and reports nothing, when the host
 * has no registrable domain (an IP address, `localhost`) or the domain has
 * no MX records (or only a Null MX), because it then does not receive mail.
 */
export function onMailDomain(
  context: HintContext,
  check: (mail: MailDomain) => Promise<void>,
): void {
  onSite(context, async (site) => {
    const options = (context.hintOptions ?? {}) as Record<string, unknown>;
    const configured =
      typeof options.domain === 'string' && options.domain !== ''
        ? options.domain.toLowerCase().replace(/\.$/u, '')
        : null;
    const domain = configured ?? registrableDomain(site.url.hostname);
    if (!domain) {
      return;
    }
    const hosts = await lookupMailServers(dns.client, domain);
    if (hosts.length === 0) {
      return;
    }
    await check({
      domain,
      hosts,
      options,
      report: (message, reportOptions) =>
        site.report(site.url.href, message, reportOptions),
    });
  });
}

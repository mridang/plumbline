import type { HintContext, ReportOptions } from 'hint';
import { dns } from '../../core/dns.js';
import { onSite, type Site } from '../../core/page.js';
import { registrableDomain } from '../email/domain.js';
import { lookupMailServers } from '../email/mx.js';

/**
 * What an email-policy hint's check receives. It mirrors the `email` set's
 * `MailDomain` but also exposes the site's `fetch`, because MTA-STS needs to
 * download a policy file over HTTPS after the scan.
 */
export interface PolicyDomain {
  /** The registrable domain of the scanned site (or the configured one). */
  domain: string;
  /** The receiving mail servers (MX hosts), sorted, at most ten. */
  hosts: string[];
  /** Options the hint was configured with. */
  options: Record<string, unknown>;
  /** Fetches a path or URL from the site; null when the request fails. */
  fetch: Site['fetch'];
  /** Reports a problem against the scanned site. */
  report(message: string, options?: Partial<ReportOptions>): void;
}

/** The option every email-policy hint accepts to check another domain. */
export const DOMAIN_OPTION_SCHEMA = {
  domain: {
    type: 'string',
    description:
      'The domain whose email policies are checked, instead of the registrable domain of the scanned site.',
  },
} as const;

/**
 * Runs `check` after the scan for the email policies of the site's registrable
 * domain. Like the `email` set's `onMailDomain`, the hint does nothing and
 * reports nothing when the host has no registrable domain (an IP address,
 * `localhost`) or the domain has no MX records (or only a Null MX), because it
 * then does not receive mail and these policies do not apply.
 */
export function onPolicyDomain(
  context: HintContext,
  check: (mail: PolicyDomain) => Promise<void>,
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
      fetch: site.fetch,
      report: (message, reportOptions) =>
        site.report(site.url.href, message, reportOptions),
    });
  });
}

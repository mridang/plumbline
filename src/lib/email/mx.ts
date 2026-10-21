import type { DnsClient } from '../../core/dns.js';

/** DNS record type number of an MX record. */
const MX = 15;

/** At most this many mail servers are tested, as Internet.nl does. */
const MAX_MAIL_SERVERS = 10;

/**
 * Returns the host names of the receiving mail servers of a domain, sorted by
 * name so the same servers are tested by every hint, or an empty list when
 * the domain does not receive mail.
 *
 * Like Internet.nl this never falls back to A/AAAA records. A "Null MX"
 * (`0 .`, RFC 7505) means the domain accepts no mail, so the result is empty
 * even when other MX records are present (that combination is invalid). An MX
 * pointing at `localhost` is ignored. Lookup failures also give an empty list,
 * so the mail hints stay silent for domains without a working MX.
 */
export async function lookupMailServers(
  client: DnsClient,
  domain: string,
): Promise<string[]> {
  let records;
  try {
    const response = await client.query(domain, 'MX');
    if (response.status !== 0) {
      return [];
    }
    records = response.answers.filter((record) => record.type === MX);
  } catch {
    return [];
  }

  const hosts = new Set<string>();
  for (const record of records) {
    const [priority, ...rest] = record.data.trim().split(/\s+/u);
    const target = rest.join(' ').toLowerCase();
    if (Number(priority) === 0 && target === '.') {
      return [];
    }
    const host = target.replace(/\.$/u, '');
    if (host === '' || host === 'localhost') {
      continue;
    }
    hosts.add(host);
  }
  return [...hosts].sort().slice(0, MAX_MAIL_SERVERS);
}

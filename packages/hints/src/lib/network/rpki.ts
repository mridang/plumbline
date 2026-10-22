/**
 * RPKI route origin checks ported from Internet.nl (checks/tasks/rpki.py):
 * for every IP address of the web server or of the name servers, is a Route
 * Origin Authorisation published (existence) and is the announcement valid.
 */
import { rpki, type RpkiResult } from '../../core/rpki.js';
import { findNameservers, ipv4Addresses, ipv6Addresses } from './dns-util.js';

export interface IpRpki {
  host: string;
  ip: string;
  result: RpkiResult;
}

/** Every A and AAAA address of the given hosts with its RPKI result. */
export async function collectRpki(hosts: string[]): Promise<IpRpki[]> {
  const out: IpRpki[] = [];
  for (const host of hosts) {
    const ips = [
      ...(await ipv4Addresses(host)),
      ...(await ipv6Addresses(host)),
    ];
    for (const ip of ips) {
      try {
        out.push({ host, ip, result: await rpki.client.check(ip) });
      } catch {
        // A validator that is down is not the site's fault: skip the address.
      }
    }
  }
  return out;
}

/** The addresses of the site's own web server. */
export const webRpki = (host: string): Promise<IpRpki[]> => collectRpki([host]);

/** The addresses of the site's name servers. */
export async function nsRpki(host: string): Promise<IpRpki[]> {
  return collectRpki((await findNameservers(host)).nameservers);
}

/** A ROA exists when the announcement is valid or invalid, not "not found". */
const hasRoa = (r: IpRpki): boolean =>
  r.result.status === 'valid' || r.result.status === 'invalid';

/** Entries without a ROA (Internet.nl `exists` bad). */
export const missingRoa = (all: IpRpki[]): IpRpki[] =>
  all.filter((r) => !hasRoa(r));

export type RpkiValidity = 'good' | 'invalid' | 'bad' | 'not-routed' | 'none';

/**
 * Internet.nl `valid`: any invalid announcement is the worst case; then any
 * announcement without ROA; if no address has a route at all the test did
 * not run.
 */
export function judgeValidity(all: IpRpki[]): {
  verdict: RpkiValidity;
  offenders: IpRpki[];
} {
  if (all.length === 0) {
    return { verdict: 'none', offenders: [] };
  }
  const routed = all.filter((r) => r.result.asn !== null);
  const invalid = routed.filter((r) => r.result.status === 'invalid');
  if (invalid.length > 0) {
    return { verdict: 'invalid', offenders: invalid };
  }
  const notFound = routed.filter((r) => r.result.status !== 'valid');
  if (notFound.length > 0) {
    return { verdict: 'bad', offenders: notFound };
  }
  if (routed.length === 0) {
    return { verdict: 'not-routed', offenders: [] };
  }
  return { verdict: 'good', offenders: [] };
}

/** One line per entry with the route and its validation state, as evidence. */
export const rpkiLines = (entries: IpRpki[]): string =>
  entries
    .map(({ host, ip, result }) =>
      [
        host,
        ip,
        result.prefix ?? 'no route',
        result.asn === null ? null : `AS${result.asn}`,
        result.status,
      ]
        .filter((part) => part !== null)
        .join(' '),
    )
    .join('\n');

/** Renders `host (ip)` pairs for messages. */
export const describe = (entries: IpRpki[]): string =>
  entries.map((e) => `${e.host} (${e.ip})`).join(', ');

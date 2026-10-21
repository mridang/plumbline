/**
 * DNS helpers shared by the Internet.nl network hints: reading the scanned
 * host, finding name servers and resolving addresses through `dns.client`.
 */
import { isIP } from 'node:net';
import {
  dns,
  type DnsRecord,
  type DnsResponse,
  type DnsType,
} from '../../core/dns.js';

/** Numeric DNS record types used when filtering answers. */
export const RR = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  AAAA: 28,
  DS: 43,
  DNSKEY: 48,
  TLSA: 52,
  CAA: 257,
} as const;

/**
 * How the scanned URL maps to the host the DNS checks run against. The
 * default is the URL's own host name; tests replace `hostOf` because the
 * test server is only reachable by IP address.
 */
export const target: { hostOf(url: URL): string } = {
  hostOf: (url) => url.hostname,
};

/** Removes a trailing dot and lower-cases a DNS name. */
export function normalizeName(name: string): string {
  return name.replace(/\.$/, '').toLowerCase();
}

/**
 * The DNS name of the scanned site, or null when the site is addressed by an
 * IP literal (there is nothing to look up in DNS for those).
 */
export function siteHost(url: URL): string | null {
  const host = normalizeName(target.hostOf(url)).replace(/^\[|\]$/g, '');
  return host === '' || isIP(host) !== 0 ? null : host;
}

/** Queries DNS and returns null instead of throwing when the lookup fails. */
export async function safeQuery(
  name: string,
  type: DnsType,
): Promise<DnsResponse | null> {
  try {
    return await dns.client.query(name, type);
  } catch {
    return null;
  }
}

/** The answers of one record type, ignoring CNAMEs and other chain records. */
export function answersOfType(
  response: DnsResponse | null,
  type: number,
): DnsRecord[] {
  return (response?.answers ?? []).filter((a) => a.type === type);
}

/** The IPv4 addresses of a host. */
export async function ipv4Addresses(host: string): Promise<string[]> {
  const r = await safeQuery(host, 'A');
  return answersOfType(r, RR.A).map((a) => a.data.trim());
}

/**
 * The IPv6 addresses of a host. IPv4-mapped addresses (`::ffff:a.b.c.d`) and
 * syntactically invalid ones are dropped: they give no IPv6 connectivity
 * (Internet.nl, issues #146 and #655).
 */
export async function ipv6Addresses(host: string): Promise<string[]> {
  const r = await safeQuery(host, 'AAAA');
  return answersOfType(r, RR.AAAA)
    .map((a) => a.data.trim())
    .filter((ip) => isIP(ip) === 6 && !/^::ffff:/i.test(ip));
}

export interface Zone {
  /** The name the name servers were found for. */
  zone: string;
  nameservers: string[];
}

/**
 * Finds the name servers of a site. Instead of a public suffix list this
 * walks up the labels of the host, as Internet.nl does: ask for the NS
 * records of `www.example.org`, then `example.org`, and stop at the first
 * name that answers. A single label (the TLD) is never queried, so a host
 * under a multi-label suffix such as `co.uk` may resolve the suffix's own
 * servers only if that suffix publishes NS records, which is rare.
 */
export async function findNameservers(host: string): Promise<Zone> {
  let name = normalizeName(host);
  while (name.includes('.')) {
    const r = await safeQuery(name, 'NS');
    const ns = answersOfType(r, RR.NS).map((a) => normalizeName(a.data));
    if (ns.length > 0) {
      return { zone: name, nameservers: [...new Set(ns)] };
    }
    name = name.slice(name.indexOf('.') + 1);
  }
  return { zone: normalizeName(host), nameservers: [] };
}

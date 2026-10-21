/**
 * A scripted DNS client for the network tests, so nothing touches the
 * internet. A zone maps `name` to `type` to an entry; names that are not in
 * the zone answer NOERROR with no records.
 */
import {
  dns,
  type DnsClient,
  type DnsResponse,
  type DnsType,
} from '../../../src/core/dns.js';
import { target } from '../../../src/lib/network/dns-util.js';

const TYPE_NUMBER: Record<string, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  AAAA: 28,
  DS: 43,
  DNSKEY: 48,
  TLSA: 52,
  CAA: 257,
};

interface Entry {
  data?: string[];
  /** Resolver validated the answer. */
  ad?: boolean;
  /** DNS response code; 2 is SERVFAIL. */
  status?: number;
}

export type Zone = Record<string, Partial<Record<DnsType, Entry>>>;

/** Builds a client answering from the zone. */
function fakeClient(zone: Zone): DnsClient {
  return {
    async query(name, type): Promise<DnsResponse> {
      const entry = zone[name.toLowerCase()]?.[type];
      return {
        status: entry?.status ?? 0,
        authenticated: entry?.ad === true,
        answers: (entry?.data ?? []).map((data) => ({
          name,
          type: TYPE_NUMBER[type] ?? 0,
          ttl: 60,
          data,
        })),
        authority: [],
      };
    },
  };
}

/**
 * Installs the zone as `dns.client` and maps the scanned URL (an IP literal
 * in tests) to `host`. Returns a function that restores the real ones.
 */
export function installDns(zone: Zone, host = 'example.test'): () => void {
  const realClient = dns.client;
  const realHostOf = target.hostOf;
  dns.client = fakeClient(zone);
  target.hostOf = () => host;
  return () => {
    dns.client = realClient;
    target.hostOf = realHostOf;
  };
}

/**
 * A tiny DNS client for hints that need DNS answers. The default talks to a
 * DNS-over-HTTPS resolver, which also tells us whether the answer was
 * DNSSEC-validated (the AD flag). Tests replace `dns.client` with a fake so
 * they never touch the internet.
 */

/** DNS record types by name, as the DoH JSON API accepts them. */
export type DnsType =
  | 'A'
  | 'AAAA'
  | 'NS'
  | 'MX'
  | 'TXT'
  | 'CAA'
  | 'CNAME'
  | 'SOA'
  | 'SRV'
  | 'SVCB'
  | 'HTTPS'
  | 'DS'
  | 'DNSKEY'
  | 'TLSA';

export interface DnsRecord {
  name: string;
  /** Numeric record type. */
  type: number;
  ttl: number;
  /** Record data in presentation format. */
  data: string;
}

export interface DnsResponse {
  /** DNS response code: 0 is NOERROR, 3 is NXDOMAIN. */
  status: number;
  /** True when the resolver validated the answer with DNSSEC. */
  authenticated: boolean;
  answers: DnsRecord[];
  authority: DnsRecord[];
}

export interface DnsClient {
  query(name: string, type: DnsType): Promise<DnsResponse>;
}

interface DohRecord {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohBody {
  Status: number;
  AD?: boolean;
  Answer?: DohRecord[];
  Authority?: DohRecord[];
}

const toRecord = (r: DohRecord): DnsRecord => ({
  name: r.name,
  type: r.type,
  ttl: r.TTL,
  data: r.data,
});

/** Creates a client that queries a DNS-over-HTTPS JSON endpoint. */
function dohClient(
  endpoint = 'https://cloudflare-dns.com/dns-query',
  fetchImpl: typeof fetch = fetch,
): DnsClient {
  return {
    async query(name, type) {
      const url = new URL(endpoint);
      url.searchParams.set('name', name);
      url.searchParams.set('type', type);
      const response = await fetchImpl(url, {
        headers: { accept: 'application/dns-json' },
      });
      const body = (await response.json()) as DohBody;
      return {
        status: body.Status,
        authenticated: body.AD === true,
        answers: (body.Answer ?? []).map((r) => toRecord(r)),
        authority: (body.Authority ?? []).map((r) => toRecord(r)),
      };
    },
  };
}

/** The client hints use; tests assign a fake to `dns.client`. */
export const dns: { client: DnsClient } = { client: dohClient() };

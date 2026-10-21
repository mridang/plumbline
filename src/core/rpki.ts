/**
 * Route origin validation through the RIPEstat Data API. Given an IP address
 * it finds the announcing AS and prefix, then asks whether a published Route
 * Origin Authorisation (RPKI) covers that announcement. Tests replace
 * `rpki.client` with a fake so they never touch the internet.
 */

export type RpkiStatus = 'valid' | 'invalid' | 'unknown';

export interface RpkiResult {
  /** The AS number announcing the prefix, when one was found. */
  asn: number | null;
  /** The announced prefix covering the address. */
  prefix: string | null;
  /** `valid`: a ROA matches; `invalid`: ROAs exist but none match; `unknown`: no ROA. */
  status: RpkiStatus;
}

export interface RpkiClient {
  check(ip: string): Promise<RpkiResult>;
}

interface NetworkInfoBody {
  data?: { asns?: string[]; prefix?: string };
}

interface RpkiValidationBody {
  data?: { status?: string };
}

/** Creates a client backed by the RIPEstat Data API. */
export function ripeStatClient(
  fetchImpl: typeof fetch = fetch,
  base = 'https://stat.ripe.net/data',
): RpkiClient {
  const getJson = async <T>(path: string, resource: string): Promise<T> => {
    const url = new URL(`${base}/${path}/data.json`);
    url.searchParams.set('resource', resource);
    const response = await fetchImpl(url);
    return (await response.json()) as T;
  };

  return {
    async check(ip) {
      const info = await getJson<NetworkInfoBody>('network-info', ip);
      const asn = Number(info.data?.asns?.[0]);
      const prefix = info.data?.prefix ?? null;
      if (!Number.isFinite(asn) || !prefix) {
        return { asn: null, prefix, status: 'unknown' };
      }
      const url = new URL(`${base}/rpki-validation/data.json`);
      url.searchParams.set('resource', `AS${asn}`);
      url.searchParams.set('prefix', prefix);
      const response = await fetchImpl(url);
      const body = (await response.json()) as RpkiValidationBody;
      const status = body.data?.status?.toLowerCase();
      return {
        asn,
        prefix,
        status: status === 'valid' || status === 'invalid' ? status : 'unknown',
      };
    },
  };
}

/** The client hints use; tests assign a fake to `rpki.client`. */
export const rpki: { client: RpkiClient } = { client: ripeStatClient() };

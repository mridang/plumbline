/**
 * DNSSEC checks ported from Internet.nl (checks/tasks/dnssec.py). Internet.nl
 * runs its own validating resolver; we ask the validating resolver behind
 * `dns.client` and read its AD (authenticated data) flag.
 */
import { findNameservers, safeQuery, answersOfType, RR } from './dns-util.js';

/**
 * - `secure`: the answer was validated (AD set).
 * - `insecure`: not signed (no AD, no DS in the parent).
 * - `bogus`: a DS exists but the answer did not validate.
 * - `servfail`: the resolver returned SERVFAIL, which is how a validating
 *   resolver reports broken name servers or broken signatures.
 * - `error`: the lookup itself failed.
 */
export type DnssecState =
  'secure' | 'insecure' | 'bogus' | 'servfail' | 'error';

/** Looks at the SOA of the host, like Internet.nl, and classifies it. */
export async function dnssecState(host: string): Promise<DnssecState> {
  const soa = await safeQuery(host, 'SOA');
  if (!soa) {
    return 'error';
  }
  if (soa.status === 2) {
    return 'servfail';
  }
  if (soa.authenticated) {
    return 'secure';
  }
  // Not validated. A delegation signer record in the parent means the zone
  // claims to be signed, so a failing validation is bogus, not insecure.
  const { zone } = await findNameservers(host);
  const ds = await safeQuery(zone, 'DS');
  return answersOfType(ds, RR.DS).length > 0 ? 'bogus' : 'insecure';
}

import { parseDmarc, type DmarcRecord } from './dmarc.js';
import { registrableDomain } from './domain.js';
import type { TxtLookup } from './txt.js';

/**
 * The DMARC policy test of Internet.nl (`dmarc_check_policy` in `mail.py`):
 * the record must be syntactically valid, its effective policy must be
 * `quarantine` or `reject`, and external `rua`/`ruf` destinations must have
 * authorised the domain to send them reports.
 */

export type DmarcPolicyStatus =
  'valid' | 'invalid_syntax' | 'invalid_p_sp' | 'invalid_external';

/**
 * Checks that the record provides effective protection. The effective policy
 * is `sp=` for an organizational domain when present, otherwise `p=`. Test
 * mode (`t=y`) lowers the applied policy one level, so `quarantine` counts as
 * `none`. Returns `invalid_syntax` for a null (unparsable) record.
 */
export function verifySufficientPolicy(
  parsed: DmarcRecord | null,
  isOrgDomain: boolean,
): DmarcPolicyStatus {
  if (!parsed) {
    return 'invalid_syntax';
  }
  const { directives } = parsed;
  const request = isOrgDomain
    ? (directives.srequest ?? directives.request)
    : directives.request;
  if (request === undefined) {
    return 'invalid_p_sp';
  }
  const inTestMode = directives.testing === 'y';
  if (request === 'none' || (inTestMode && request === 'quarantine')) {
    return 'invalid_p_sp';
  }
  return 'valid';
}

/** The hosts that `rua=` and `ruf=` send reports to, lower-cased. */
export function reportHosts(parsed: DmarcRecord): string[] {
  const hosts: string[] = [];
  const uris = [
    ...(parsed.directives.auri ?? []),
    ...(parsed.directives.furi ?? []),
  ];
  for (const uri of uris) {
    // `mailto:user@host!10m`: everything after the scheme is the path. URIs
    // with an authority (`https://...`) name no mail host.
    const path = uri.replace(/^[A-Za-z][A-Za-z0-9+.-]*:/u, '');
    if (path === '' || path.startsWith('//')) {
      continue;
    }
    let host = path;
    if (host.includes('@')) {
      host = host.split('@').slice(1).join('@').split('!')[0];
    }
    host = host.trim().toLowerCase().replace(/\.$/u, '');
    if (host !== '') {
      hosts.push(host);
    }
  }
  return hosts;
}

const orgDomainOf = (host: string): string => registrableDomain(host) ?? host;

/**
 * Verifies external report destinations (RFC 7489 section 7.1). For each
 * destination outside the organizational domain, `<domain>._report._dmarc.
 * <host>` must hold exactly one valid DMARC record.
 */
async function verifyExternalDestinations(
  domain: string,
  parsed: DmarcRecord,
  lookupTxt: (name: string) => Promise<TxtLookup>,
): Promise<DmarcPolicyStatus> {
  const domainOrg = orgDomainOf(domain);
  for (const host of reportHosts(parsed)) {
    if (orgDomainOf(host) === domainOrg) {
      continue;
    }
    const lookup = await lookupTxt(`${domain}._report._dmarc.${host}`);
    const valid =
      lookup.status === 'ok'
        ? lookup.records.filter((txt) => parseDmarc(txt) !== null)
        : [];
    // A second valid record makes the authorisation ambiguous.
    if (valid.length !== 1) {
      return 'invalid_external';
    }
  }
  return 'valid';
}

/** Runs the whole policy test on one DMARC record. */
export async function checkDmarcPolicy(
  record: string,
  domain: string,
  isOrgDomain: boolean,
  lookupTxt: (name: string) => Promise<TxtLookup>,
): Promise<DmarcPolicyStatus> {
  const normalized = domain.toLowerCase().replace(/\.$/u, '');
  const parsed = parseDmarc(record);
  const status = verifySufficientPolicy(parsed, isOrgDomain);
  if (status === 'valid' && parsed) {
    return verifyExternalDestinations(normalized, parsed, lookupTxt);
  }
  return status;
}

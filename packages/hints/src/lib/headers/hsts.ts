/**
 * Strict-Transport-Security analysis.
 *
 * Observatory rules (`tests/strict-transport-security.js`): the header needs
 * a valid `max-age` of at least six months (the threshold is 15552000
 * seconds, because "a lot of sites use 15552000"); sites not served over
 * HTTPS cannot have the header. OWASP Secure Headers Project requires
 * exactly `max-age=63072000; includeSubDomains` (optionally `; preload`).
 * Webbkoll additionally looks at the header of the registrable domain when
 * the page is on a subdomain, since includeSubDomains there protects it.
 *
 * Observatory's preload list is not bundled, so the "preloaded" result is
 * not produced.
 */
import { finding, type Finding, type Profile } from './finding.js';
import { isBareHost, registrableDomain } from './registrable-domain.js';

/** Six months, Observatory's threshold. */
const SIX_MONTHS = 15_552_000;

export interface Hsts {
  valid: boolean;
  /** Why the header is invalid. */
  problem?: string;
  maxAge: number | null;
  includeSubDomains: boolean;
  preload: boolean;
  /** Directive names the parser did not recognise. */
  unknown: string[];
}

/** Parses a `Strict-Transport-Security` value. */
export function parseHsts(header: string): Hsts {
  const result: Hsts = {
    valid: true,
    maxAge: null,
    includeSubDomains: false,
    preload: false,
    unknown: [],
  };
  const invalid = (problem: string): Hsts => ({
    ...result,
    valid: false,
    problem,
  });

  const data = header.slice(0, 1024);
  // Two headers are folded into one value with a comma.
  if (data.includes(',')) {
    return invalid('header set multiple times');
  }
  const seen = new Set<string>();
  for (const raw of data.split(';')) {
    const directive = raw.trim();
    if (directive === '') {
      continue;
    }
    const [rawName = '', ...rest] = directive.split('=');
    const name = rawName.trim().toLowerCase();
    if (seen.has(name)) {
      return invalid(`duplicate directive ${name}`);
    }
    seen.add(name);
    switch (name) {
      case 'max-age': {
        const value = rest
          .join('=')
          .trim()
          .replace(/^"(.*)"$/, '$1');
        if (!/^\d+$/.test(value)) {
          return invalid('max-age is not a number');
        }
        result.maxAge = Number.parseInt(value.slice(0, 128), 10);

        break;
      }
      case 'includesubdomains': {
        result.includeSubDomains = true;

        break;
      }
      case 'preload': {
        result.preload = true;

        break;
      }
      default: {
        result.unknown.push(name);
      }
    }
  }
  if (result.maxAge === null) {
    return invalid('max-age missing');
  }
  return result;
}

/** True when the header gives at least six months of protection. */
export function hstsProtects(header: string | null, secure: boolean): boolean {
  if (header === null || !secure) {
    return false;
  }
  const parsed = parseHsts(header);
  return parsed.valid && (parsed.maxAge ?? 0) >= SIX_MONTHS;
}

const OWASP_VALUES = new Set([
  'max-age=63072000; includesubdomains',
  'max-age=63072000; includesubdomains; preload',
]);

export interface HstsInput {
  /** The header value, or null when it was not sent. */
  header: string | null;
  /** Whether the page was served over HTTPS. */
  secure: boolean;
  profile: Profile;
}

/** Findings for the page's own header. */
export function hstsFindings({
  header,
  secure,
  profile,
}: HstsInput): Finding[] {
  if (profile === 'owasp') {
    if (header === null) {
      return [
        finding(
          'error',
          "The 'Strict-Transport-Security' header was not specified.",
        ),
      ];
    }
    const normalised = header
      .trim()
      .toLowerCase()
      .split(';')
      .map((part) => part.trim())
      .join('; ');
    return OWASP_VALUES.has(normalised)
      ? []
      : [
          finding(
            'error',
            "The 'Strict-Transport-Security' header should be 'max-age=63072000; includeSubDomains', optionally followed by '; preload'.",
          ),
        ];
  }

  if (!secure) {
    const findings = [
      finding(
        'error',
        'Strict-Transport-Security header cannot be set for sites not available over HTTPS.',
      ),
    ];
    if (header !== null) {
      findings.push(
        finding(
          'warning',
          "The 'Strict-Transport-Security' header is ignored by browsers when it is sent over HTTP.",
        ),
      );
    }
    return findings;
  }
  if (header === null) {
    return [
      finding(
        'error',
        'Strict-Transport-Security header not implemented. Add HSTS, consider rolling out with shorter periods first.',
      ),
    ];
  }
  const parsed = parseHsts(header);
  if (!parsed.valid) {
    return [
      finding(
        'error',
        `Strict-Transport-Security header cannot be recognized (${parsed.problem}).`,
      ),
    ];
  }
  const findings: Finding[] = [];
  if ((parsed.maxAge ?? 0) < SIX_MONTHS) {
    findings.push(
      finding(
        'error',
        'Strict-Transport-Security header set to less than six months (15768000). Increase the HSTS period.',
      ),
    );
  }
  for (const name of parsed.unknown) {
    findings.push(
      finding(
        'warning',
        `The 'Strict-Transport-Security' header contains an unrecognized directive '${name}'.`,
      ),
    );
  }
  if (findings.length === 0 && !(parsed.includeSubDomains && parsed.preload)) {
    findings.push(
      finding(
        'hint',
        'Consider preloading: this requires adding the preload and includeSubDomains directives and setting max-age to at least 31536000 (1 year), and submitting your site to https://hstspreload.org/.',
      ),
    );
  }
  return findings;
}

/**
 * Webbkoll's check of the registrable domain: when the page is on a
 * subdomain, the header the parent domain sends matters too, because only
 * its `includeSubDomains` can protect every subdomain.
 *
 * `baseHeader` is the header found on `https://<registrable domain>`, null
 * when the request worked but sent none, undefined when it could not be
 * made. Returns no findings for hosts that are their own registrable domain.
 */
export function baseDomainHstsFindings(
  host: string,
  baseHeader: string | null | undefined,
): Finding[] {
  if (baseHeader === undefined || isBareHost(host)) {
    return [];
  }
  const base = registrableDomain(host);
  if (host.toLowerCase() === base) {
    return [];
  }
  if (baseHeader === null) {
    return [
      finding(
        'warning',
        `The registrable domain ${base} does not send a Strict-Transport-Security header, so ${host} is not covered by its includeSubDomains.`,
      ),
    ];
  }
  const parsed = parseHsts(baseHeader);
  if (!parsed.valid || (parsed.maxAge ?? 0) < SIX_MONTHS) {
    return [
      finding(
        'warning',
        `The Strict-Transport-Security header of the registrable domain ${base} is invalid or sets max-age to less than six months.`,
      ),
    ];
  }
  if (!parsed.includeSubDomains) {
    return [
      finding(
        'hint',
        `The Strict-Transport-Security header of the registrable domain ${base} does not include includeSubDomains, so it does not cover ${host}.`,
      ),
    ];
  }
  return [];
}

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
import { finding } from './finding.js';
import { isBareHost, registrableDomain } from './registrable-domain.js';
import type { Finding, Profile } from './finding.js';

/** Matches a string made only of digits. */
const DIGITS_ONLY = /^\d+$/u;

/** Matches a double-quoted string and captures its content. */
const QUOTED_STRING = /^"(.*)"$/u;

/** Six months, Observatory's threshold. */
const SIX_MONTHS = 15_552_000;

/** The directives the parser reads; any other is reported as unknown. */
const KNOWN_DIRECTIVES = new Set(['max-age', 'includesubdomains', 'preload']);

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
  const data = header.slice(0, 1024);
  // Two headers are folded into one value with a comma.
  if (data.includes(',')) {
    return {
      valid: false,
      maxAge: null,
      includeSubDomains: false,
      preload: false,
      unknown: [],
      problem: 'header set multiple times',
    };
  }
  const entries = data
    .split(';')
    .map((raw) => raw.trim())
    .filter((directive) => directive !== '')
    .map((directive) => {
      const [rawName = '', ...rest] = directive.split('=');
      return {
        name: rawName.trim().toLowerCase(),
        value: rest.join('=').trim().replace(QUOTED_STRING, '$1'),
      };
    });
  // The first problem found decides; later directives are not read.
  const problemAt = entries.findIndex(
    ({ name, value }, index) =>
      entries.slice(0, index).some((earlier) => earlier.name === name) ||
      (name === 'max-age' && !DIGITS_ONLY.test(value)),
  );
  const read = problemAt === -1 ? entries : entries.slice(0, problemAt);
  const maxAge = read.find(({ name }) => name === 'max-age');
  const state: Hsts = {
    valid: true,
    maxAge: maxAge ? Number.parseInt(maxAge.value.slice(0, 128), 10) : null,
    includeSubDomains: read.some(({ name }) => name === 'includesubdomains'),
    preload: read.some(({ name }) => name === 'preload'),
    unknown: read
      .map(({ name }) => name)
      .filter((name) => !KNOWN_DIRECTIVES.has(name)),
  };
  if (problemAt !== -1) {
    const { name } = entries[problemAt];
    return {
      ...state,
      valid: false,
      problem: entries
        .slice(0, problemAt)
        .some((earlier) => earlier.name === name)
        ? `duplicate directive ${name}`
        : 'max-age is not a number',
    };
  }
  return state.maxAge === null
    ? { ...state, valid: false, problem: 'max-age missing' }
    : state;
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
    return [
      finding(
        'error',
        'Strict-Transport-Security header cannot be set for sites not available over HTTPS.',
      ),
      ...(header === null
        ? []
        : [
            finding(
              'warning',
              "The 'Strict-Transport-Security' header is ignored by browsers when it is sent over HTTP.",
            ),
          ]),
    ];
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
  const findings: Finding[] = [
    ...((parsed.maxAge ?? 0) < SIX_MONTHS
      ? [
          finding(
            'error',
            'Strict-Transport-Security header set to less than six months (15768000). Increase the HSTS period.',
          ),
        ]
      : []),
    ...parsed.unknown.map((name) =>
      finding(
        'warning',
        `The 'Strict-Transport-Security' header contains an unrecognized directive '${name}'.`,
      ),
    ),
  ];
  if (findings.length === 0 && !(parsed.includeSubDomains && parsed.preload)) {
    return [
      finding(
        'hint',
        'Consider preloading: this requires adding the preload and includeSubDomains directives and setting max-age to at least 31536000 (1 year), and submitting your site to https://hstspreload.org/.',
      ),
    ];
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

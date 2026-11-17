import { isIPv6 } from '#net';

/** Matches a label made only of letters and digits. */
const ALPHANUMERIC_LABEL = /^[A-Za-z0-9]+$/u;

/** Matches a string that contains a letter. */
const CONTAINS_LETTER = /[A-Za-z]/u;

/** Matches a label with letters, digits and hyphens after its first hyphen. */
const HYPHENATED_LABEL = /^[A-Za-z0-9]+-[A-Za-z0-9-]*$/u;

/** Matches a string that ends in a letter or a digit. */
const ENDS_ALPHANUMERIC = /[A-Za-z0-9]$/u;

/** Matches an optional IPv4 and IPv6 prefix length at the end of a term. */
const CIDR_SUFFIX = /(?:\/\d{1,2})?(?:\/\/\d{1,3})?$/u;

/** Matches an IPv6 prefix length from 0 to 128. */
const IPV6_PREFIX_LENGTH = /^(?:12[0-8]|1[01]\d|[1-9]\d|\d)$/u;

/** Matches a leading SPF qualifier character. */
const QUALIFIER_PREFIX = /^[+\-?~]/u;

/** Matches an `a` or `mx` mechanism and captures its argument. */
const ADDRESS_MECHANISM = /^(a|mx)(.*)$/iu;

/** Matches a `name=value` modifier and captures both parts. */
const MODIFIER_PAIR = /^([A-Za-z][A-Za-z0-9\-_.]*)=(.*)$/u;

/** Matches the `v=spf1` tag at the start of a record. */
const SPF_VERSION_TAG = /^v=spf1/iu;

/**
 * A parser for SPF records, ported from Internet.nl's `spf_parser.py`, which
 * follows the collected ABNF in section 12 of RFC 7208. Instead of a parser
 * combinator it splits the record into space separated terms and validates
 * each term with the same grammar, which accepts the same records.
 */

type SpfQualifier = '+' | '-' | '?' | '~';

type SpfTermKind =
  | 'all'
  | 'include'
  | 'a'
  | 'mx'
  | 'ptr'
  | 'ip4'
  | 'ip6'
  | 'exists'
  | 'redirect'
  | 'exp'
  | 'modifier';

interface SpfTerm {
  /** The term exactly as written. */
  raw: string;
  kind: SpfTermKind;
  /** The explicit qualifier, or null when the term has none. */
  qualifier: SpfQualifier | null;
  /** The domain, address or modifier value after `:` or `=`, if any. */
  value: string | null;
}

export interface SpfRecord {
  terms: SpfTerm[];
}

/** `macro-expand` of RFC 7208: `%{x}` with transformers, `%%`, `%_`, `%-`. */
const MACRO_EXPAND =
  /^(?:%\{[slodiphcrtvSLODIPHCRTV]\d*[rR]?[.\-+,/_=]*\}|%%|%_|%-)/u;

/** A `macro-string`: macro expansions and printable characters except `%`. */
const MACRO_STRING =
  /^(?:%\{[slodiphcrtvSLODIPHCRTV]\d*[rR]?[.\-+,/_=]*\}|%%|%_|%-|[\u0021-\u0024\u0026-\u007E])*$/u;

/** `toplabel` of RFC 7208: must contain a letter or a hyphen between alphanum. */
function isToplabel(label: string): boolean {
  if (ALPHANUMERIC_LABEL.test(label)) {
    return CONTAINS_LETTER.test(label);
  }
  return HYPHENATED_LABEL.test(label) && ENDS_ALPHANUMERIC.test(label);
}

const IPV4_OCTET = '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])';
const IPV4 = new RegExp(
  String.raw`^${IPV4_OCTET}\.${IPV4_OCTET}\.${IPV4_OCTET}\.${IPV4_OCTET}(?:/(3[0-2]|[12][0-9]|[0-9]))?$`,
  'u',
);

/** `domain-spec`: a macro string whose last label is a toplabel or macro. */
export function isValidDomainSpec(spec: string): boolean {
  if (spec === '' || !MACRO_STRING.test(spec)) {
    return false;
  }
  const withoutDot = spec.endsWith('.') ? spec.slice(0, -1) : spec;
  const label = withoutDot.split('.').at(-1) ?? '';
  return isToplabel(label) || MACRO_EXPAND.test(label);
}

/** `a` and `mx` accept an optional dual CIDR length: `/24`, `//64`, `/24//64`. */
const DUAL_CIDR =
  /^(?:\/(3[0-2]|[12]\d|\d))?(?:\/\/(12[0-8]|1[01]\d|[1-9]\d|\d))?$/u;

/** Validates the argument of `a` / `mx`, which is `[:domain-spec][dual-cidr]`. */
function isValidDomainWithCidr(argument: string): boolean {
  if (argument === '') {
    return true;
  }
  if (argument.startsWith('/')) {
    return DUAL_CIDR.test(argument);
  }
  if (!argument.startsWith(':')) {
    return false;
  }
  const rest = argument.slice(1);
  // Printable characters include `/`, so the whole rest is also a domain
  // specification; try it without a trailing CIDR first, then as is.
  const cidr = CIDR_SUFFIX.exec(rest)?.[0] ?? '';
  const stripped = rest.slice(0, rest.length - cidr.length);
  if (DUAL_CIDR.test(cidr) && isValidDomainSpec(stripped)) {
    return true;
  }
  return isValidDomainSpec(rest);
}

function isValidIp6(argument: string): boolean {
  const [address, ...lengthParts] = argument.split('/');
  if (lengthParts.length > 1 || !isIPv6(address)) {
    return false;
  }
  return lengthParts.length === 0 || IPV6_PREFIX_LENGTH.test(lengthParts[0]);
}

/** Parses one term, or returns null when it is not valid. */
function parseTerm(raw: string): SpfTerm | null {
  const qualifierMatch = QUALIFIER_PREFIX.exec(raw);
  const qualifier = (qualifierMatch?.[0] as SpfQualifier | undefined) ?? null;
  const body = qualifier ? raw.slice(1) : raw;
  const lower = body.toLowerCase();
  const term = (kind: SpfTermKind, value: string | null = null): SpfTerm => ({
    raw,
    kind,
    qualifier,
    value,
  });

  if (lower === 'all') {
    return term('all');
  }
  if (lower.startsWith('include:')) {
    const value = body.slice(8);
    return isValidDomainSpec(value) ? term('include', value) : null;
  }
  if (lower.startsWith('exists:')) {
    const value = body.slice(7);
    return isValidDomainSpec(value) ? term('exists', value) : null;
  }
  if (lower.startsWith('ip4:')) {
    const value = body.slice(4);
    return IPV4.test(value) ? term('ip4', value) : null;
  }
  if (lower.startsWith('ip6:')) {
    const value = body.slice(4);
    return isValidIp6(value) ? term('ip6', value) : null;
  }
  if (lower === 'ptr') {
    return term('ptr');
  }
  if (lower.startsWith('ptr:')) {
    const value = body.slice(4);
    return isValidDomainSpec(value) ? term('ptr', value) : null;
  }
  const dual = ADDRESS_MECHANISM.exec(body);
  if (dual && isValidDomainWithCidr(dual[2])) {
    const kind = dual[1].toLowerCase() as 'a' | 'mx';
    return term(kind, dual[2].startsWith(':') ? dual[2].slice(1) : null);
  }

  // Modifiers cannot carry a qualifier.
  if (qualifier) {
    return null;
  }
  const modifier = MODIFIER_PAIR.exec(body);
  if (!modifier || !MACRO_STRING.test(modifier[2])) {
    return null;
  }
  const name = modifier[1].toLowerCase();
  if (name === 'redirect' || name === 'exp') {
    return isValidDomainSpec(modifier[2]) ? term(name, modifier[2]) : null;
  }
  return term('modifier', modifier[2]);
}

/**
 * Parses an SPF record. Returns null when the record is not syntactically
 * valid. Terms are separated by one or more spaces and the record may end
 * with spaces; the version `v=spf1` is case insensitive.
 */
export function parseSpf(record: string): SpfRecord | null {
  if (!SPF_VERSION_TAG.test(record)) {
    return null;
  }
  const rest = record.slice(6);
  if (rest !== '' && !rest.startsWith(' ')) {
    return null;
  }
  const terms = rest
    .split(' ')
    .filter((raw) => raw !== '')
    .map((raw) => parseTerm(raw));
  return terms.every((term) => term !== null) ? { terms } : null;
}

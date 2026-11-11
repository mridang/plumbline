/**
 * Content Security Policy parsing and analysis.
 *
 * A port of Mozilla Observatory's `cspParser.js` and `tests/csp.js`
 * (https://github.com/mdn/mdn-http-observatory), including its result codes
 * and descriptions. The result codes are the same ones Webbkoll uses
 * (`csp-implemented-with-unsafe-inline`, ...), so one analysis serves both.
 * The OWASP Secure Headers Project rule is much simpler and lives in
 * `owaspCspFindings`.
 */
import { finding, type Finding } from './finding.js';
import { headerValues, type HeaderBag } from './http-headers.js';

/** A parsed policy: directive name to its set of sources. */
export type CspMap = Map<string, Set<string>>;

/** Thrown for a policy the parser rejects. */
export class CspParseError extends Error {
  name = 'CspParseError';
}

const compareString = new Intl.Collator('en').compare;

// The shortest policy Observatory accepts is `img-src` minus one character.
const SHORTEST_POLICY_LENGTH = 'img-src'.length - 1;

// Directives the HTML spec does not honour in a <meta> policy.
const DIRECTIVES_DISALLOWED_IN_META = [
  'frame-ancestors',
  'report-uri',
  'sandbox',
];

// Repeated report-uri/report-to are tolerated (with a warning); any other
// repeated directive makes the policy invalid.
const ALLOWED_DUPLICATE_KEYS = new Set(['report-uri', 'report-to']);

/** Key under which the parser records tolerated duplicate directives. */
export const DUPLICATE_WARNINGS_KEY = '_observatory_duplicate_key_warnings';

interface SourceEntry {
  source: string;
  index: number;
  keep: boolean;
}

/** Compares two URL paths segment by segment, as the CSP spec matches them. */
function pathPartMatch(pathA: string, pathB: string): boolean {
  if (pathA.length === 0 || (pathA === '/' && pathB.length === 0)) {
    return true;
  }
  const exactMatch = !pathA.endsWith('/');
  const listA = pathA.split('/');
  const listB = pathB.split('/');
  if (
    listA.length > listB.length ||
    (exactMatch && listA.length !== listB.length)
  ) {
    return false;
  }
  if (!exactMatch) {
    listA.pop();
  }
  for (const [i, elementA] of listA.entries()) {
    const elementB = listB.at(i);
    if (elementB === undefined) {
      return false;
    }
    if (decodeURIComponent(elementA) !== decodeURIComponent(elementB)) {
      return false;
    }
  }
  return true;
}

/** Records an allowed repeated directive, and throws for one that is not allowed. */
function noteDuplicate(
  directive: string,
  policyIndex: number,
  duplicateWarnings: Set<string>,
): void {
  if (!ALLOWED_DUPLICATE_KEYS.has(directive)) {
    throw new CspParseError(
      `Duplicate directive ${directive} in policy ${policyIndex}`,
    );
  }
  duplicateWarnings.add(directive);
}

/** Marks which adjacent sources in a sorted list survive the merge. */
function markSurvivors(combined: SourceEntry[]): void {
  for (let i = 1; i < combined.length; i++) {
    const source = combined[i];
    const prev = combined[i - 1];
    if (!source || !prev) {
      continue;
    }
    // Within one policy a longer source that starts with a shorter one
    // is superfluous (example.com/foo and example.com/foobar).
    if (source.index === prev.index && source.source.startsWith(prev.source)) {
      source.keep = false;
    }
    // Across policies a source has to exist in both to count.
    if (
      source.index !== prev.index &&
      pathPartMatch(prev.source, source.source)
    ) {
      source.keep = true;
    }
  }
}

/**
 * Parses one or more policies (several headers, or header plus meta) into
 * one effective policy. With several policies a source only survives when
 * every policy allows it, as browsers enforce them. Throws `CspParseError`
 * for an empty policy or a repeated directive.
 */
export function parseCsp(cspList: string[]): CspMap {
  const cleanList = cspList.map((policy) =>
    policy.replaceAll(/[\r\n]/g, '').trim(),
  );
  if (cleanList.length === 0) {
    return new Map();
  }
  for (const policy of cleanList) {
    if (!policy || policy.length < SHORTEST_POLICY_LENGTH) {
      throw new CspParseError(`Invalid policy: ${policy}`);
    }
  }

  const csp = new Map<string, SourceEntry[]>();
  const duplicateWarnings = new Set<string>();

  for (const [policyIndex, policy] of cleanList.entries()) {
    const seenInThisPolicy = new Set<string>();

    for (const entry of policy.split(';').map((e) => e.trim().split(/\s+/))) {
      const [directiveEntry, ...valueEntries] = entry;
      if (!directiveEntry) {
        continue;
      }
      // Directive names are case-insensitive since CSP3.
      const directive = directiveEntry.toLowerCase();

      // A repeated directive is technically fine (the first wins) but is
      // reported as invalid so people notice, except report-uri/report-to.
      if (seenInThisPolicy.has(directive)) {
        noteDuplicate(directive, policyIndex, duplicateWarnings);
      } else {
        seenInThisPolicy.add(directive);
      }

      const keep = policyIndex === 0;
      const values: SourceEntry[] = [];
      if (valueEntries.length > 0) {
        values.push(
          ...valueEntries.map((raw) => ({
            source: raw.trim().toLocaleLowerCase(),
            index: policyIndex,
            keep,
          })),
        );
      } else if (directive.endsWith('-src')) {
        // A source list without values is the same as 'none'.
        values.push({ source: "'none'", index: policyIndex, keep });
      } else {
        // A directive that is not a source list adds no values.
      }

      const combined =
        policyIndex === 0
          ? [...values]
          : [...(csp.get(directive) ?? []), ...values];
      combined.sort((a, b) => compareString(a.source, b.source));

      markSurvivors(combined);
      csp.set(
        directive,
        combined.filter((source) => source.keep),
      );

      // With more policies to come, everything from the first one must be
      // re-confirmed by the later ones.
      if (policyIndex === 0 && cleanList.length > 1) {
        (csp.get(directive) ?? []).forEach((source) => {
          source.keep = false;
        });
      }
    }
  }

  const result: CspMap = new Map();
  for (const [directive, sources] of csp) {
    result.set(
      directive,
      new Set(sources.length > 0 ? sources.map((s) => s.source) : ["'none'"]),
    );
  }
  if (duplicateWarnings.size > 0) {
    result.set(DUPLICATE_WARNINGS_KEY, duplicateWarnings);
  }
  return result;
}

/** Parses policies from `<meta>` tags, dropping header-only directives. */
export function parseCspMeta(cspList: string[]): CspMap {
  const parsed = parseCsp(cspList);
  for (const directive of DIRECTIVES_DISALLOWED_IN_META) {
    parsed.delete(directive);
  }
  return parsed;
}

/**
 * A lenient reader for hints that only need to look a directive up (for
 * example `report-uri`). Like Webbkoll's `parse_csp` the first occurrence of
 * a directive wins, nothing throws, and values are lower-cased.
 */
export function parseCspLoose(
  policy: string | null | undefined,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!policy) {
    return result;
  }
  const parts = policy
    .replaceAll('\n', ';')
    .trim()
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length >= 6);
  for (const part of parts) {
    const [name = '', ...values] = part.split(/\s+/);
    if (result.has(name)) {
      continue;
    }
    const lowered = values.map((value) => value.toLowerCase());
    result.set(name, lowered.length > 0 ? lowered : ["'none'"]);
  }
  return result;
}

/** Observatory/Webbkoll CSP result codes. */
type CspResultCode =
  | 'csp-implemented-with-no-unsafe-default-src-none'
  | 'csp-implemented-with-no-unsafe'
  | 'csp-implemented-with-unsafe-inline-in-style-src-only'
  | 'csp-implemented-with-insecure-scheme-in-passive-content-only'
  | 'csp-implemented-with-unsafe-eval'
  | 'csp-implemented-with-unsafe-inline'
  | 'csp-implemented-with-insecure-scheme'
  | 'csp-implemented-but-duplicate-directives'
  | 'csp-header-invalid'
  | 'csp-not-implemented'
  | 'csp-not-implemented-but-reporting-enabled';

/** What the analysis learned about the policy. */
interface CspPolicyFlags {
  antiClickjacking: boolean;
  defaultNone: boolean;
  insecureBaseUri: boolean;
  insecureFormAction: boolean;
  insecureSchemeActive: boolean;
  insecureSchemePassive: boolean;
  strictDynamic: boolean;
  unsafeEval: boolean;
  unsafeInline: boolean;
  unsafeInlineStyle: boolean;
  unsafeObjects: boolean;
}

export interface CspAnalysis {
  result: CspResultCode;
  /** Whether Observatory counts the result as a pass. */
  pass: boolean;
  policy: CspPolicyFlags | null;
  /** The effective policy, with directives mapped to sorted sources. */
  data: Record<string, string[]> | null;
}

export interface CspInput {
  /** Raw values of every `Content-Security-Policy` header. */
  headers: string[];
  /** `content` of every `<meta http-equiv="Content-Security-Policy">`. */
  metas: string[];
  /** Whether a `Content-Security-Policy-Report-Only` header was sent. */
  reportOnly: boolean;
  /** Whether the page was served over HTTPS. */
  secure: boolean;
}

const DANGEROUSLY_BROAD = [
  'ftp:',
  'http:',
  'https:',
  '*',
  // These match insecure wildcard sources, so they must keep the http scheme.
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- detection pattern for insecure http wildcards, not a request URL
  'http://*',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- detection pattern for insecure http wildcards, not a request URL
  'http://*.*',
  'https://*',
  'https://*.*',
];
const UNSAFE_INLINE = ["'unsafe-inline'", 'data:'];
const PASSIVE_DIRECTIVES = new Set(['img-src', 'media-src']);
const NONCES_HASHES = ["'sha256-", "'sha384-", "'sha512-", "'nonce-"];

/** Results Observatory counts as passing, besides the default one. */
const PASSING: ReadonlySet<CspResultCode> = new Set([
  'csp-implemented-with-no-unsafe',
  'csp-implemented-with-no-unsafe-default-src-none',
  'csp-implemented-with-unsafe-inline-in-style-src-only',
  'csp-implemented-with-insecure-scheme-in-passive-content-only',
]);

const intersects = (
  set: Iterable<string>,
  list: readonly string[],
): boolean => {
  const wanted = new Set(list);
  for (const value of set) {
    if (wanted.has(value)) {
      return true;
    }
  }
  return false;
};

const hasNonceOrHash = (sources: Iterable<string>): boolean => {
  for (const source of sources) {
    if (NONCES_HASHES.some((prefix) => source.startsWith(prefix))) {
      return true;
    }
  }
  return false;
};

/** Splits header values on commas: commas separate policies (CSP3 2.2). */
function splitPolicies(values: string[]): string[] {
  return values.flatMap((value) => value.split(',').map((s) => s.trim()));
}

/** Runs Observatory's CSP test. */
export function analyzeCsp(input: CspInput): CspAnalysis {
  const httpPolicies = splitPolicies(input.headers);
  const metaPolicies = splitPolicies(input.metas);
  const analysis: CspAnalysis = {
    result: 'csp-not-implemented',
    pass: false,
    policy: null,
    data: null,
  };

  let csp: CspMap;
  try {
    csp = parseCsp([...httpPolicies, ...metaPolicies]);
  } catch {
    analysis.result = 'csp-header-invalid';
    return analysis;
  }
  let httpOnly: CspMap;
  try {
    httpOnly = parseCsp(httpPolicies);
  } catch {
    httpOnly = new Map();
  }
  let metaOnly: CspMap;
  try {
    metaOnly = parseCspMeta(metaPolicies);
  } catch {
    metaOnly = new Map();
  }

  // A <meta> policy with only header-only directives counts as nothing.
  if (httpOnly.size + metaOnly.size === 0) {
    analysis.result = input.reportOnly
      ? 'csp-not-implemented-but-reporting-enabled'
      : 'csp-not-implemented';
    return analysis;
  }

  const flags: CspPolicyFlags = {
    antiClickjacking: false,
    defaultNone: false,
    insecureBaseUri: false,
    insecureFormAction: false,
    insecureSchemeActive: false,
    insecureSchemePassive: false,
    strictDynamic: false,
    unsafeEval: false,
    unsafeInline: false,
    unsafeInlineStyle: false,
    unsafeObjects: false,
  };
  analysis.policy = flags;

  // The first problem found decides the result; later ones only set flags.
  let result: CspResultCode | null = null;
  const setResult = (code: CspResultCode): void => {
    result ??= code;
  };

  const baseUri = csp.get('base-uri') ?? new Set(['*']);
  // frame-ancestors is only honoured in a header, never in a <meta>.
  const frameAncestors = httpOnly.get('frame-ancestors') ?? new Set(['*']);
  const formAction = csp.get('form-action') ?? new Set(['*']);
  const objectSrc =
    csp.get('object-src') ?? csp.get('default-src') ?? new Set(['*']);
  const scriptSrc =
    csp.get('script-src') ?? csp.get('default-src') ?? new Set(['*']);
  const styleSrc =
    csp.get('style-src') ?? csp.get('default-src') ?? new Set(['*']);

  // A nonce or hash makes browsers ignore 'unsafe-inline'.
  for (const sources of [scriptSrc, styleSrc]) {
    if (hasNonceOrHash(sources)) {
      sources.delete("'unsafe-inline'");
    }
  }

  // 'strict-dynamic' needs a nonce/hash; it then makes browsers ignore
  // scheme/host sources, 'self' and 'unsafe-inline'.
  if (hasNonceOrHash(scriptSrc) && scriptSrc.has("'strict-dynamic'")) {
    for (const source of scriptSrc) {
      if (
        DANGEROUSLY_BROAD.some((broad) => source.startsWith(broad)) ||
        source === "'self'" ||
        source === "'unsafe-inline'"
      ) {
        scriptSrc.delete(source);
      }
    }
    flags.strictDynamic = true;
  } else if (scriptSrc.has("'strict-dynamic'")) {
    setResult('csp-header-invalid');
  } else {
    // Without 'strict-dynamic' the script sources are used as written.
  }

  const activeSources: string[] = [];
  for (const [directive, sources] of csp) {
    if (!PASSIVE_DIRECTIVES.has(directive) && directive !== 'script-src') {
      activeSources.push(...sources);
    }
  }
  activeSources.push(...scriptSrc);

  const passiveSources = [...PASSIVE_DIRECTIVES].flatMap((directive) => [
    ...(csp.get(directive) ?? csp.get('default-src') ?? []),
  ]);

  // No 'unsafe-inline' or data: in script-src, no overly broad scheme in
  // object-src or script-src, and both must be restricted at all.
  if (
    intersects(scriptSrc, [...DANGEROUSLY_BROAD, ...UNSAFE_INLINE]) ||
    intersects(objectSrc, DANGEROUSLY_BROAD)
  ) {
    setResult('csp-implemented-with-unsafe-inline');
    flags.unsafeInline = true;
  }

  // An HTTPS site must not allow http: or ftp: for active content.
  if (
    input.secure &&
    activeSources.some((s) => s.startsWith('http:') || s.startsWith('ftp:'))
  ) {
    setResult('csp-implemented-with-insecure-scheme');
    flags.insecureSchemeActive = true;
  }

  if (scriptSrc.has("'unsafe-eval'") || styleSrc.has("'unsafe-eval'")) {
    setResult('csp-implemented-with-unsafe-eval');
    flags.unsafeEval = true;
  }

  // ...and not for passive content either.
  if (
    input.secure &&
    passiveSources.some((s) => s.startsWith('http:') || s.startsWith('ftp:'))
  ) {
    setResult('csp-implemented-with-insecure-scheme-in-passive-content-only');
    flags.insecureSchemePassive = true;
  }

  if (intersects(styleSrc, [...DANGEROUSLY_BROAD, ...UNSAFE_INLINE])) {
    setResult('csp-implemented-with-unsafe-inline-in-style-src-only');
    flags.unsafeInlineStyle = true;
  }

  const defaultSrc = csp.get('default-src');
  if (defaultSrc?.has("'none'") && defaultSrc.size === 1) {
    setResult('csp-implemented-with-no-unsafe-default-src-none');
    flags.defaultNone = true;
  } else {
    setResult('csp-implemented-with-no-unsafe');
  }

  flags.antiClickjacking = !intersects(frameAncestors, DANGEROUSLY_BROAD);
  flags.insecureBaseUri = intersects(baseUri, [
    ...DANGEROUSLY_BROAD,
    ...UNSAFE_INLINE,
  ]);
  flags.insecureFormAction = intersects(formAction, DANGEROUSLY_BROAD);
  flags.unsafeObjects = intersects(objectSrc, DANGEROUSLY_BROAD);

  const decided: CspResultCode = result ?? 'csp-implemented-with-no-unsafe';
  analysis.result = decided;
  if (PASSING.has(decided)) {
    analysis.pass = true;
    // A passing policy with a repeated report-uri/report-to is flagged.
    if (csp.has(DUPLICATE_WARNINGS_KEY)) {
      analysis.result = 'csp-implemented-but-duplicate-directives';
    }
  }

  analysis.data = {};
  for (const [key, value] of csp) {
    if (key !== DUPLICATE_WARNINGS_KEY) {
      // Code-unit order, as the default sort uses.
      analysis.data[key] = [...value].toSorted(
        (a, b) => Number(a > b) - Number(a < b),
      );
    }
  }
  return analysis;
}

const MESSAGES: Record<CspResultCode, string> = {
  'csp-implemented-with-no-unsafe-default-src-none':
    "Content Security Policy (CSP) implemented with default-src 'none', no 'unsafe' and form-action is set to 'none' or 'self'.",
  'csp-implemented-with-no-unsafe':
    "Content Security Policy (CSP) implemented without 'unsafe-inline' or 'unsafe-eval'. Consider setting default-src to 'none'.",
  'csp-implemented-with-unsafe-inline-in-style-src-only':
    "Content Security Policy (CSP) implemented with unsafe sources inside style-src. This includes 'unsafe-inline', data: or overly broad sources such as https. Lock down the style-src directive, removing 'unsafe-inline', data: and broad sources.",
  'csp-implemented-with-insecure-scheme-in-passive-content-only':
    'Content Security Policy (CSP) implemented, but secure site allows images or media to be loaded over HTTP. Load images and media over HTTPS and prevent their loading over HTTP with the img-src and media-src or default-src directives.',
  'csp-implemented-with-unsafe-eval':
    "Content Security Policy (CSP) implemented, but allows 'unsafe-eval'. First remove the use of eval() from the codebase and once completed, remove 'unsafe-eval' from the CSP header.",
  'csp-implemented-with-unsafe-inline':
    "Content Security Policy (CSP) implemented unsafely. This includes 'unsafe-inline' or data: inside script-src, overly broad sources such as https: inside object-src or script-src, or not restricting the sources for object-src or script-src.",
  'csp-implemented-with-insecure-scheme':
    'Content Security Policy (CSP) implemented, but secure site allows resources to be loaded over HTTP. Load resources over HTTPS and remove any HTTP sources from your CSP.',
  'csp-implemented-but-duplicate-directives':
    'Content Security Policy (CSP) implemented, but contains duplicate directives. Remove duplicate directives from the CSP.',
  'csp-header-invalid':
    'Content Security Policy (CSP) header cannot be parsed successfully. Check your CSP syntax with the CSP Evaluator.',
  'csp-not-implemented':
    'Content Security Policy (CSP) header not implemented.',
  'csp-not-implemented-but-reporting-enabled':
    'Content Security Policy (CSP) reporting implemented only, with the Content-Security-Policy-Report-Only header. Implement an enforced policy.',
};

/** Passing results that still deserve a warning, and how serious. */
const PASSING_WITH_ADVICE = new Set<CspResultCode>([
  'csp-implemented-with-unsafe-inline-in-style-src-only',
  'csp-implemented-with-insecure-scheme-in-passive-content-only',
  'csp-implemented-but-duplicate-directives',
]);

/** Turns an analysis into findings, keeping Observatory's pass/fail line. */
export function cspFindings(analysis: CspAnalysis): Finding[] {
  const message = MESSAGES[analysis.result];
  if (!analysis.pass) {
    return [finding('error', message)];
  }
  if (PASSING_WITH_ADVICE.has(analysis.result)) {
    return [finding('warning', message)];
  }
  return [];
}

/** Runs the CSP analysis straight from response headers and meta tags. */
export function analyzeCspFromHeaders(
  headers: HeaderBag,
  metas: string[],
  secure: boolean,
): CspAnalysis {
  return analyzeCsp({
    headers: headerValues(headers, 'content-security-policy'),
    metas,
    reportOnly:
      headerValues(headers, 'content-security-policy-report-only').length > 0,
    secure,
  });
}

/**
 * OWASP Secure Headers Project: the `Content-Security-Policy` header must be
 * present and must not contain the substring `unsafe`.
 */
export function owaspCspFindings(values: string[]): Finding[] {
  if (values.length === 0) {
    return [
      finding(
        'error',
        "The 'Content-Security-Policy' header was not specified.",
      ),
    ];
  }
  if (values.some((value) => value.includes('unsafe'))) {
    return [
      finding(
        'error',
        "The 'Content-Security-Policy' header should not contain 'unsafe' (for example 'unsafe-inline' or 'unsafe-eval').",
      ),
    ];
  }
  return [];
}

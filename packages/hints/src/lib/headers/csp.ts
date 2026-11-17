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
import { finding } from './finding.js';
import { headerValues } from './http-headers.js';
import type { Finding } from './finding.js';
import type { HeaderBag } from './http-headers.js';

/** Matches a run of whitespace. */
const WHITESPACE_RUN = /\s+/u;

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
const DIRECTIVES_DISALLOWED_IN_META = new Set([
  'frame-ancestors',
  'report-uri',
  'sandbox',
]);

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
  return (exactMatch ? listA : listA.slice(0, -1)).every((elementA, index) => {
    const elementB = listB.at(index);
    return (
      elementB !== undefined &&
      decodeURIComponent(elementA) === decodeURIComponent(elementB)
    );
  });
}

/**
 * Records an allowed repeated directive, and throws for one that is not
 * allowed. Returns the warnings including the new one.
 */
function noteDuplicate(
  directive: string,
  policyIndex: number,
  duplicateWarnings: ReadonlySet<string>,
): Set<string> {
  if (!ALLOWED_DUPLICATE_KEYS.has(directive)) {
    throw new CspParseError(
      `Duplicate directive ${directive} in policy ${policyIndex}`,
    );
  }
  return new Set([...duplicateWarnings, directive]);
}

/** Marks which adjacent sources in a sorted list survive the merge. */
function markSurvivors(combined: SourceEntry[]): SourceEntry[] {
  return combined.map((source, index) => {
    const previous = combined[index - 1];
    if (index === 0 || !previous) {
      return source;
    }
    // Within one policy a longer source that starts with a shorter one
    // is superfluous (example.com/foo and example.com/foobar).
    if (
      source.index === previous.index &&
      source.source.startsWith(previous.source)
    ) {
      return { ...source, keep: false };
    }
    // Across policies a source has to exist in both to count.
    if (
      source.index !== previous.index &&
      pathPartMatch(previous.source, source.source)
    ) {
      return { ...source, keep: true };
    }
    return source;
  });
}

/** What the scan of the policies has collected so far. */
interface CspScan {
  csp: ReadonlyMap<string, SourceEntry[]>;
  duplicateWarnings: ReadonlySet<string>;
}

/** Folds one policy into the scan of the policies before it. */
function scanPolicy(
  scan: CspScan,
  policy: string,
  policyIndex: number,
  policyCount: number,
): CspScan {
  const entries = policy
    .split(';')
    .map((part) => part.trim().split(WHITESPACE_RUN));
  return entries.reduce<CspScan>(
    (current, [directiveEntry, ...valueEntries], entryIndex) => {
      if (!directiveEntry) {
        return current;
      }
      // Directive names are case-insensitive since CSP3.
      const directive = directiveEntry.toLowerCase();

      // A repeated directive is technically fine (the first wins) but is
      // reported as invalid so people notice, except report-uri/report-to.
      const repeated = entries
        .slice(0, entryIndex)
        .some(([earlier]) => earlier?.toLowerCase() === directive);
      const duplicateWarnings = repeated
        ? noteDuplicate(directive, policyIndex, current.duplicateWarnings)
        : current.duplicateWarnings;

      const keep = policyIndex === 0;
      const sourceValues = valueEntries.map((raw) => ({
        source: raw.trim().toLocaleLowerCase(),
        index: policyIndex,
        keep,
      }));
      // A source list without values is the same as 'none'; any other
      // directive without values adds none.
      const values: SourceEntry[] =
        sourceValues.length === 0 && directive.endsWith('-src')
          ? [{ source: "'none'", index: policyIndex, keep }]
          : sourceValues;

      const combined = (
        policyIndex === 0
          ? values
          : [...(current.csp.get(directive) ?? []), ...values]
      ).toSorted((a, b) => compareString(a.source, b.source));

      const survivors = markSurvivors(combined).filter((source) => source.keep);

      // With more policies to come, everything from the first one must be
      // re-confirmed by the later ones.
      const stored =
        policyIndex === 0 && policyCount > 1
          ? survivors.map((source) => ({ ...source, keep: false }))
          : survivors;
      return {
        csp: new Map([...current.csp, [directive, stored]]),
        duplicateWarnings,
      };
    },
    scan,
  );
}

/**
 * Parses one or more policies (several headers, or header plus meta) into
 * one effective policy. With several policies a source only survives when
 * every policy allows it, as browsers enforce them. Throws `CspParseError`
 * for an empty policy or a repeated directive.
 */
export function parseCsp(cspList: string[]): CspMap {
  const cleanList = cspList.map((policy) =>
    policy.replaceAll(/[\r\n]/gu, '').trim(),
  );
  if (cleanList.length === 0) {
    return new Map<string, Set<string>>();
  }
  const invalid = cleanList.find(
    (policy) => !policy || policy.length < SHORTEST_POLICY_LENGTH,
  );
  if (invalid !== undefined) {
    throw new CspParseError(`Invalid policy: ${invalid}`);
  }

  const { csp, duplicateWarnings } = cleanList.reduce<CspScan>(
    (scan, policy, policyIndex) =>
      scanPolicy(scan, policy, policyIndex, cleanList.length),
    { csp: new Map<string, SourceEntry[]>(), duplicateWarnings: new Set() },
  );

  const result: CspMap = new Map(
    Array.from(csp, ([directive, sources]): [string, Set<string>] => [
      directive,
      new Set(sources.length > 0 ? sources.map((s) => s.source) : ["'none'"]),
    ]),
  );
  return duplicateWarnings.size > 0
    ? new Map([...result, [DUPLICATE_WARNINGS_KEY, new Set(duplicateWarnings)]])
    : result;
}

/** Parses policies from `<meta>` tags, dropping header-only directives. */
export function parseCspMeta(cspList: string[]): CspMap {
  return new Map(
    [...parseCsp(cspList)].filter(
      ([directive]) => !DIRECTIVES_DISALLOWED_IN_META.has(directive),
    ),
  );
}

/**
 * A lenient reader for hints that only need to look a directive up (for
 * example `report-uri`). Like Webbkoll's `parse_csp` the first occurrence of
 * a directive wins, nothing throws, and values are lower-cased.
 */
export function parseCspLoose(
  policy: string | null | undefined,
): Map<string, string[]> {
  if (!policy) {
    return new Map<string, string[]>();
  }
  return new Map(
    policy
      .replaceAll('\n', ';')
      .trim()
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length >= 6)
      .map((part): [string, string[]] => {
        const [name = '', ...values] = part.split(WHITESPACE_RUN);
        const lowered = values.map((value) => value.toLowerCase());
        return [name, lowered.length > 0 ? lowered : ["'none'"]];
      })
      .filter(
        ([name], index, entries) =>
          entries.findIndex(([first]) => first === name) === index,
      ),
  );
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

/** The cleartext scheme, kept apart so the wildcard sources below read as patterns. */
const HTTP = 'http:';

const DANGEROUSLY_BROAD = [
  'ftp:',
  HTTP,
  'https:',
  '*',
  // These match insecure wildcard sources, so they must keep the http scheme.
  `${HTTP}//*`,
  `${HTTP}//*.*`,
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
  return [...set].some((value) => wanted.has(value));
};

const hasNonceOrHash = (sources: Iterable<string>): boolean =>
  [...sources].some((source) =>
    NONCES_HASHES.some((prefix) => source.startsWith(prefix)),
  );

/** Splits header values on commas: commas separate policies (CSP3 2.2). */
function splitPolicies(values: string[]): string[] {
  return values.flatMap((value) => value.split(',').map((s) => s.trim()));
}

/** Runs Observatory's CSP test. */
export function analyzeCsp(input: CspInput): CspAnalysis {
  const httpPolicies = splitPolicies(input.headers);
  const metaPolicies = splitPolicies(input.metas);

  // eslint-disable-next-line functional/no-let -- assigned inside try/catch, where a parse error means an invalid header
  let csp: CspMap;
  try {
    csp = parseCsp([...httpPolicies, ...metaPolicies]);
  } catch {
    return {
      result: 'csp-header-invalid',
      pass: false,
      policy: null,
      data: null,
    };
  }
  // eslint-disable-next-line functional/no-let -- assigned inside try/catch, where a parse error means no header policy
  let httpOnly: CspMap;
  try {
    httpOnly = parseCsp(httpPolicies);
  } catch {
    httpOnly = new Map<string, Set<string>>();
  }
  // eslint-disable-next-line functional/no-let -- assigned inside try/catch, where a parse error means no meta policy
  let metaOnly: CspMap;
  try {
    metaOnly = parseCspMeta(metaPolicies);
  } catch {
    metaOnly = new Map<string, Set<string>>();
  }

  // A <meta> policy with only header-only directives counts as nothing.
  if (httpOnly.size + metaOnly.size === 0) {
    return {
      result: input.reportOnly
        ? 'csp-not-implemented-but-reporting-enabled'
        : 'csp-not-implemented',
      pass: false,
      policy: null,
      data: null,
    };
  }

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
  // eslint-disable-next-line functional/no-loop-statements -- cleans the parsed sets in place; analysis.data reports them cleaned and default-src may be shared
  for (const sources of [scriptSrc, styleSrc]) {
    if (hasNonceOrHash(sources)) {
      // eslint-disable-next-line functional/immutable-data -- see the loop above
      sources.delete("'unsafe-inline'");
    }
  }

  // 'strict-dynamic' needs a nonce/hash; it then makes browsers ignore
  // scheme/host sources, 'self' and 'unsafe-inline'.
  const strictDynamic =
    hasNonceOrHash(scriptSrc) && scriptSrc.has("'strict-dynamic'");
  if (strictDynamic) {
    // eslint-disable-next-line functional/no-loop-statements -- cleans the parsed script-src set in place; analysis.data reports it cleaned and default-src may be shared
    for (const source of scriptSrc) {
      if (
        DANGEROUSLY_BROAD.some((broad) => source.startsWith(broad)) ||
        source === "'self'" ||
        source === "'unsafe-inline'"
      ) {
        // eslint-disable-next-line functional/immutable-data -- see the loop above
        scriptSrc.delete(source);
      }
    }
  }
  // Without 'strict-dynamic' the script sources are used as written, and
  // 'strict-dynamic' without a nonce or hash is invalid.
  const invalidStrictDynamic =
    !strictDynamic && scriptSrc.has("'strict-dynamic'");

  const activeSources = [
    ...[...csp]
      .filter(
        ([directive]) =>
          !PASSIVE_DIRECTIVES.has(directive) && directive !== 'script-src',
      )
      .flatMap(([, sources]) => [...sources]),
    ...scriptSrc,
  ];

  const passiveSources = [...PASSIVE_DIRECTIVES].flatMap((directive) => [
    ...(csp.get(directive) ?? csp.get('default-src') ?? []),
  ]);

  const insecure = (source: string): boolean =>
    source.startsWith('http:') || source.startsWith('ftp:');
  // No 'unsafe-inline' or data: in script-src, no overly broad scheme in
  // object-src or script-src, and both must be restricted at all.
  const unsafeInline =
    intersects(scriptSrc, [...DANGEROUSLY_BROAD, ...UNSAFE_INLINE]) ||
    intersects(objectSrc, DANGEROUSLY_BROAD);
  // An HTTPS site must not allow http: or ftp: for active content...
  const insecureSchemeActive =
    input.secure && activeSources.some((source) => insecure(source));
  const unsafeEval =
    scriptSrc.has("'unsafe-eval'") || styleSrc.has("'unsafe-eval'");
  // ...and not for passive content either.
  const insecureSchemePassive =
    input.secure && passiveSources.some((source) => insecure(source));
  const unsafeInlineStyle = intersects(styleSrc, [
    ...DANGEROUSLY_BROAD,
    ...UNSAFE_INLINE,
  ]);
  const defaultSrc = csp.get('default-src');
  const defaultNone =
    defaultSrc?.has("'none'") === true && defaultSrc.size === 1;

  // The first problem found decides the result; later ones only set flags.
  const problems: [boolean, CspResultCode][] = [
    [invalidStrictDynamic, 'csp-header-invalid'],
    [unsafeInline, 'csp-implemented-with-unsafe-inline'],
    [insecureSchemeActive, 'csp-implemented-with-insecure-scheme'],
    [unsafeEval, 'csp-implemented-with-unsafe-eval'],
    [
      insecureSchemePassive,
      'csp-implemented-with-insecure-scheme-in-passive-content-only',
    ],
    [unsafeInlineStyle, 'csp-implemented-with-unsafe-inline-in-style-src-only'],
  ];
  const decided: CspResultCode =
    problems.find(([found]) => found)?.[1] ??
    (defaultNone
      ? 'csp-implemented-with-no-unsafe-default-src-none'
      : 'csp-implemented-with-no-unsafe');

  const pass = PASSING.has(decided);
  return {
    // A passing policy with a repeated report-uri/report-to is flagged.
    result:
      pass && csp.has(DUPLICATE_WARNINGS_KEY)
        ? 'csp-implemented-but-duplicate-directives'
        : decided,
    pass,
    policy: {
      antiClickjacking: !intersects(frameAncestors, DANGEROUSLY_BROAD),
      defaultNone,
      insecureBaseUri: intersects(baseUri, [
        ...DANGEROUSLY_BROAD,
        ...UNSAFE_INLINE,
      ]),
      insecureFormAction: intersects(formAction, DANGEROUSLY_BROAD),
      insecureSchemeActive,
      insecureSchemePassive,
      strictDynamic,
      unsafeEval,
      unsafeInline,
      unsafeInlineStyle,
      unsafeObjects: intersects(objectSrc, DANGEROUSLY_BROAD),
    },
    data: Object.fromEntries(
      [...csp].flatMap(([key, value]) =>
        key === DUPLICATE_WARNINGS_KEY
          ? []
          : // Code-unit order, as the default sort uses.
            [
              [
                key,
                [...value].toSorted((a, b) => Number(a > b) - Number(a < b)),
              ],
            ],
      ),
    ),
  };
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

/**
 * Cross-Origin-Opener-Policy, Cross-Origin-Embedder-Policy and
 * Cross-Origin-Resource-Policy.
 *
 * Observatory rules (`tests/cross-origin-*.js`): a recognised value passes,
 * a missing header passes with advice, a header sent twice or with an
 * unknown value is invalid. COOP and COEP are read as structured field
 * tokens; CORP is a plain keyword that may also come from a `<meta>`, where
 * the header wins. The OWASP profile requires `same-origin` (COOP, CORP) and
 * `require-corp` (COEP).
 */
import { finding, type Finding, type Profile } from './finding.js';
import { parseStructuredToken } from './structured-field.js';

export type CrossOriginPolicy = 'coop' | 'coep' | 'corp';

interface PolicySpec {
  header: string;
  valid: readonly string[];
  /** Values that are valid but give no protection. */
  weak: readonly string[];
  /** The advice shown when the header is absent or weak. */
  advice: string;
  /** The value the OWASP profile requires. */
  owasp: string;
}

const SPECS: Record<CrossOriginPolicy, PolicySpec> = {
  coop: {
    header: 'Cross-Origin-Opener-Policy',
    valid: [
      'same-origin',
      'same-origin-allow-popups',
      'noopener-allow-popups',
      'unsafe-none',
    ],
    weak: ['unsafe-none'],
    advice:
      "Set to 'same-origin', 'same-origin-allow-popups', or 'noopener-allow-popups'.",
    owasp: 'same-origin',
  },
  coep: {
    header: 'Cross-Origin-Embedder-Policy',
    valid: ['require-corp', 'credentialless', 'unsafe-none'],
    weak: ['unsafe-none'],
    advice: "Set to 'require-corp' or 'credentialless'.",
    owasp: 'require-corp',
  },
  corp: {
    header: 'Cross-Origin-Resource-Policy',
    valid: ['same-site', 'same-origin', 'cross-origin'],
    weak: ['cross-origin'],
    advice: "Set to 'same-origin' or 'same-site'.",
    owasp: 'same-origin',
  },
};

/**
 * Findings for one of the three policies. `values` are the response header
 * values, `metas` the `<meta http-equiv>` contents (only used for CORP).
 */
export function crossOriginFindings(
  policy: CrossOriginPolicy,
  values: string[],
  metas: string[],
  profile: Profile,
): Finding[] {
  const spec = SPECS[policy];
  const name = spec.header;

  if (profile === 'owasp') {
    if (values.length === 0) {
      return [finding('error', `The '${name}' header was not specified.`)];
    }
    const got =
      values.length === 1 ? values[0]?.trim().toLowerCase() : undefined;
    return got === spec.owasp
      ? []
      : [finding('error', `The '${name}' header should be '${spec.owasp}'.`)];
  }

  let declared: string | undefined;
  if (policy === 'corp') {
    // The header has precedence over a <meta http-equiv>.
    declared = values.length > 0 ? values.join(', ') : metas.at(-1)?.trim();
  } else if (values.length > 1) {
    return [
      finding(
        'error',
        `${name} header cannot be recognized (it was sent more than once).`,
      ),
    ];
  } else {
    declared = values[0];
  }

  if (declared === undefined || declared === '') {
    return [finding('hint', `${name} header not implemented. ${spec.advice}`)];
  }

  const token =
    policy === 'corp'
      ? declared.slice(0, 256).trim().toLowerCase()
      : parseStructuredToken(declared.slice(0, 1024));
  if (token === null || !spec.valid.includes(token)) {
    const quoted = spec.valid.map((v) => `'${v}'`).join(', ');
    return [
      finding(
        'error',
        `${name} header cannot be recognized. Set to one of ${quoted}.`,
      ),
    ];
  }
  if (spec.weak.includes(token)) {
    return [
      finding(
        'hint',
        `${name} header set to '${token}', which is the default and gives no protection. ${spec.advice}`,
      ),
    ];
  }
  return [];
}

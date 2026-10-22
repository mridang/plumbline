/**
 * The `headers` check set: every webhint response-header hint that a Lighthouse
 * *plugin* can run from the artifacts Lighthouse already gathers. Each check
 * reads the main document's response headers (out of the devtools log, via the
 * `NetworkRecords` computed artifact) — plus `MetaElements` where the hint also
 * reads a `<meta http-equiv>` — builds the small input the shared
 * `src/lib/headers/**` function takes, and calls that exact function, so a site
 * yields the same findings here as under the webhint hint.
 *
 * Twenty header hints are covered: csp, hsts, x-frame-options, referrer-policy,
 * x-content-type-options, coop, coep, corp, cors, cookies,
 * x-permitted-cross-domain-policies, clear-site-data, permissions-policy,
 * cache-control, x-dns-prefetch-control, feature-policy, public-key-pins,
 * expect-ct, x-xss-protection and csp-reporting.
 *
 * Titles, descriptions, references and sections come from the compiled hint
 * metadata (`../meta.ts`); only `x-content-type-options`, which has no webhint
 * hint, restates them. Hints with a `profile` option (csp, hsts,
 * x-frame-options, referrer-policy, coop, coep, corp) use the same default the
 * hints use, `observatory`.
 *
 * Scoring: a check is graded (`numeric`) and weighted in the category unless
 * its webhint hint is context-specific in a way a homepage plugin run cannot
 * reproduce — `cors` needs a cross-origin probe request, `clear-site-data` is a
 * logout-response rule, and `cache-control` is an opt-in private-page rule.
 * Those three are `informative`: their findings are surfaced but never scored.
 */
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import type { HintDefinition } from '../../../dist/core/define-hint.js';
import { finding } from '../../../dist/lib/headers/finding.js';
import {
  firstHeader,
  headerValues,
} from '../../../dist/lib/headers/http-headers.js';
import {
  analyzeCspFromHeaders,
  cspFindings,
} from '../../../dist/lib/headers/csp.js';
import { hstsFindings, hstsProtects } from '../../../dist/lib/headers/hsts.js';
import { frameOptionsFindings } from '../../../dist/lib/headers/frame-options.js';
import {
  effectiveReferrerPolicy,
  referrerPolicyFindings,
} from '../../../dist/lib/headers/referrer-policy.js';
import {
  deprecatedHeaderFindings,
  exactHeaderFindings,
} from '../../../dist/lib/headers/exact-header.js';
import {
  crossOriginFindings,
  type CrossOriginPolicy,
} from '../../../dist/lib/headers/cross-origin.js';
import { corsFindings, PROBE_ORIGIN } from '../../../dist/lib/headers/cors.js';
import { cookieFindings } from '../../../dist/lib/headers/cookies.js';
import { permissionsPolicyFindings } from '../../../dist/lib/headers/permissions-policy.js';
import { xssProtectionFindings } from '../../../dist/lib/headers/xss-protection.js';
import { cacheControlFindings } from '../../../dist/lib/headers/cache-control.js';
import { reportingFindings } from '../../../dist/lib/headers/reporting.js';
import { registrableDomain } from '../../../dist/lib/headers/registrable-domain.js';
import { mainResponse } from '../network.js';
import {
  cspMetaContents,
  metaHttpEquivContents,
  referrerSources,
} from '../adapt.js';
import { hintDocs } from '../meta.js';
import type { AuditCheck } from './types.js';

// The compiled webhint hints, imported only for their metadata (name,
// description, reference, section); their check logic is reused through the
// `src/lib/headers/**` functions above, not through these modules.
import cacheControlHint from '../../../dist/hints/headers/cache-control.js';
import clearSiteDataHint from '../../../dist/hints/headers/clear-site-data.js';
import coepHint from '../../../dist/hints/headers/coep.js';
import cookiesHint from '../../../dist/hints/headers/cookies.js';
import coopHint from '../../../dist/hints/headers/coop.js';
import corpHint from '../../../dist/hints/headers/corp.js';
import corsHint from '../../../dist/hints/headers/cors.js';
import cspReportingHint from '../../../dist/hints/headers/csp-reporting.js';
import cspHint from '../../../dist/hints/headers/csp.js';
import expectCtHint from '../../../dist/hints/headers/expect-ct.js';
import featurePolicyHint from '../../../dist/hints/headers/feature-policy.js';
import hstsHint from '../../../dist/hints/headers/hsts.js';
import permissionsPolicyHint from '../../../dist/hints/headers/permissions-policy.js';
import publicKeyPinsHint from '../../../dist/hints/headers/public-key-pins.js';
import referrerPolicyHint from '../../../dist/hints/headers/referrer-policy.js';
import xDnsPrefetchControlHint from '../../../dist/hints/headers/x-dns-prefetch-control.js';
import xFrameOptionsHint from '../../../dist/hints/headers/x-frame-options.js';
import xPermittedCrossDomainPoliciesHint from '../../../dist/hints/headers/x-permitted-cross-domain-policies.js';
import xXssProtectionHint from '../../../dist/hints/headers/x-xss-protection.js';

/** The artifact set the header checks read (plus `MetaElements` where noted). */
const HEADER_ARTIFACTS = ['DevtoolsLog', 'URL'] as const;
const HEADER_AND_META_ARTIFACTS = [
  ...HEADER_ARTIFACTS,
  'MetaElements',
] as const;

/** The value OWASP expects from Clear-Site-Data, without spaces, lower case. */
const CLEAR_SITE_DATA_EXPECTED = '"cache","cookies","storage"';

/** Joins header values into one string, or null when there are none. */
function join(values: string[], separator: string): string | null {
  return values.length > 0 ? values.join(separator) : null;
}

/**
 * Builds a check that borrows its metadata from a compiled webhint hint. The
 * title, description, reference and section are taken from the hint, so they
 * are never restated here.
 */
function fromHint(
  definition: HintDefinition,
  config: Pick<AuditCheck, 'scoreMode' | 'run'> & {
    requiredArtifacts: readonly string[];
  },
): AuditCheck {
  const docs = hintDocs(definition);
  return {
    id: definition.id,
    // Every header hint is placed in the taxonomy, so `section` is always set;
    // fall back to site protection defensively rather than emit an empty group.
    section: docs.section ?? 'site-protection',
    title: docs.name,
    description: docs.description,
    reference: docs.url,
    scoreMode: config.scoreMode,
    requiredArtifacts: config.requiredArtifacts,
    run: config.run,
  };
}

/** The shared run for the three cross-origin policies (COOP, COEP, CORP). */
function crossOriginRun(
  policy: CrossOriginPolicy,
  header: string,
): AuditCheck['run'] {
  return async (artifacts: LH.Artifacts, context: AuditNS.Context) => {
    const main = await mainResponse(artifacts, context);
    if (!main) {
      return null;
    }
    // COOP/COEP ignore the meta contents; CORP reads them (header wins), just
    // as the webhint hints pass them for all three.
    return crossOriginFindings(
      policy,
      headerValues(main.headers, header),
      metaHttpEquivContents(artifacts.MetaElements, header),
      'observatory',
    );
  };
}

/** The 20 header checks, in report order. */
export const headersChecks: readonly AuditCheck[] = [
  fromHint(cspHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_AND_META_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      const analysis = analyzeCspFromHeaders(
        main.headers,
        cspMetaContents(artifacts.MetaElements),
        main.secure,
      );
      return cspFindings(analysis);
    },
  }),

  fromHint(hstsHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return hstsFindings({
        header: firstHeader(main.headers, 'strict-transport-security'),
        secure: main.secure,
        profile: 'observatory',
      });
    },
  }),

  fromHint(xFrameOptionsHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      // A CSP that lists frame-ancestors supersedes X-Frame-Options.
      const cspFrameAncestors = headerValues(
        main.headers,
        'content-security-policy',
      ).some((value) => /(^|;)\s*frame-ancestors\b/i.test(value));
      return frameOptionsFindings({
        header: firstHeader(main.headers, 'x-frame-options'),
        cspFrameAncestors,
        profile: 'observatory',
      });
    },
  }),

  fromHint(referrerPolicyHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_AND_META_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      const sources = referrerSources(
        artifacts.MetaElements,
        headerValues(main.headers, 'referrer-policy'),
      );
      return referrerPolicyFindings(
        effectiveReferrerPolicy(sources),
        'observatory',
      );
    },
  }),

  // X-Content-Type-Options has no webhint hint, so its metadata is restated
  // here; the check still reuses the shared `exactHeaderFindings` logic.
  {
    id: 'x-content-type-options',
    section: 'site-protection',
    title: 'X-Content-Type-Options is set to nosniff',
    description:
      'The nosniff value stops browsers from guessing (sniffing) a response into a content type the server did not declare.',
    reference:
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options',
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return exactHeaderFindings(
        'X-Content-Type-Options',
        firstHeader(main.headers, 'x-content-type-options'),
        ['nosniff'],
      );
    },
  },

  fromHint(coopHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_AND_META_ARTIFACTS,
    run: crossOriginRun('coop', 'cross-origin-opener-policy'),
  }),

  fromHint(coepHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_AND_META_ARTIFACTS,
    run: crossOriginRun('coep', 'cross-origin-embedder-policy'),
  }),

  fromHint(corpHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_AND_META_ARTIFACTS,
    run: crossOriginRun('corp', 'cross-origin-resource-policy'),
  }),

  // CORS needs a cross-origin probe request Lighthouse cannot send, so this
  // reads whatever Access-Control-* headers the main document returned and is
  // surfaced as information only (see the file header).
  fromHint(corsHint, {
    scoreMode: 'informative',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return corsFindings({
        allowOrigin: firstHeader(main.headers, 'access-control-allow-origin'),
        allowCredentials: firstHeader(
          main.headers,
          'access-control-allow-credentials',
        ),
        origin: PROBE_ORIGIN,
      });
    },
  }),

  fromHint(cookiesHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      const protectedByHsts = hstsProtects(
        firstHeader(main.headers, 'strict-transport-security'),
        main.secure,
      );
      return cookieFindings(
        headerValues(main.headers, 'set-cookie'),
        protectedByHsts,
      );
    },
  }),

  fromHint(xPermittedCrossDomainPoliciesHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return exactHeaderFindings(
        'X-Permitted-Cross-Domain-Policies',
        firstHeader(main.headers, 'x-permitted-cross-domain-policies'),
        ['none'],
      );
    },
  }),

  // Clear-Site-Data is a logout-response rule in webhint; here it is checked on
  // the main document and surfaced as information only.
  fromHint(clearSiteDataHint, {
    scoreMode: 'informative',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      const value = firstHeader(main.headers, 'clear-site-data');
      const normalised = value?.replace(/\s+/g, '').toLowerCase() ?? null;
      return exactHeaderFindings('Clear-Site-Data', normalised, [
        CLEAR_SITE_DATA_EXPECTED,
      ]);
    },
  }),

  fromHint(permissionsPolicyHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return permissionsPolicyFindings(
        firstHeader(main.headers, 'permissions-policy'),
      );
    },
  }),

  // Cache-Control is an opt-in private-page rule in webhint; here it is checked
  // on the main document and surfaced as information only.
  fromHint(cacheControlHint, {
    scoreMode: 'informative',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return cacheControlFindings(firstHeader(main.headers, 'cache-control'));
    },
  }),

  // X-DNS-Prefetch-Control has no shared library function (the webhint hint
  // inlines the rule), so the rule is reproduced here from the same source.
  fromHint(xDnsPrefetchControlHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      const value = firstHeader(main.headers, 'x-dns-prefetch-control');
      if (value === null) {
        return [
          finding(
            'error',
            "The 'X-DNS-Prefetch-Control' header was not specified.",
          ),
        ];
      }
      if (value.toLowerCase() !== 'off') {
        return [
          finding(
            'error',
            "The 'X-DNS-Prefetch-Control' header should be 'off'.",
          ),
        ];
      }
      return [];
    },
  }),

  fromHint(featurePolicyHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return deprecatedHeaderFindings(
        'Feature-Policy',
        firstHeader(main.headers, 'feature-policy'),
        'it has been renamed to Permissions-Policy.',
      );
    },
  }),

  fromHint(publicKeyPinsHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return deprecatedHeaderFindings(
        'Public-Key-Pins',
        firstHeader(main.headers, 'public-key-pins'),
        'it has been removed from all major browsers and is no longer recommended.',
      );
    },
  }),

  fromHint(expectCtHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      return deprecatedHeaderFindings(
        'Expect-CT',
        firstHeader(main.headers, 'expect-ct'),
        'certificate transparency is enforced by default and the header is obsolete.',
      );
    },
  }),

  fromHint(xXssProtectionHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_AND_META_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      const value = firstHeader(main.headers, 'x-xss-protection');
      if (value === null) {
        // Absent is correct (the header is deprecated); nothing to report.
        return [];
      }
      const csp = analyzeCspFromHeaders(
        main.headers,
        cspMetaContents(artifacts.MetaElements),
        main.secure,
      );
      return xssProtectionFindings(value, csp.pass);
    },
  }),

  fromHint(cspReportingHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      const pageUrl =
        artifacts.URL.finalDisplayedUrl || artifacts.URL.mainDocumentUrl || '';
      let host = '';
      try {
        host = new URL(pageUrl).hostname;
      } catch {
        return null;
      }
      const nel = headerValues(main.headers, 'nel');
      return reportingFindings({
        registrable: registrableDomain(host),
        // Repeated headers are read as one policy list, as the hint does.
        csp: join(headerValues(main.headers, 'content-security-policy'), '; '),
        cspReportOnly: join(
          headerValues(main.headers, 'content-security-policy-report-only'),
          '; ',
        ),
        nel: nel[0] ?? null,
        reportTo: join(headerValues(main.headers, 'report-to'), ', '),
      });
    },
  }),
];

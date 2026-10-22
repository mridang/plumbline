/**
 * The `headers` check set: every webhint response-header hint that a Lighthouse
 * *plugin* can run from the artifacts Lighthouse already gathers. Each check
 * reads the main document's response headers (out of the devtools log, via the
 * `NetworkRecords` computed artifact) — plus `MetaElements` where the hint also
 * reads a `<meta http-equiv>` — builds the small input the shared
 * `src/lib/headers/**` function takes, and calls that exact function, so a site
 * yields the same findings here as under the webhint hint.
 *
 * The original twenty security hints are covered (csp, hsts, x-frame-options,
 * referrer-policy, x-content-type-options, coop, coep, corp, cors, cookies,
 * x-permitted-cross-domain-policies, clear-site-data, permissions-policy,
 * cache-control, x-dns-prefetch-control, feature-policy, public-key-pins,
 * expect-ct, x-xss-protection and csp-reporting), followed by the MDN
 * response-header set (information-leak, the rest of the CORS family,
 * reporting/isolation/integrity, caching/conditional and the performance,
 * timing and client-hint headers).
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
 * The same applies to MDN headers that are advisory on a plugin run (`age`,
 * `alt-svc`, `server-timing`, `via`, `origin-agent-cluster` and `accept-ch`).
 */
import type * as LH from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';
import type { HintDefinition } from '@mridang/webhint-hint-extra/dist/core/define-hint.js';
import { finding } from '@mridang/webhint-hint-extra/dist/lib/headers/finding.js';
import {
  firstHeader,
  headerValues,
} from '@mridang/webhint-hint-extra/dist/lib/headers/http-headers.js';
import {
  analyzeCspFromHeaders,
  cspFindings,
} from '@mridang/webhint-hint-extra/dist/lib/headers/csp.js';
import {
  hstsFindings,
  hstsProtects,
} from '@mridang/webhint-hint-extra/dist/lib/headers/hsts.js';
import { frameOptionsFindings } from '@mridang/webhint-hint-extra/dist/lib/headers/frame-options.js';
import {
  effectiveReferrerPolicy,
  referrerPolicyFindings,
} from '@mridang/webhint-hint-extra/dist/lib/headers/referrer-policy.js';
import {
  deprecatedHeaderFindings,
  exactHeaderFindings,
} from '@mridang/webhint-hint-extra/dist/lib/headers/exact-header.js';
import {
  crossOriginFindings,
  type CrossOriginPolicy,
} from '@mridang/webhint-hint-extra/dist/lib/headers/cross-origin.js';
import {
  corsFindings,
  PROBE_ORIGIN,
} from '@mridang/webhint-hint-extra/dist/lib/headers/cors.js';
import { cookieFindings } from '@mridang/webhint-hint-extra/dist/lib/headers/cookies.js';
import { permissionsPolicyFindings } from '@mridang/webhint-hint-extra/dist/lib/headers/permissions-policy.js';
import { xssProtectionFindings } from '@mridang/webhint-hint-extra/dist/lib/headers/xss-protection.js';
import { cacheControlFindings } from '@mridang/webhint-hint-extra/dist/lib/headers/cache-control.js';
import { reportingFindings } from '@mridang/webhint-hint-extra/dist/lib/headers/reporting.js';
import { registrableDomain } from '@mridang/webhint-hint-extra/dist/lib/headers/registrable-domain.js';
import {
  serverBannerFindings,
  serverTimingFindings,
  sourcemapFindings,
  viaFindings,
  xPoweredByFindings,
} from '@mridang/webhint-hint-extra/dist/lib/headers/info-leak.js';
import {
  corsAllowCredentialsFindings,
  corsAllowHeadersFindings,
  corsAllowMethodsFindings,
  corsExposeHeadersFindings,
  corsMaxAgeFindings,
} from '@mridang/webhint-hint-extra/dist/lib/headers/cors-extra.js';
import {
  integrityPolicyFindings,
  nelFindings,
  originAgentClusterFindings,
  reportingEndpointsFindings,
} from '@mridang/webhint-hint-extra/dist/lib/headers/reporting-extra.js';
import {
  ageFindings,
  etagFindings,
  expiresFindings,
  lastModifiedFindings,
  noVarySearchFindings,
  varyFindings,
} from '@mridang/webhint-hint-extra/dist/lib/headers/caching.js';
import {
  acceptChFindings,
  altSvcFindings,
  criticalChFindings,
  retryAfterFindings,
  timingAllowOriginFindings,
} from '@mridang/webhint-hint-extra/dist/lib/headers/client-hints.js';
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
import cacheControlHint from '@mridang/webhint-hint-extra/dist/hints/headers/cache-control.js';
import clearSiteDataHint from '@mridang/webhint-hint-extra/dist/hints/headers/clear-site-data.js';
import coepHint from '@mridang/webhint-hint-extra/dist/hints/headers/coep.js';
import cookiesHint from '@mridang/webhint-hint-extra/dist/hints/headers/cookies.js';
import coopHint from '@mridang/webhint-hint-extra/dist/hints/headers/coop.js';
import corpHint from '@mridang/webhint-hint-extra/dist/hints/headers/corp.js';
import corsHint from '@mridang/webhint-hint-extra/dist/hints/headers/cors.js';
import cspReportingHint from '@mridang/webhint-hint-extra/dist/hints/headers/csp-reporting.js';
import cspHint from '@mridang/webhint-hint-extra/dist/hints/headers/csp.js';
import expectCtHint from '@mridang/webhint-hint-extra/dist/hints/headers/expect-ct.js';
import featurePolicyHint from '@mridang/webhint-hint-extra/dist/hints/headers/feature-policy.js';
import hstsHint from '@mridang/webhint-hint-extra/dist/hints/headers/hsts.js';
import permissionsPolicyHint from '@mridang/webhint-hint-extra/dist/hints/headers/permissions-policy.js';
import publicKeyPinsHint from '@mridang/webhint-hint-extra/dist/hints/headers/public-key-pins.js';
import referrerPolicyHint from '@mridang/webhint-hint-extra/dist/hints/headers/referrer-policy.js';
import xDnsPrefetchControlHint from '@mridang/webhint-hint-extra/dist/hints/headers/x-dns-prefetch-control.js';
import xFrameOptionsHint from '@mridang/webhint-hint-extra/dist/hints/headers/x-frame-options.js';
import xPermittedCrossDomainPoliciesHint from '@mridang/webhint-hint-extra/dist/hints/headers/x-permitted-cross-domain-policies.js';
import xXssProtectionHint from '@mridang/webhint-hint-extra/dist/hints/headers/x-xss-protection.js';
import serverBannerHint from '@mridang/webhint-hint-extra/dist/hints/headers/server-banner.js';
import xPoweredByHint from '@mridang/webhint-hint-extra/dist/hints/headers/x-powered-by.js';
import serverTimingHint from '@mridang/webhint-hint-extra/dist/hints/headers/server-timing.js';
import viaHint from '@mridang/webhint-hint-extra/dist/hints/headers/via.js';
import sourcemapHint from '@mridang/webhint-hint-extra/dist/hints/headers/sourcemap.js';
import corsAllowCredentialsHint from '@mridang/webhint-hint-extra/dist/hints/headers/cors-allow-credentials.js';
import corsAllowMethodsHint from '@mridang/webhint-hint-extra/dist/hints/headers/cors-allow-methods.js';
import corsAllowHeadersHint from '@mridang/webhint-hint-extra/dist/hints/headers/cors-allow-headers.js';
import corsExposeHeadersHint from '@mridang/webhint-hint-extra/dist/hints/headers/cors-expose-headers.js';
import corsMaxAgeHint from '@mridang/webhint-hint-extra/dist/hints/headers/cors-max-age.js';
import reportingEndpointsHint from '@mridang/webhint-hint-extra/dist/hints/headers/reporting-endpoints.js';
import nelHint from '@mridang/webhint-hint-extra/dist/hints/headers/nel.js';
import originAgentClusterHint from '@mridang/webhint-hint-extra/dist/hints/headers/origin-agent-cluster.js';
import integrityPolicyHint from '@mridang/webhint-hint-extra/dist/hints/headers/integrity-policy.js';
import integrityPolicyReportOnlyHint from '@mridang/webhint-hint-extra/dist/hints/headers/integrity-policy-report-only.js';
import etagHint from '@mridang/webhint-hint-extra/dist/hints/headers/etag.js';
import lastModifiedHint from '@mridang/webhint-hint-extra/dist/hints/headers/last-modified.js';
import expiresHint from '@mridang/webhint-hint-extra/dist/hints/headers/expires.js';
import ageHint from '@mridang/webhint-hint-extra/dist/hints/headers/age.js';
import varyHint from '@mridang/webhint-hint-extra/dist/hints/headers/vary.js';
import noVarySearchHint from '@mridang/webhint-hint-extra/dist/hints/headers/no-vary-search.js';
import acceptChHint from '@mridang/webhint-hint-extra/dist/hints/headers/accept-ch.js';
import criticalChHint from '@mridang/webhint-hint-extra/dist/hints/headers/critical-ch.js';
import timingAllowOriginHint from '@mridang/webhint-hint-extra/dist/hints/headers/timing-allow-origin.js';
import altSvcHint from '@mridang/webhint-hint-extra/dist/hints/headers/alt-svc.js';
import retryAfterHint from '@mridang/webhint-hint-extra/dist/hints/headers/retry-after.js';

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

/** The header checks, in report order. */
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

  // --- MDN response-header coverage -------------------------------------
  // Information-leak headers.
  fromHint(serverBannerHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? serverBannerFindings(firstHeader(main.headers, 'server'))
        : null;
    },
  }),

  fromHint(xPoweredByHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? xPoweredByFindings(firstHeader(main.headers, 'x-powered-by'))
        : null;
    },
  }),

  fromHint(serverTimingHint, {
    scoreMode: 'informative',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? serverTimingFindings(firstHeader(main.headers, 'server-timing'))
        : null;
    },
  }),

  fromHint(viaHint, {
    scoreMode: 'informative',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main ? viaFindings(firstHeader(main.headers, 'via')) : null;
    },
  }),

  fromHint(sourcemapHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? sourcemapFindings(
            firstHeader(main.headers, 'sourcemap'),
            firstHeader(main.headers, 'x-sourcemap'),
          )
        : null;
    },
  }),

  // The rest of the CORS family (read from the main response; no preflight).
  fromHint(corsAllowCredentialsHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? corsAllowCredentialsFindings(
            firstHeader(main.headers, 'access-control-allow-credentials'),
            firstHeader(main.headers, 'access-control-allow-origin'),
          )
        : null;
    },
  }),

  fromHint(corsAllowMethodsHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? corsAllowMethodsFindings(
            firstHeader(main.headers, 'access-control-allow-methods'),
          )
        : null;
    },
  }),

  fromHint(corsAllowHeadersHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? corsAllowHeadersFindings(
            firstHeader(main.headers, 'access-control-allow-headers'),
          )
        : null;
    },
  }),

  fromHint(corsExposeHeadersHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? corsExposeHeadersFindings(
            firstHeader(main.headers, 'access-control-expose-headers'),
          )
        : null;
    },
  }),

  fromHint(corsMaxAgeHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? corsMaxAgeFindings(
            firstHeader(main.headers, 'access-control-max-age'),
          )
        : null;
    },
  }),

  // Reporting, isolation and integrity.
  fromHint(reportingEndpointsHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? reportingEndpointsFindings(
            firstHeader(main.headers, 'reporting-endpoints'),
          )
        : null;
    },
  }),

  fromHint(nelHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main ? nelFindings(firstHeader(main.headers, 'nel')) : null;
    },
  }),

  fromHint(originAgentClusterHint, {
    scoreMode: 'informative',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? originAgentClusterFindings(
            firstHeader(main.headers, 'origin-agent-cluster'),
          )
        : null;
    },
  }),

  fromHint(integrityPolicyHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? integrityPolicyFindings(
            'Integrity-Policy',
            firstHeader(main.headers, 'integrity-policy'),
          )
        : null;
    },
  }),

  fromHint(integrityPolicyReportOnlyHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? integrityPolicyFindings(
            'Integrity-Policy-Report-Only',
            firstHeader(main.headers, 'integrity-policy-report-only'),
          )
        : null;
    },
  }),

  // Caching and conditional requests.
  fromHint(etagHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main ? etagFindings(firstHeader(main.headers, 'etag')) : null;
    },
  }),

  fromHint(lastModifiedHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? lastModifiedFindings(firstHeader(main.headers, 'last-modified'))
        : null;
    },
  }),

  fromHint(expiresHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      if (!main) {
        return null;
      }
      const cacheControl = firstHeader(main.headers, 'cache-control') ?? '';
      return expiresFindings(
        firstHeader(main.headers, 'expires'),
        /(^|,)\s*max-age\s*=/i.test(cacheControl),
      );
    },
  }),

  fromHint(ageHint, {
    scoreMode: 'informative',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main ? ageFindings(firstHeader(main.headers, 'age')) : null;
    },
  }),

  fromHint(varyHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main ? varyFindings(firstHeader(main.headers, 'vary')) : null;
    },
  }),

  fromHint(noVarySearchHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? noVarySearchFindings(firstHeader(main.headers, 'no-vary-search'))
        : null;
    },
  }),

  // Performance, timing and client hints.
  fromHint(acceptChHint, {
    scoreMode: 'informative',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? acceptChFindings(firstHeader(main.headers, 'accept-ch'))
        : null;
    },
  }),

  fromHint(criticalChHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? criticalChFindings(
            firstHeader(main.headers, 'critical-ch'),
            firstHeader(main.headers, 'accept-ch'),
          )
        : null;
    },
  }),

  fromHint(timingAllowOriginHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? timingAllowOriginFindings(
            firstHeader(main.headers, 'timing-allow-origin'),
          )
        : null;
    },
  }),

  fromHint(altSvcHint, {
    scoreMode: 'informative',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main ? altSvcFindings(firstHeader(main.headers, 'alt-svc')) : null;
    },
  }),

  fromHint(retryAfterHint, {
    scoreMode: 'numeric',
    requiredArtifacts: HEADER_ARTIFACTS,
    run: async (artifacts, context) => {
      const main = await mainResponse(artifacts, context);
      return main
        ? retryAfterFindings(
            firstHeader(main.headers, 'retry-after'),
            main.status,
          )
        : null;
    },
  }),
];

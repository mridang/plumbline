import type { HintDefinition } from '../../core/define-hint.js';
import acceptCh from './accept-ch.js';
import age from './age.js';
import altSvc from './alt-svc.js';
import cacheControl from './cache-control.js';
import clearSiteData from './clear-site-data.js';
import coep from './coep.js';
import cookies from './cookies.js';
import coop from './coop.js';
import corp from './corp.js';
import cors from './cors.js';
import corsAllowCredentials from './cors-allow-credentials.js';
import corsAllowHeaders from './cors-allow-headers.js';
import corsAllowMethods from './cors-allow-methods.js';
import corsExposeHeaders from './cors-expose-headers.js';
import corsMaxAge from './cors-max-age.js';
import criticalCh from './critical-ch.js';
import cspReporting from './csp-reporting.js';
import csp from './csp.js';
import etag from './etag.js';
import expectCt from './expect-ct.js';
import expires from './expires.js';
import featurePolicy from './feature-policy.js';
import hsts from './hsts.js';
import integrityPolicy from './integrity-policy.js';
import integrityPolicyReportOnly from './integrity-policy-report-only.js';
import lastModified from './last-modified.js';
import nel from './nel.js';
import noVarySearch from './no-vary-search.js';
import originAgentCluster from './origin-agent-cluster.js';
import permissionsPolicy from './permissions-policy.js';
import publicKeyPins from './public-key-pins.js';
import redirection from './redirection.js';
import referrerPolicy from './referrer-policy.js';
import reportingEndpoints from './reporting-endpoints.js';
import retryAfter from './retry-after.js';
import serverBanner from './server-banner.js';
import serverTiming from './server-timing.js';
import sourcemap from './sourcemap.js';
import timingAllowOrigin from './timing-allow-origin.js';
import vary from './vary.js';
import via from './via.js';
import xDnsPrefetchControl from './x-dns-prefetch-control.js';
import xFrameOptions from './x-frame-options.js';
import xPermittedCrossDomainPolicies from './x-permitted-cross-domain-policies.js';
import xPoweredBy from './x-powered-by.js';
import xXssProtection from './x-xss-protection.js';
import xContentTypeOptions from './x-content-type-options.js';

/**
 * Security and response-header checks from Observatory, OWASP, Webbkoll and the
 * MDN HTTP headers reference.
 */
export const headersHints: readonly HintDefinition[] = [
  xDnsPrefetchControl,
  csp,
  referrerPolicy,
  coop,
  coep,
  corp,
  cors,
  cookies,
  redirection,
  hsts,
  xFrameOptions,
  xPermittedCrossDomainPolicies,
  clearSiteData,
  permissionsPolicy,
  cacheControl,
  featurePolicy,
  publicKeyPins,
  expectCt,
  xXssProtection,
  cspReporting,
  // MDN response-header coverage.
  serverBanner,
  xPoweredBy,
  serverTiming,
  via,
  sourcemap,
  corsAllowCredentials,
  corsAllowMethods,
  corsAllowHeaders,
  corsExposeHeaders,
  corsMaxAge,
  reportingEndpoints,
  nel,
  originAgentCluster,
  integrityPolicy,
  integrityPolicyReportOnly,
  etag,
  lastModified,
  expires,
  age,
  vary,
  noVarySearch,
  acceptCh,
  criticalCh,
  timingAllowOrigin,
  altSvc,
  retryAfter,
  xContentTypeOptions,
];

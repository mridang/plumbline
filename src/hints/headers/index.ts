import type { HintDefinition } from '../../core/define-hint.js';
import cacheControl from './cache-control.js';
import clearSiteData from './clear-site-data.js';
import coep from './coep.js';
import cookies from './cookies.js';
import coop from './coop.js';
import corp from './corp.js';
import cors from './cors.js';
import cspReporting from './csp-reporting.js';
import csp from './csp.js';
import expectCt from './expect-ct.js';
import featurePolicy from './feature-policy.js';
import hsts from './hsts.js';
import permissionsPolicy from './permissions-policy.js';
import publicKeyPins from './public-key-pins.js';
import redirection from './redirection.js';
import referrerPolicy from './referrer-policy.js';
import xDnsPrefetchControl from './x-dns-prefetch-control.js';
import xFrameOptions from './x-frame-options.js';
import xPermittedCrossDomainPolicies from './x-permitted-cross-domain-policies.js';
import xXssProtection from './x-xss-protection.js';

/** Security header checks from Observatory, OWASP and Webbkoll. */
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
];

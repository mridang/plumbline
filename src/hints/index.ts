import type { HintDefinition } from '../core/define-hint.js';
import { agentHints } from './agent/index.js';
import { discoveryHints } from './discovery/index.js';
import { emailHints } from './email/index.js';
import { emailpolicyHints } from './emailpolicy/index.js';
import { exposureHints } from './exposure/index.js';
import { feedsHints } from './feeds/index.js';
import { filesHints } from './files/index.js';
import { geoHints } from './geo/index.js';
import { headersHints } from './headers/index.js';
import { headersxHints } from './headersx/index.js';
import { i18nHints } from './i18n/index.js';
import { networkHints } from './network/index.js';
import { opengraphHints } from './opengraph/index.js';
import { privacyHints } from './privacy/index.js';
import { pwaHints } from './pwa/index.js';
import { richresultsHints } from './richresults/index.js';
import { secplusHints } from './secplus/index.js';
import { seoHints } from './seo/index.js';
import { technicalHints } from './technical/index.js';
import { tlsHints } from './tls/index.js';
import { wellknownHints } from './wellknown/index.js';

/** Every hint in the package, gathered from the per-set modules. */
export const allHints: readonly HintDefinition[] = [
  ...agentHints,
  ...discoveryHints,
  ...emailHints,
  ...emailpolicyHints,
  ...exposureHints,
  ...feedsHints,
  ...filesHints,
  ...geoHints,
  ...headersHints,
  ...headersxHints,
  ...i18nHints,
  ...networkHints,
  ...opengraphHints,
  ...privacyHints,
  ...pwaHints,
  ...richresultsHints,
  ...secplusHints,
  ...seoHints,
  ...technicalHints,
  ...tlsHints,
  ...wellknownHints,
];

import type { HintDefinition } from '../core/define-hint.js';
import { agentHints } from './agent/index.js';
import { emailHints } from './email/index.js';
import { filesHints } from './files/index.js';
import { geoHints } from './geo/index.js';
import { headersHints } from './headers/index.js';
import { networkHints } from './network/index.js';
import { opengraphHints } from './opengraph/index.js';
import { privacyHints } from './privacy/index.js';
import { seoHints } from './seo/index.js';
import { technicalHints } from './technical/index.js';
import { tlsHints } from './tls/index.js';

/** Every hint in the package, gathered from the per-set modules. */
export const allHints: readonly HintDefinition[] = [
  ...agentHints,
  ...emailHints,
  ...filesHints,
  ...geoHints,
  ...headersHints,
  ...networkHints,
  ...opengraphHints,
  ...privacyHints,
  ...seoHints,
  ...technicalHints,
  ...tlsHints,
];

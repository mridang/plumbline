import type { HintDefinition } from '../../core/define-hint.js';
import adsTxt from './ads-txt.js';
import appAdsTxt from './app-ads-txt.js';
import sellersJson from './sellers-json.js';
import humansTxt from './humans-txt.js';
import changePassword from './change-password.js';
import appleAppSiteAssociation from './apple-app-site-association.js';
import assetlinksJson from './assetlinks-json.js';
import gpcJson from './gpc-json.js';

/**
 * Hints of the `wellknown` set: root and /.well-known files validated against
 * their upstream specifications (IAB, Apple, Google, W3C and the Privacy CG).
 */
export const wellknownHints: readonly HintDefinition[] = [
  adsTxt,
  appAdsTxt,
  sellersJson,
  humansTxt,
  changePassword,
  appleAppSiteAssociation,
  assetlinksJson,
  gpcJson,
];

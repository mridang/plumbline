import type { HintDefinition } from '../../core/define-hint.js';
import cookies from './privacy-cookies.js';
import geolocation from './privacy-geolocation.js';
import insecureFirstParty from './privacy-insecure-first-party.js';
import localStorage from './privacy-local-storage.js';
import mixedContent from './privacy-mixed-content.js';
import thirdPartyRequests from './privacy-third-party-requests.js';

/** Hints of the `privacy` set. */
export const privacyHints: readonly HintDefinition[] = [
  cookies,
  geolocation,
  insecureFirstParty,
  localStorage,
  mixedContent,
  thirdPartyRequests,
];

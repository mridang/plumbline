import type { HintDefinition } from '../../core/define-hint.js';
import acceptPatch from './accept-patch.js';
import acceptPost from './accept-post.js';
import attributionReporting from './attribution-reporting.js';
import contentDigest from './content-digest.js';
import observeBrowsingTopics from './observe-browsing-topics.js';
import reprDigest from './repr-digest.js';
import serviceWorkerAllowed from './service-worker-allowed.js';
import setLogin from './set-login.js';
import speculationRules from './speculation-rules.js';
import supportsLoadingMode from './supports-loading-mode.js';
import useAsDictionary from './use-as-dictionary.js';

/**
 * The `headersx` set: the remaining non-deprecated experimental MDN response
 * headers, each checked for validity when present (and, for the privacy-
 * sensitive Privacy Sandbox headers, for presence). These complete the MDN
 * HTTP-header coverage alongside the stable `headers` set.
 */
export const headersxHints: readonly HintDefinition[] = [
  // Visitor-privacy opt-in headers (Privacy Sandbox).
  attributionReporting,
  observeBrowsingTopics,
  // FedCM login status.
  setLogin,
  // Integrity digests (RFC 9530).
  contentDigest,
  reprDigest,
  // Speculative loading.
  speculationRules,
  supportsLoadingMode,
  // Compression dictionaries.
  useAsDictionary,
  // Service worker scope.
  serviceWorkerAllowed,
  // Method negotiation.
  acceptPost,
  acceptPatch,
];

import type { HintDefinition } from '../../core/define-hint.js';
import hostMeta from './host-meta.js';
import nodeinfo from './nodeinfo.js';
import pingback from './pingback.js';
import relMe from './rel-me.js';
import webfinger from './webfinger.js';
import webmention from './webmention.js';

/**
 * The `discovery` set: IndieWeb and Fediverse discovery mechanisms. Three read
 * the page (rel=me, Webmention, Pingback — DOM and `Link` header); three probe
 * `/.well-known/*` after the scan (WebFinger, NodeInfo, host-meta).
 */
export const discoveryHints: readonly HintDefinition[] = [
  // Page-level relation links (IndieWeb / W3C).
  relMe,
  webmention,
  pingback,
  // Well-known discovery documents (Fediverse / IETF).
  webfinger,
  nodeinfo,
  hostMeta,
];

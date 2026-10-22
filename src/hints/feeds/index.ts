import type { HintDefinition } from '../../core/define-hint.js';
import feedDiscovery from './feed-discovery.js';
import feedValid from './feed-valid.js';
import oembedDiscovery from './oembed-discovery.js';
import opensearchDiscovery from './opensearch-discovery.js';
import opensearchValid from './opensearch-valid.js';

/**
 * Hints of the `feeds` set: syndication and discovery. Three DOM-only
 * discovery hints (`feed-discovery`, `oembed-discovery`,
 * `opensearch-discovery`) are plugin-able and shared with the Lighthouse
 * `feeds` checks; the two `*-valid` hints fetch the linked documents and are
 * webhint-only.
 */
export const feedsHints: readonly HintDefinition[] = [
  feedDiscovery,
  feedValid,
  oembedDiscovery,
  opensearchDiscovery,
  opensearchValid,
];

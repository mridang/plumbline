import type { HintDefinition } from '../../core/define-hint.js';
import manifestLinked from './manifest-linked.js';
import manifestValid from './manifest-valid.js';
import manifestIcons from './manifest-icons.js';
import themeColorMeta from './theme-color-meta.js';

/**
 * Hints of the `pwa` set: the Web App Manifest and the related install
 * signals, validated against the W3C Web App Manifest spec.
 *
 * `manifest-linked` and `theme-color-meta` are DOM checks (plugin-able: they
 * read only the parsed page, so the Lighthouse plugin runs them too).
 * `manifest-valid` and `manifest-icons` are webhint-only, because only a scan
 * can fetch the manifest the page links.
 *
 * The apple-touch-icon signal is covered by stock webhint
 * (`@hint/hint-apple-touch-icons`), so it is deliberately not duplicated here.
 */
export const pwaHints: readonly HintDefinition[] = [
  manifestLinked,
  manifestValid,
  manifestIcons,
  themeColorMeta,
];

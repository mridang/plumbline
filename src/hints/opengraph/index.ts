import type { HintDefinition } from '../../core/define-hint.js';
import h0 from './opengraph-title-missing.js';
import h1 from './opengraph-title-too-long.js';
import h2 from './opengraph-title-too-short.js';
import h3 from './opengraph-description-missing.js';
import h4 from './opengraph-description-too-long.js';
import h5 from './opengraph-description-slightly-long.js';
import h6 from './opengraph-description-too-short.js';
import h7 from './opengraph-description-could-be-longer.js';
import h8 from './opengraph-description-is-url.js';
import h9 from './opengraph-description-same-as-title.js';
import h10 from './opengraph-description-keyword-stuffing.js';
import h11 from './opengraph-url-missing.js';
import h12 from './opengraph-type-missing.js';
import h13 from './opengraph-site-name-missing.js';
import h14 from './opengraph-locale-missing.js';
import h15 from './opengraph-image-missing.js';
import h16 from './opengraph-image-broken.js';
import h17 from './opengraph-image-not-https.js';
import h18 from './opengraph-image-dimensions-missing.js';
import h19 from './opengraph-image-too-small.js';
import h20 from './opengraph-image-dimensions-too-large.js';
import h21 from './opengraph-image-too-large.js';
import h22 from './opengraph-image-non-optimal-size.js';
import h23 from './opengraph-image-alt-missing.js';
import h24 from './twitter-card-missing.js';
import h25 from './twitter-card-not-large.js';
import h26 from './twitter-title-missing.js';
import h27 from './twitter-description-missing.js';
import h28 from './twitter-image-missing.js';
import h29 from './twitter-site-missing.js';

/** Hints of the `opengraph` set: Open Graph, image and Twitter Card rules from opengraph.to. */
export const opengraphHints: readonly HintDefinition[] = [
  h0,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  h7,
  h8,
  h9,
  h10,
  h11,
  h12,
  h13,
  h14,
  h15,
  h16,
  h17,
  h18,
  h19,
  h20,
  h21,
  h22,
  h23,
  h24,
  h25,
  h26,
  h27,
  h28,
  h29,
];

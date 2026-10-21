import type { HintDefinition } from '../../core/define-hint.js';
import technicalHeadingHierarchy from './technical-heading-hierarchy.js';
import technicalImageAltCoverage from './technical-image-alt-coverage.js';
import technicalRobotsMetaAdvanced from './technical-robots-meta-advanced.js';
import technicalImageWeight from './technical-image-weight.js';
import technicalRedirectChain from './technical-redirect-chain.js';
import technicalCanonicalInvalid from './technical-canonical-invalid.js';
import technicalTwitterCardType from './technical-twitter-card-type.js';

/** Hints of the `technical` set. */
export const technicalHints: readonly HintDefinition[] = [
  technicalHeadingHierarchy,
  technicalImageAltCoverage,
  technicalRobotsMetaAdvanced,
  technicalImageWeight,
  technicalRedirectChain,
  technicalCanonicalInvalid,
  technicalTwitterCardType,
];

import { buildRegistry } from './registry.js';
import { allHints } from './hints/index.js';

const registry = buildRegistry(allHints);

/**
 * A package with several hints exposes them as a map from the hint id to its
 * class, which is what webhint loads for `@mridang/webhint-hint-plumbline/<id>`.
 */
export default registry.hints;

/** Hint ids that belong to each group, used to build the presets. */
export const hintsByGroup = registry.byGroup;

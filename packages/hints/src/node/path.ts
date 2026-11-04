/**
 * @packageDocumentation
 *
 * `#path` under Node: Node's own module. Browsers get `src/browser/` instead (see
 * `imports` in package.json).
 */

import path from 'node:path';

export const join = path.join;

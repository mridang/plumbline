import { fileURLToPath } from 'node:url';

/**
 * The web package directory, whatever directory Jest was started from. The
 * root run executes every workspace package as a project from the repository
 * root, so tests must not assume the working directory is this package.
 */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Lighthouse entry point for the `webhint-technical-image-alt-coverage` audit.
 * A Lighthouse plugin can only reference audits by module path, so every check
 * has this one-line wrapper; its logic lives in `../checks/technical.ts`.
 */
import { auditById } from '../checks/index.js';

export default auditById('technical-image-alt-coverage');

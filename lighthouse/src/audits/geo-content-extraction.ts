/**
 * Lighthouse entry point for the `webhint-geo-content-extraction` audit.
 * A Lighthouse plugin can only reference audits by module path, so every check
 * has this one-line wrapper; its logic lives in `../checks/geo.ts`.
 */
import { auditById } from '../checks/index.js';

export default auditById('geo-content-extraction');
